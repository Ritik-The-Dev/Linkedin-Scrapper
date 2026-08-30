/**
 * In-memory stand-in for the backend, used when VITE_USE_MOCK_API=true.
 *
 * It implements the *same* contract as docs/api-spec.md — same request inputs,
 * same result shapes, same error codes, same 10-per-page cap. No extra fields,
 * no different schema. Swapping USE_MOCK_API off must change nothing else.
 *
 * State lives in module scope, so it survives client-side navigation but resets
 * on a full page reload.
 */

import { MOCK_LATENCY, PAGE_SIZE } from '../../config/env.ts';
import type {
  ApiErrorCode,
  CreateLeadResult,
  DeleteLeadResult,
  ImportResult,
  ImportRowResult,
  ImportSummary,
  LeadListResult,
  LeadStats,
  Pagination,
} from '../../types/api.ts';
import type { Lead } from '../../types/lead.ts';
import { ApiError, messageForCode } from '../errors.ts';
import {
  MOCK_DEMO_USERNAMES,
  MOCK_LEADS,
  MOCK_LINKEDIN_FAILURES,
  synthesiseLead,
} from './mockLeads.ts';

/* ------------------------------- state ------------------------------- */

const store = new Map<string, Lead>();
for (const lead of MOCK_LEADS) {
  store.set(lead.username, structuredClone(lead));
}

let lastImportedAt: string | null = null;
let totalRefreshed = MOCK_LEADS.reduce((sum, lead) => sum + (lead.refreshCount ?? 0), 0);

/* ------------------------------ helpers ------------------------------ */

function fail(code: ApiErrorCode, status: number): ApiError {
  return new ApiError(code, messageForCode(code), status, code);
}

function cancelled(): ApiError {
  return fail('REQUEST_CANCELLED', 0);
}

/** Simulated latency that honours AbortSignal exactly like axios would. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(cancelled());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(cancelled());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Newest-seen first, matching the backend's default sort. */
function sortedLeads(): Lead[] {
  return [...store.values()].sort((a, b) => {
    const left = Date.parse(b.lastSeenAt ?? '') || 0;
    const right = Date.parse(a.lastSeenAt ?? '') || 0;
    return left - right;
  });
}

function paginate(source: Lead[], page: number, limit: number): LeadListResult {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), PAGE_SIZE);
  const total = source.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);
  const safePage = Math.max(1, Math.trunc(page));
  const start = (safePage - 1) * safeLimit;

  const pagination: Pagination = {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1 && total > 0,
  };

  return { leads: source.slice(start, start + safeLimit).map((lead) => structuredClone(lead)), pagination };
}

/** Mirrors the backend's own username guard (see docs/api-spec.md). */
function assertValidUsername(username: string): void {
  if (typeof username !== 'string' || username.trim().length === 0) {
    throw fail('INVALID_USERNAME', 400);
  }
  if (!/^[a-z0-9._-]+$/.test(username) || username.length > 100) {
    throw fail('INVALID_USERNAME', 400);
  }
}

/** Lets the UI's error states be demonstrated without a real network. */
function assertLinkedInReachable(username: string): void {
  const code = MOCK_LINKEDIN_FAILURES[username];
  if (code !== undefined) {
    const status = code === 'LINKEDIN_RATE_LIMITED' ? 429 : code === 'LINKEDIN_AUTH_ERROR' ? 401 : 404;
    throw fail(code as ApiErrorCode, status);
  }
}

function touchLastSeen(lead: Lead): Lead {
  const updated = structuredClone(lead);
  updated.lastSeenAt = nowIso();
  updated.updatedAt = updated.lastSeenAt;
  store.set(updated.username, updated);
  return structuredClone(updated);
}

/* ---------------------------- API surface ---------------------------- */

/** POST /api/leads */
export async function createOrGetLead(
  username: string,
  signal?: AbortSignal,
): Promise<CreateLeadResult> {
  assertValidUsername(username);
  const existing = store.get(username);

  // Cached reads are quick; a LinkedIn fetch is deliberately slow.
  await sleep(existing ? MOCK_LATENCY * 0.6 : MOCK_LATENCY * 3.4, signal);

  if (existing) {
    return { lead: touchLastSeen(existing), source: 'database' };
  }

  assertLinkedInReachable(username);
  const created = synthesiseLead(username);
  store.set(username, created);
  return { lead: structuredClone(created), source: 'linkedin' };
}

/** GET /api/leads/:username */
export async function getLead(username: string, signal?: AbortSignal): Promise<Lead> {
  assertValidUsername(username);
  await sleep(MOCK_LATENCY * 0.7, signal);
  const lead = store.get(username);
  if (!lead) throw fail('LEAD_NOT_FOUND', 404);
  return structuredClone(lead);
}

/** GET /api/leads */
export async function getLeads(
  page = 1,
  limit = PAGE_SIZE,
  signal?: AbortSignal,
): Promise<LeadListResult> {
  await sleep(MOCK_LATENCY * 0.8, signal);
  return paginate(sortedLeads(), page, limit);
}

