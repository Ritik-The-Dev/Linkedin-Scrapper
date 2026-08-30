/**
 * The only module in the app that performs HTTP.
 *
 * UI components never call axios or fetch directly — they call these eight
 * functions, which map 1:1 onto the endpoints in docs/api-spec.md:
 *
 *   POST   /api/leads                       createOrGetLead
 *   GET    /api/leads                       getLeads
 *   GET    /api/leads/search                searchLeads
 *   GET    /api/leads/:username             getLead
 *   POST   /api/leads/:username/refresh     refreshLead
 *   DELETE /api/leads/:username             deleteLead
 *   POST   /api/leads/import                importLeads
 *   GET    /api/leads/stats                 getStats
 *
 * Endpoints, request bodies and response structures are consumed exactly as
 * specified. Envelopes are unwrapped here so components deal in plain data, and
 * every failure leaves this module as an ApiError with a user-safe message.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

import { API_BASE_URL, PAGE_SIZE, USE_MOCK_API } from '../config/env.ts';
import type {
  CreateLeadEnvelope,
  CreateLeadResult,
  DeleteLeadEnvelope,
  DeleteLeadResult,
  ImportEnvelope,
  ImportResult,
  LeadListResult,
  LeadSource,
  LeadStats,
  PaginatedLeadsEnvelope,
  Pagination,
  SingleLeadEnvelope,
  StatsEnvelope,
} from '../types/api.ts';
import type { Lead } from '../types/lead.ts';
import { ApiError, toApiError } from './errors.ts';

/** A LinkedIn round-trip is slow; a plain database read is not. */
const TIMEOUT = {
  read: 30_000,
  linkedin: 90_000,
  import: 600_000,
} as const;

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT.read,
  headers: { Accept: 'application/json' },
});

/* Loaded on demand so mock fixtures stay out of a production build. */
type MockModule = typeof import('./mock/mockApi.ts');
let mockModule: Promise<MockModule> | null = null;
function mock(): Promise<MockModule> {
  mockModule ??= import('./mock/mockApi.ts');
  return mockModule;
}

async function send<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

function malformed(): ApiError {
  return new ApiError(
    'UNKNOWN_ERROR',
    'The API returned an unexpected response.',
    null,
    'MALFORMED_RESPONSE',
  );
}

function requireLead(body: { data?: Lead | null } | null | undefined): Lead {
  const lead = body?.data;
  if (!lead || typeof lead !== 'object' || typeof lead.username !== 'string') throw malformed();
  return lead;
}

/** Clamped to the contract's hard maximum of 10 results per request. */
function safeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return PAGE_SIZE;
  return Math.min(Math.max(1, Math.trunc(limit)), PAGE_SIZE);
}

function safePage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.trunc(page));
}

/** Rebuilds pagination if the response omits or partially fills it. */
function normalizePagination(
  raw: Partial<Pagination> | null | undefined,
  page: number,
  limit: number,
  received: number,
): Pagination {
  const resolvedLimit = typeof raw?.limit === 'number' && raw.limit > 0 ? raw.limit : limit;
  const resolvedPage = typeof raw?.page === 'number' && raw.page > 0 ? raw.page : page;
  const total = typeof raw?.total === 'number' && raw.total >= 0
    ? raw.total
    : (resolvedPage - 1) * resolvedLimit + received;
  const totalPages = typeof raw?.totalPages === 'number' && raw.totalPages >= 0
    ? raw.totalPages
    : (total === 0 ? 0 : Math.ceil(total / resolvedLimit));

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    total,
    totalPages,
    hasNextPage: typeof raw?.hasNextPage === 'boolean' ? raw.hasNextPage : resolvedPage < totalPages,
    hasPreviousPage: typeof raw?.hasPreviousPage === 'boolean'
      ? raw.hasPreviousPage
      : resolvedPage > 1 && total > 0,
  };
}

function toListResult(
  body: PaginatedLeadsEnvelope | null | undefined,
  page: number,
  limit: number,
): LeadListResult {
  const leads = Array.isArray(body?.data) ? body.data : null;
  if (leads === null) throw malformed();
  return { leads, pagination: normalizePagination(body?.pagination, page, limit, leads.length) };
}

/**
 * `:username` is placed in the path, so it is encoded even though the validator
 * already restricts it to safe characters.
 */
function path(username: string): string {
  return `/leads/${encodeURIComponent(username)}`;
}

/* ---------------------------------------------------------------- *
 * POST /api/leads
 * Body: { username } — a bare username, never a URL.
 * 200 + source:"database" when cached, 201 + source:"linkedin" when fetched.
 * ---------------------------------------------------------------- */
