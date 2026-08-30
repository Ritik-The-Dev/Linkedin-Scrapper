/**
 * src/linkedin/errors.ts
 * Typed error classes thrown by the LinkedIn client and service layer.
 */

export class LinkedInAuthError extends Error {
  readonly code     = 'LINKEDIN_AUTH_ERROR' as const;
  readonly httpStatus = 502;
  constructor(message = 'LinkedIn session credentials are invalid or expired') {
    super(message);
    this.name = 'LinkedInAuthError';
  }
}

export class LinkedInForbiddenError extends Error {
  readonly code     = 'LINKEDIN_FORBIDDEN' as const;
  readonly httpStatus = 502;
  constructor(message = 'LinkedIn access denied — CSRF mismatch, session issue, or profile restriction') {
    super(message);
    this.name = 'LinkedInForbiddenError';
  }
}

export class LinkedInRateLimitError extends Error {
  readonly code     = 'LINKEDIN_RATE_LIMITED' as const;
  readonly httpStatus = 429;
  constructor(message = 'LinkedIn rate limit reached — stop and do not retry') {
    super(message);
    this.name = 'LinkedInRateLimitError';
  }
}

export class LinkedInProfileNotFoundError extends Error {
  readonly code     = 'LINKEDIN_PROFILE_NOT_FOUND' as const;
  readonly httpStatus = 404;
  constructor(username: string) {
    super(`LinkedIn profile not found for username: ${username}`);
    this.name = 'LinkedInProfileNotFoundError';
  }
}

export class LinkedInUpstreamError extends Error {
  readonly code     = 'LINKEDIN_UPSTREAM_ERROR' as const;
  readonly httpStatus = 502;
  constructor(message = 'LinkedIn returned an unexpected response') {
    super(message);
    this.name = 'LinkedInUpstreamError';
  }
}

export class LeadNotFoundError extends Error {
  readonly code     = 'LEAD_NOT_FOUND' as const;
  readonly httpStatus = 404;
  constructor(username: string) {
    super(`Lead not found: ${username}`);
    this.name = 'LeadNotFoundError';
  }
}

export class DatabaseError extends Error {
  readonly code     = 'DATABASE_ERROR' as const;
  readonly httpStatus = 500;
  constructor(message = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class InvalidUsernameError extends Error {
  readonly code     = 'INVALID_USERNAME' as const;
  readonly httpStatus = 400;
  constructor(message = 'Invalid username') {
    super(message);
    this.name = 'InvalidUsernameError';
  }
}

export class InvalidRequestError extends Error {
  readonly code     = 'INVALID_REQUEST' as const;
  readonly httpStatus = 400;
  constructor(message = 'Invalid request') {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

export class InvalidExcelError extends Error {
  readonly code     = 'INVALID_EXCEL' as const;
  readonly httpStatus = 400;
  constructor(message = 'Invalid Excel file') {
    super(message);
    this.name = 'InvalidExcelError';
  }
}

export class ImportError extends Error {
  readonly code     = 'IMPORT_ERROR' as const;
  readonly httpStatus = 500;
  constructor(message = 'Import process failed') {
    super(message);
    this.name = 'ImportError';
  }
}

/** Union of all typed app errors */
export type AppError =
  | LinkedInAuthError
  | LinkedInForbiddenError
  | LinkedInRateLimitError
  | LinkedInProfileNotFoundError
  | LinkedInUpstreamError
  | LeadNotFoundError
  | DatabaseError
  | InvalidUsernameError
  | InvalidRequestError
  | InvalidExcelError
  | ImportError;

/** Type guard: check if an unknown error is one of our typed app errors */
export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof LinkedInAuthError         ||
    err instanceof LinkedInForbiddenError    ||
    err instanceof LinkedInRateLimitError    ||
    err instanceof LinkedInProfileNotFoundError ||
    err instanceof LinkedInUpstreamError     ||
    err instanceof LeadNotFoundError         ||
    err instanceof DatabaseError             ||
    err instanceof InvalidUsernameError      ||
    err instanceof InvalidRequestError       ||
    err instanceof InvalidExcelError         ||
    err instanceof ImportError
  );
}