/** GET /api/leads/search — database only, never LinkedIn. */
export async function searchLeads(
  query: string,
  page = 1,
  limit = PAGE_SIZE,
  signal?: AbortSignal,
): Promise<LeadListResult> {
  await sleep(MOCK_LATENCY * 0.55, signal);

  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return paginate(sortedLeads(), page, limit);

  const matches = sortedLeads().filter((lead) => {
    const haystack = [
      lead.username,
      lead.profile?.firstName,
      lead.profile?.lastName,
      lead.profile?.fullName,
      lead.profile?.headline,
      lead.metadata?.currentCompany?.companyName,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });

  return paginate(matches, page, limit);
}

/** POST /api/leads/:username/refresh */
export async function refreshLead(username: string, signal?: AbortSignal): Promise<Lead> {
  assertValidUsername(username);
  await sleep(MOCK_LATENCY * 3, signal);

  const existing = store.get(username);
  if (!existing) throw fail('LEAD_NOT_FOUND', 404);
  assertLinkedInReachable(username);

  const refreshed = structuredClone(existing);
  const stamp = nowIso();
  refreshed.lastRefreshedAt = stamp;
  refreshed.lastSeenAt = stamp;
  refreshed.updatedAt = stamp;
  refreshed.refreshCount = (refreshed.refreshCount ?? 0) + 1;

  // Something visibly changes, so a successful refresh is observable.
  const followers = refreshed.profile?.relationship?.followerCount;
  if (refreshed.profile?.relationship && typeof followers === 'number') {
    refreshed.profile.relationship.followerCount = followers + 1 + (followers % 7);
  }

  store.set(username, refreshed);
  totalRefreshed += 1;
  return structuredClone(refreshed);
}

/** DELETE /api/leads/:username */
export async function deleteLead(
  username: string,
  signal?: AbortSignal,
): Promise<DeleteLeadResult> {
  assertValidUsername(username);
  await sleep(MOCK_LATENCY * 0.6, signal);
  if (!store.has(username)) throw fail('LEAD_NOT_FOUND', 404);
  store.delete(username);
  return { username, deleted: true };
}

/* ------------------------------ import ------------------------------- */

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv', '.tsv'];

function splitRow(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '').trim());
}

/**
 * Reads usernames out of a text spreadsheet. Real .xlsx is binary, so mock mode
 * falls back to the demo list for those — the browser cannot parse a workbook
 * without shipping a parser the real backend already owns.
 */
async function readUsernames(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    throw fail('INVALID_EXCEL', 400);
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const header = lines[0];
    if (header === undefined) throw fail('INVALID_EXCEL', 400);

    const delimiter = name.endsWith('.tsv') ? '\t' : ',';
    const columns = splitRow(header, delimiter).map((cell) => cell.toLowerCase());
    const index = columns.indexOf('username');
    if (index === -1) throw fail('INVALID_EXCEL', 400);

    const values: string[] = [];
    for (const line of lines.slice(1)) {
      const cell = splitRow(line, delimiter)[index];
      if (cell !== undefined && cell.length > 0) values.push(cell);
    }
    if (values.length === 0) throw fail('INVALID_EXCEL', 400);
    return values;
  }

  return [...MOCK_DEMO_USERNAMES];
}

/** POST /api/leads/import */
export async function importLeads(
  file: File,
  onUploadProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  for (const percent of [12, 34, 61, 88, 100]) {
    await sleep(MOCK_LATENCY * 0.25, signal);
    onUploadProgress?.(percent);
  }

  const rawUsernames = await readUsernames(file);
  const totalRows = rawUsernames.length;

  const unique: string[] = [];
  for (const raw of rawUsernames) {
    const username = raw.trim().toLowerCase();
    if (username.length > 0 && !unique.includes(username)) unique.push(username);
  }

  const results: ImportRowResult[] = [];
  const summary: ImportSummary = {
    totalRows,
    uniqueUsernames: unique.length,
    alreadyExists: 0,
    created: 0,
    failed: 0,
  };

  for (const username of unique) {
    await sleep(MOCK_LATENCY * 0.45, signal);

    if (!/^[a-z0-9._-]+$/.test(username) || username.length > 100) {
      summary.failed += 1;
      results.push({ username, status: 'failed', leadId: null, error: 'INVALID_USERNAME' });
      continue;
    }

    const existing = store.get(username);
    if (existing) {
      summary.alreadyExists += 1;
      const touched = touchLastSeen(existing);
      results.push({ username, status: 'exists', leadId: touched._id, error: null });
      continue;
    }

    const failureCode = MOCK_LINKEDIN_FAILURES[username];

    if (failureCode !== undefined) {
      summary.failed += 1;
      results.push({ username, status: 'failed', leadId: null, error: failureCode });
      continue;
    }

    const created = synthesiseLead(username);
    store.set(username, created);
    summary.created += 1;
    results.push({ username, status: 'created', leadId: created._id, error: null });
  }

  lastImportedAt = nowIso();
  return { summary, results };
}

/** GET /api/leads/stats */
export async function getStats(signal?: AbortSignal): Promise<LeadStats> {
  await sleep(MOCK_LATENCY * 0.4, signal);
  return {
    totalLeads: store.size,
    lastImportedAt,
    totalRefreshed,
  };
}
