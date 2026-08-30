import type { ApiErrorCode } from '../types/api.ts';

/**
 * Every failure the UI can encounter, normalised into one shape.
 *
 * The backend's own `message` is deliberately not shown to the user unless the
 * code is unrecognised and the text is short and single-line — that keeps stack
 * traces and internal detail out of the interface.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** HTTP status, or null for transport-level failures. */
  readonly status: number | null;
  /** The message safe to render in the UI. */
  readonly userMessage: string;
  /** Raw code from the backend, kept for logging even when unmapped. */
  readonly rawCode: string | null;

  constructor(
    code: ApiErrorCode,
    userMessage: string,
    status: number | null = null,
    rawCode: string | null = null,
  ) {
    super(userMessage);
    this.name = 'ApiError';
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.rawCode = rawCode ?? code;
  }
}

const MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_USERNAME: 'Please enter a valid LinkedIn username or profile URL.',
  INVALID_REQUEST: 'That request was missing something required. Check the input and try again.',
  LEAD_NOT_FOUND: 'This lead is not stored.',
  LINKEDIN_AUTH_ERROR: 'LinkedIn authentication needs attention.',
  LINKEDIN_FORBIDDEN: 'LinkedIn refused the request. The session may need to be renewed.',
  LINKEDIN_RATE_LIMITED: 'LinkedIn rate limit reached. Please try again later.',
  LINKEDIN_PROFILE_NOT_FOUND: 'LinkedIn profile could not be found.',
  LINKEDIN_UPSTREAM_ERROR: 'LinkedIn returned an unexpected response. Try again in a moment.',
  INVALID_EXCEL: 'Please upload a valid Excel file containing a username column.',
  DATABASE_ERROR: 'The database could not complete this request.',
  IMPORT_ERROR: 'The import could not be completed. Try uploading the file again.',
  NETWORK_ERROR: 'Cannot reach the API. Check that the backend is running.',
  REQUEST_TIMEOUT: 'The request took too long. Try again.',
  REQUEST_CANCELLED: 'Request cancelled.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

const KNOWN_CODES = new Set<string>(Object.keys(MESSAGES));

/** Maps a backend error code to the sentence shown to the user. */
export function messageForCode(code: string | null | undefined): string {
  if (typeof code === 'string' && KNOWN_CODES.has(code)) {
    return MESSAGES[code as ApiErrorCode];
  }
  return MESSAGES.UNKNOWN_ERROR;
}

/** True when a backend `message` is safe to surface directly. */
function isSafeToShow(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length === 0 || text.length > 160) return false;
  if (/[\r\n]/.test(text)) return false;
  // Reject anything that smells like a stack trace or internal path.
  if (/\bat\s+\S+\s+\(/.test(text)) return false;
  if (/(^|\s)(\/|[A-Za-z]:\\)\S*(\.js|\.ts|node_modules)/.test(text)) return false;
  if (/\b(Error:|TypeError|ReferenceError|MongoServerError|ValidationError)\b/.test(text)) {
    return false;
  }
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Pulls `{ success: false, error: { code, message } }` out of a response body. */
function readErrorEnvelope(body: unknown): { code: string | null; message: string | null } {
  const root = asRecord(body);
  const error = asRecord(root?.['error']);
  const code = typeof error?.['code'] === 'string' ? (error['code'] as string) : null;
  const message = typeof error?.['message'] === 'string' ? (error['message'] as string) : null;
  return { code, message };
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 404) return 'LEAD_NOT_FOUND';
  if (status === 429) return 'LINKEDIN_RATE_LIMITED';
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 502 || status === 503 || status === 504) return 'LINKEDIN_UPSTREAM_ERROR';
  if (status >= 500) return 'DATABASE_ERROR';
  return 'UNKNOWN_ERROR';
}

/**
 * Converts anything thrown by the API layer into an ApiError.
 *
 * Axios is duck-typed rather than imported so this module stays dependency-free
 * and unit-testable in isolation.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const err = asRecord(error);

  if (err) {
    const transportCode = typeof err['code'] === 'string' ? (err['code'] as string) : '';
    if (transportCode === 'ERR_CANCELED' || err['name'] === 'CanceledError') {
      return new ApiError('REQUEST_CANCELLED', MESSAGES.REQUEST_CANCELLED, null, transportCode);
    }
    if (transportCode === 'ECONNABORTED' || transportCode === 'ETIMEDOUT') {
      return new ApiError('REQUEST_TIMEOUT', MESSAGES.REQUEST_TIMEOUT, null, transportCode);
    }

    const response = asRecord(err['response']);

    if (response) {
      const status = typeof response['status'] === 'number' ? (response['status'] as number) : null;
      const { code, message } = readErrorEnvelope(response['data']);

      if (code && KNOWN_CODES.has(code)) {
        return new ApiError(code as ApiErrorCode, MESSAGES[code as ApiErrorCode], status, code);
      }
      // Unmapped code: prefer the backend's own sentence if it is presentable.
      const fallbackCode = status !== null ? codeForStatus(status) : 'UNKNOWN_ERROR';
      const text = isSafeToShow(message) ? message : MESSAGES[fallbackCode];
      return new ApiError(fallbackCode, text, status, code);
    }

    // A request that never got a response at all.
    if (err['request'] !== undefined || transportCode === 'ERR_NETWORK') {
      return new ApiError('NETWORK_ERROR', MESSAGES.NETWORK_ERROR, null, transportCode || null);
    }
  }

  return new ApiError('UNKNOWN_ERROR', MESSAGES.UNKNOWN_ERROR);
}

/** Convenience for render paths that only need the sentence. */
export function errorMessage(error: unknown): string {
  return toApiError(error).userMessage;
}

/** True when the failure was an aborted request and should not be shown. */
export function isCancelled(error: unknown): boolean {
  return toApiError(error).code === 'REQUEST_CANCELLED';
}

/**
 * Per-row import failures arrive as a bare error code string rather than an
 * envelope, so they get their own short-form label.
 */
export function importRowMessage(code: string | null | undefined): string {
  if (!code) return 'Could not be extracted.';
  if (KNOWN_CODES.has(code)) return MESSAGES[code as ApiErrorCode];
  return isSafeToShow(code) ? code : 'Could not be extracted.';
}