export async function createOrGetLead(
  username: string,
  signal?: AbortSignal,
): Promise<CreateLeadResult> {
  if (USE_MOCK_API) return (await mock()).createOrGetLead(username, signal);

  const body = await send<CreateLeadEnvelope>({
    method: 'POST',
    url: '/leads',
    data: { username },
    headers: { 'Content-Type': 'application/json' },
    timeout: TIMEOUT.linkedin,
    signal,
  });

  const source: LeadSource | null = body?.source === 'linkedin' || body?.source === 'database'
    ? body.source
    : null;

  return { lead: requireLead(body), source };
}

/** GET /api/leads/:username — stored profile only. */
export async function getLead(username: string, signal?: AbortSignal): Promise<Lead> {
  if (USE_MOCK_API) return (await mock()).getLead(username, signal);

  const body = await send<SingleLeadEnvelope>({ method: 'GET', url: path(username), signal });
  return requireLead(body);
}

/** GET /api/leads?page=&limit= — limit is capped at 10 by the contract. */
export async function getLeads(
  page = 1,
  limit = PAGE_SIZE,
  signal?: AbortSignal,
): Promise<LeadListResult> {
  const resolvedPage = safePage(page);
  const resolvedLimit = safeLimit(limit);

  if (USE_MOCK_API) return (await mock()).getLeads(resolvedPage, resolvedLimit, signal);

  const body = await send<PaginatedLeadsEnvelope>({
    method: 'GET',
    url: '/leads',
    params: { page: resolvedPage, limit: resolvedLimit },
    signal,
  });
  return toListResult(body, resolvedPage, resolvedLimit);
}

/** GET /api/leads/search?q= — searches stored leads; never touches LinkedIn. */
export async function searchLeads(
  query: string,
  page = 1,
  limit = PAGE_SIZE,
  signal?: AbortSignal,
): Promise<LeadListResult> {
  const resolvedPage = safePage(page);
  const resolvedLimit = safeLimit(limit);

  if (USE_MOCK_API) return (await mock()).searchLeads(query, resolvedPage, resolvedLimit, signal);

  const body = await send<PaginatedLeadsEnvelope>({
    method: 'GET',
    url: '/leads/search',
    params: { q: query, page: resolvedPage, limit: resolvedLimit },
    signal,
  });
  return toListResult(body, resolvedPage, resolvedLimit);
}

/** POST /api/leads/:username/refresh — re-fetches from LinkedIn and overwrites. */
export async function refreshLead(username: string, signal?: AbortSignal): Promise<Lead> {
  if (USE_MOCK_API) return (await mock()).refreshLead(username, signal);

  const body = await send<SingleLeadEnvelope>({
    method: 'POST',
    url: `${path(username)}/refresh`,
    timeout: TIMEOUT.linkedin,
    signal,
  });
  return requireLead(body);
}

/** DELETE /api/leads/:username */
export async function deleteLead(
  username: string,
  signal?: AbortSignal,
): Promise<DeleteLeadResult> {
  if (USE_MOCK_API) return (await mock()).deleteLead(username, signal);

  const body = await send<DeleteLeadEnvelope>({ method: 'DELETE', url: path(username), signal });
  const data = body?.data;
  if (!data || typeof data.username !== 'string') throw malformed();
  return { username: data.username, deleted: data.deleted === true };
}

/**
 * POST /api/leads/import — multipart upload of the .xlsx file.
 *
 * `onUploadProgress` reports bytes sent only. Once the file has landed the
 * backend works through the rows without streaming progress, so the UI must not
 * imply per-lead progress after this reaches 100.
 */
export async function importLeads(
  file: File,
  onUploadProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  if (USE_MOCK_API) return (await mock()).importLeads(file, onUploadProgress, signal);

  const form = new FormData();
  form.append('file', file);

  const body = await send<ImportEnvelope>({
    method: 'POST',
    url: '/leads/import',
    data: form,
    timeout: TIMEOUT.import,
    signal,
    onUploadProgress: (event) => {
      if (!onUploadProgress) return;
      const total = event.total ?? file.size;
      if (!total) return;
      onUploadProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
    },
  });

  const summary = body?.summary;
  if (!summary || typeof summary.totalRows !== 'number') throw malformed();

  return { summary, results: Array.isArray(body.results) ? body.results : [] };
}

/** GET /api/leads/stats */
export async function getStats(signal?: AbortSignal): Promise<LeadStats> {
  if (USE_MOCK_API) return (await mock()).getStats(signal);

  const body = await send<StatsEnvelope>({ method: 'GET', url: '/leads/stats', signal });
  const data = body?.data;
  if (!data || typeof data.totalLeads !== 'number') throw malformed();

  return {
    totalLeads: data.totalLeads,
    lastImportedAt: typeof data.lastImportedAt === 'string' ? data.lastImportedAt : null,
    totalRefreshed: typeof data.totalRefreshed === 'number' ? data.totalRefreshed : 0,
  };
}
