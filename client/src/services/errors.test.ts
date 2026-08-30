import { describe, expect, it } from 'vitest';

import {
  ApiError,
  errorMessage,
  importRowMessage,
  isCancelled,
  messageForCode,
  toApiError,
} from './errors.ts';

/** Shape of an axios error with a response, without importing axios. */
function httpError(status: number, data: unknown): unknown {
  return { name: 'AxiosError', message: `Request failed with status code ${status}`, response: { status, data } };
}

function envelope(code: string, message?: string): unknown {
  return { success: false, error: { code, ...(message === undefined ? {} : { message }) } };
}

describe('messageForCode', () => {
  it('maps every documented code to its own sentence', () => {
    expect(messageForCode('LEAD_NOT_FOUND')).toBe('This lead is not stored.');
    expect(messageForCode('LINKEDIN_RATE_LIMITED')).toContain('rate limit');
    expect(messageForCode('INVALID_EXCEL')).toContain('Excel');
  });

  it('falls back for an unknown, absent or non-string code', () => {
    const fallback = messageForCode('UNKNOWN_ERROR');
    expect(messageForCode('SOMETHING_NEW')).toBe(fallback);
    expect(messageForCode(null)).toBe(fallback);
    expect(messageForCode(undefined)).toBe(fallback);
  });
});

