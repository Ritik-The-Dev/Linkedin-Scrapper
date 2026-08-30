import type { Lead } from './lead.ts';

/** Whether a lead came back from storage or was freshly fetched from LinkedIn. */
export type LeadSource = 'linkedin' | 'database';

/** Error codes defined by the API contract, plus client-only transport codes. */
export type ApiErrorCode =
  | 'INVALID_USERNAME'
  | 'INVALID_REQUEST'
  | 'LEAD_NOT_FOUND'
  | 'LINKEDIN_AUTH_ERROR'
  | 'LINKEDIN_FORBIDDEN'
  | 'LINKEDIN_RATE_LIMITED'
  | 'LINKEDIN_PROFILE_NOT_FOUND'
  | 'LINKEDIN_UPSTREAM_ERROR'
  | 'INVALID_EXCEL'
  | 'DATABASE_ERROR'
  | 'IMPORT_ERROR'
  // Client-side only — never sent by the backend.
  | 'NETWORK_ERROR'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_CANCELLED'
  | 'UNKNOWN_ERROR';

export interface ApiErrorPayload {
  code?: string | null;
  message?: string | null;
}

export interface ApiErrorEnvelope {
  success: false;
  error?: ApiErrorPayload | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SingleLeadEnvelope {
  success: true;
  data: Lead;
}

export interface CreateLeadEnvelope {
  success: true;
  source?: LeadSource | null;
  data: Lead;
}

export interface PaginatedLeadsEnvelope {
  success: true;
  data: Lead[];
  pagination: Pagination;
}

export interface DeleteLeadEnvelope {
  success: true;
  data: {
    username: string;
    deleted: boolean;
  };
}

export type ImportRowStatus = 'created' | 'exists' | 'failed';

export interface ImportSummary {
  totalRows: number;
  uniqueUsernames: number;
  alreadyExists: number;
  created: number;
  failed: number;
}

export interface ImportRowResult {
  username: string;
  status: ImportRowStatus;
  leadId?: string | null;
  error?: string | null;
}

export interface ImportEnvelope {
  success: true;
  summary: ImportSummary;
  results: ImportRowResult[];
}

export interface LeadStats {
  totalLeads: number;
  lastImportedAt: string | null;
  totalRefreshed: number;
}

export interface StatsEnvelope {
  success: true;
  data: LeadStats;
}

/* ------------------------------------------------------------------ *
 * Shapes returned by src/services/api.ts — envelopes unwrapped, with
 * `source` and `pagination` preserved because the UI needs them.
 * ------------------------------------------------------------------ */

export interface CreateLeadResult {
  lead: Lead;
  source: LeadSource | null;
}

export interface LeadListResult {
  leads: Lead[];
  pagination: Pagination;
}

export interface DeleteLeadResult {
  username: string;
  deleted: boolean;
}

export interface ImportResult {
  summary: ImportSummary;
  results: ImportRowResult[];
}