describe('toApiError — recognised backend codes', () => {
  it('uses our own copy, not the backend sentence', () => {
    const error = toApiError(
      httpError(404, envelope('LEAD_NOT_FOUND', 'Lead not found in collection leads')),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('LEAD_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.userMessage).toBe('This lead is not stored.');
    expect(error.rawCode).toBe('LEAD_NOT_FOUND');
  });

  it('carries the code through for each documented failure', () => {
    expect(toApiError(httpError(400, envelope('INVALID_USERNAME'))).code).toBe('INVALID_USERNAME');
    expect(toApiError(httpError(429, envelope('LINKEDIN_RATE_LIMITED'))).code).toBe(
      'LINKEDIN_RATE_LIMITED',
    );
    expect(toApiError(httpError(502, envelope('LINKEDIN_UPSTREAM_ERROR'))).code).toBe(
      'LINKEDIN_UPSTREAM_ERROR',
    );
    expect(toApiError(httpError(500, envelope('DATABASE_ERROR'))).code).toBe('DATABASE_ERROR');
  });

  it('sets the message on the Error itself, so logs read properly', () => {
    const error = toApiError(httpError(404, envelope('LEAD_NOT_FOUND')));
    expect(error.message).toBe(error.userMessage);
    expect(error.name).toBe('ApiError');
  });
});

describe('toApiError — unmapped codes and stack traces', () => {
  it('infers a code from the status when the body has none', () => {
    expect(toApiError(httpError(404, {})).code).toBe('LEAD_NOT_FOUND');
    expect(toApiError(httpError(400, {})).code).toBe('INVALID_REQUEST');
    expect(toApiError(httpError(429, {})).code).toBe('LINKEDIN_RATE_LIMITED');
    expect(toApiError(httpError(503, {})).code).toBe('LINKEDIN_UPSTREAM_ERROR');
    expect(toApiError(httpError(500, {})).code).toBe('DATABASE_ERROR');
    expect(toApiError(httpError(418, {})).code).toBe('UNKNOWN_ERROR');
  });

  it('shows an unmapped backend sentence when it is short and clean', () => {
    const error = toApiError(
      httpError(422, envelope('SOME_NEW_CODE', 'Row 4 has no username column.')),
    );
    expect(error.userMessage).toBe('Row 4 has no username column.');
    // The unrecognised code is still kept for logging.
    expect(error.rawCode).toBe('SOME_NEW_CODE');
  });

  it('refuses a message containing a stack frame', () => {
    const trace = 'at Object.<anonymous> (/app/src/services/linkedin.js:42:15)';
    const error = toApiError(httpError(500, envelope('X', trace)));
    expect(error.userMessage).not.toContain('at Object');
    expect(error.userMessage).toBe('The database could not complete this request.');
  });

  it('refuses a message naming an internal file path', () => {
    const error = toApiError(
      httpError(500, envelope('X', 'Failure in /app/node_modules/mongoose/index.js')),
    );
    expect(error.userMessage).not.toContain('node_modules');
  });

  it('refuses a message that is really an exception name', () => {
    expect(toApiError(httpError(500, envelope('X', 'MongoServerError: E11000 duplicate key'))).userMessage)
      .toBe('The database could not complete this request.');
    expect(toApiError(httpError(500, envelope('X', 'TypeError: cannot read x of undefined'))).userMessage)
      .toBe('The database could not complete this request.');
  });

  it('refuses a multi-line or overlong message', () => {
    const generic = 'The database could not complete this request.';
    expect(toApiError(httpError(500, envelope('X', 'line one\nline two'))).userMessage).toBe(generic);
    expect(toApiError(httpError(500, envelope('X', 'x'.repeat(161)))).userMessage).toBe(generic);
  });

  it('survives a body that is not an envelope at all', () => {
    expect(toApiError(httpError(500, '<html>502 Bad Gateway</html>')).code).toBe('DATABASE_ERROR');
    expect(toApiError(httpError(500, null)).code).toBe('DATABASE_ERROR');
    expect(toApiError(httpError(500, { error: 'a string, not an object' })).code).toBe(
      'DATABASE_ERROR',
    );
  });
});

describe('toApiError — transport failures', () => {
  it('recognises an aborted request', () => {
    expect(toApiError({ code: 'ERR_CANCELED' }).code).toBe('REQUEST_CANCELLED');
    expect(toApiError({ name: 'CanceledError' }).code).toBe('REQUEST_CANCELLED');
  });

  it('recognises a timeout', () => {
    expect(toApiError({ code: 'ECONNABORTED' }).code).toBe('REQUEST_TIMEOUT');
    expect(toApiError({ code: 'ETIMEDOUT' }).code).toBe('REQUEST_TIMEOUT');
  });

  it('recognises a request that never got a response', () => {
    expect(toApiError({ code: 'ERR_NETWORK' }).code).toBe('NETWORK_ERROR');
    expect(toApiError({ request: {} }).code).toBe('NETWORK_ERROR');
    expect(toApiError({ request: {} }).userMessage).toContain('backend is running');
  });

  it('reports no HTTP status for a transport failure', () => {
    expect(toApiError({ code: 'ERR_NETWORK' }).status).toBeNull();
  });

  it('falls back to UNKNOWN_ERROR for anything else thrown', () => {
    expect(toApiError(new Error('boom')).code).toBe('UNKNOWN_ERROR');
    expect(toApiError('a bare string').code).toBe('UNKNOWN_ERROR');
    expect(toApiError(null).code).toBe('UNKNOWN_ERROR');
    expect(toApiError(undefined).code).toBe('UNKNOWN_ERROR');
  });

  it('never leaks a thrown Error message into the UI', () => {
    const error = toApiError(new Error('connect ECONNREFUSED 127.0.0.1:5000'));
    expect(error.userMessage).toBe('Something went wrong. Please try again.');
  });

  it('passes an existing ApiError straight through', () => {
    const original = new ApiError('LEAD_NOT_FOUND', 'This lead is not stored.', 404);
    expect(toApiError(original)).toBe(original);
  });
});

describe('errorMessage', () => {
  it('is the sentence render paths can use directly', () => {
    expect(errorMessage(httpError(404, envelope('LEAD_NOT_FOUND')))).toBe('This lead is not stored.');
    expect(errorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});

describe('isCancelled', () => {
  it('is true only for an aborted request', () => {
    expect(isCancelled({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isCancelled({ name: 'CanceledError' })).toBe(true);
    expect(isCancelled(httpError(404, envelope('LEAD_NOT_FOUND')))).toBe(false);
    expect(isCancelled(new Error('boom'))).toBe(false);
  });
});

describe('importRowMessage', () => {
  it('expands a known code into its sentence', () => {
    expect(importRowMessage('LINKEDIN_PROFILE_NOT_FOUND')).toBe(
      'LinkedIn profile could not be found.',
    );
    expect(importRowMessage('INVALID_USERNAME')).toContain('valid LinkedIn username');
  });

  it('shows an unknown code as-is when it is presentable', () => {
    expect(importRowMessage('ROW_MISSING_USERNAME')).toBe('ROW_MISSING_USERNAME');
  });

  it('replaces an absent reason with a short label, never a blank cell', () => {
    expect(importRowMessage(null)).toBe('Could not be extracted.');
    expect(importRowMessage(undefined)).toBe('Could not be extracted.');
    expect(importRowMessage('')).toBe('Could not be extracted.');
  });

  it('does not print a stack trace into a table cell', () => {
    expect(importRowMessage('at parseRow (/app/src/import.js:12:3)')).toBe(
      'Could not be extracted.',
    );
  });
});
