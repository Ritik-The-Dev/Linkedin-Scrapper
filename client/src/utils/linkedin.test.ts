import { describe, expect, it } from 'vitest';

import type { Lead } from '../types/lead.ts';
import {
  extractUsername,
  isReservedUsername,
  looksLikeLinkedInUrl,
  normalizeLinkedInInput,
  profileUrlFor,
  profileUrlOf,
} from './linkedin.ts';

/** Asserts a successful parse and hands back the username. */
function ok(input: string): string {
  const result = normalizeLinkedInInput(input);
  expect(result.ok, `expected "${input}" to parse, got ${JSON.stringify(result)}`).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.username;
}

/** Asserts a failed parse and hands back the reason. */
function reasonFor(input: string): string {
  const result = normalizeLinkedInInput(input);
  expect(result.ok, `expected "${input}" to be rejected`).toBe(false);
  if (result.ok) throw new Error('unreachable');
  // Every rejection must carry something showable, not just a code.
  expect(result.message.length).toBeGreaterThan(0);
  return result.reason;
}

describe('normalizeLinkedInInput — full URLs', () => {
  it('extracts the slug from a canonical profile URL', () => {
    expect(ok('https://www.linkedin.com/in/ritik-sde')).toBe('ritik-sde');
  });

  it('tolerates a trailing slash', () => {
    expect(ok('https://www.linkedin.com/in/ritik-sde/')).toBe('ritik-sde');
  });

  it('drops query strings and tracking parameters', () => {
    expect(ok('https://www.linkedin.com/in/ritik-sde/?originalSubdomain=in')).toBe(
      'ritik-sde',
    );
    expect(ok('https://linkedin.com/in/john-doe?trk=public_profile_browsemap')).toBe('john-doe');
  });

  it('drops hash fragments', () => {
    expect(ok('https://www.linkedin.com/in/john-doe#experience')).toBe('john-doe');
  });

  it('accepts a bare host without a scheme', () => {
    expect(ok('www.linkedin.com/in/john-doe')).toBe('john-doe');
    expect(ok('linkedin.com/in/john-doe')).toBe('john-doe');
  });

  it('accepts http and regional subdomains', () => {
    expect(ok('http://linkedin.com/in/john-doe')).toBe('john-doe');
    expect(ok('https://in.linkedin.com/in/john-doe')).toBe('john-doe');
    expect(ok('https://uk.linkedin.com/in/john-doe/')).toBe('john-doe');
  });

  it('accepts the legacy /pub/ path', () => {
    expect(ok('https://www.linkedin.com/pub/john-doe')).toBe('john-doe');
  });

  it('ignores locale segments and trailing path noise', () => {
    expect(ok('https://www.linkedin.com/in/john-doe/en')).toBe('john-doe');
    expect(ok('https://www.linkedin.com/in/john-doe/detail/contact-info/')).toBe('john-doe');
  });

  it('lowercases the slug, since the backend key is lowercase', () => {
    expect(ok('https://www.linkedin.com/in/ritik-sde')).toBe('ritik-sde');
  });

  it('trims whitespace and the brackets a chat client wraps a link in', () => {
    expect(ok('  https://www.linkedin.com/in/john-doe/  ')).toBe('john-doe');
    expect(ok('<https://www.linkedin.com/in/john-doe>')).toBe('john-doe');
    expect(ok('"https://www.linkedin.com/in/john-doe"')).toBe('john-doe');
  });

  it('still checks the host after unwrapping brackets', () => {
    // Regression: the leading "<" used to hide the hostname from the check.
    expect(reasonFor('<https://twitter.com/in/john-doe>')).toBe('not_profile_url');
  });

  it('decodes a percent-encoded slug', () => {
    expect(ok('https://www.linkedin.com/in/john%2Ddoe')).toBe('john-doe');
  });

  it('accepts backslashes, which Windows copies sometimes introduce', () => {
    expect(ok('https:\\\\www.linkedin.com\\in\\john-doe')).toBe('john-doe');
  });

  it('reports whether the input was a URL', () => {
    const url = normalizeLinkedInInput('https://www.linkedin.com/in/john-doe');
    const bare = normalizeLinkedInInput('john-doe');
    expect(url.ok && url.wasUrl).toBe(true);
    expect(bare.ok && bare.wasUrl).toBe(false);
  });
});

describe('normalizeLinkedInInput — bare usernames', () => {
  it('accepts a plain username unchanged', () => {
    expect(ok('ritik-sde')).toBe('ritik-sde');
  });

  it('preserves every hyphen — the username is the backend primary key', () => {
    // The spec's example table shows `ritik-joshi` losing its hyphen, which
    // contradicts the `ritik-sde` row directly above it. The API
    // contract allows `-`, so the slug is passed through byte for byte.
    expect(ok('https://linkedin.com/in/ritik-joshi/')).toBe('ritik-joshi');
    expect(ok('ritik-joshi')).toBe('ritik-joshi');
  });

  it('accepts dots, underscores and digits', () => {
    expect(ok('john.doe_42')).toBe('john.doe_42');
  });

  it('lowercases a bare username', () => {
    expect(ok('John-Doe')).toBe('john-doe');
  });

  it('accepts an @-prefixed handle', () => {
    expect(ok('@john-doe')).toBe('john-doe');
  });

  it('accepts a bare /in/slug path', () => {
    expect(ok('/in/john-doe')).toBe('john-doe');
    expect(ok('in/john-doe')).toBe('john-doe');
  });

  it('accepts a username with a stray trailing slash', () => {
    expect(ok('john-doe/')).toBe('john-doe');
  });

  it('drops sentence punctuation carried in from prose', () => {
    expect(ok('john-doe.')).toBe('john-doe');
    expect(ok('john-doe,')).toBe('john-doe');
  });
});

describe('normalizeLinkedInInput — rejections', () => {
  it('rejects empty input', () => {
    expect(reasonFor('')).toBe('empty');
    expect(reasonFor('   ')).toBe('empty');
  });

  it('rejects a LinkedIn URL with no slug', () => {
    expect(reasonFor('https://www.linkedin.com/in/')).toBe('missing_slug');
    expect(reasonFor('https://www.linkedin.com/in')).toBe('missing_slug');
  });

  it('rejects LinkedIn URLs that are not member profiles', () => {
    expect(reasonFor('https://www.linkedin.com/company/anthropic')).toBe('not_profile_url');
    expect(reasonFor('https://www.linkedin.com/school/mit')).toBe('not_profile_url');
    expect(reasonFor('https://www.linkedin.com/feed/')).toBe('not_profile_url');
    expect(reasonFor('https://www.linkedin.com/jobs/view/123456')).toBe('not_profile_url');
  });

  it('names the section it found, so the message is actionable', () => {
    const result = normalizeLinkedInInput('https://www.linkedin.com/company/anthropic');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.message).toContain('company');
  });

  it('rejects a non-LinkedIn URL', () => {
    expect(reasonFor('https://twitter.com/in/john-doe')).toBe('not_profile_url');
    expect(reasonFor('https://example.com/john-doe')).toBe('not_profile_url');
  });

  it('rejects a path that is neither a profile URL nor a username', () => {
    expect(reasonFor('john/doe')).toBe('not_profile_url');
  });

  it('rejects characters that cannot appear in a slug', () => {
    expect(reasonFor('john doe')).toBe('invalid_chars');
    expect(reasonFor('john@doe.com')).toBe('invalid_chars');
    expect(reasonFor('जॉन-डो')).toBe('invalid_chars');
    expect(reasonFor('john+doe')).toBe('invalid_chars');
  });

  it('rejects a slug longer than the API allows', () => {
    expect(reasonFor('a'.repeat(101))).toBe('too_long');
    expect(ok('a'.repeat(100))).toBe('a'.repeat(100));
  });

  it('rejects usernames that would collide with a sub-route', () => {
    // GET /api/leads/search and /stats are real endpoints, so a lead called
    // "search" could never be fetched back — it is refused up front.
    expect(reasonFor('search')).toBe('reserved');
    expect(reasonFor('stats')).toBe('reserved');
    expect(reasonFor('import')).toBe('reserved');
    expect(reasonFor('https://www.linkedin.com/in/search')).toBe('reserved');
  });
});

describe('extractUsername', () => {
  it('returns the username or null, for callers that do not need a reason', () => {
    expect(extractUsername('https://www.linkedin.com/in/john-doe/')).toBe('john-doe');
    expect(extractUsername('john doe')).toBeNull();
    expect(extractUsername('')).toBeNull();
  });
});

describe('looksLikeLinkedInUrl', () => {
  it('is true for anything URL-shaped or LinkedIn-hosted', () => {
    expect(looksLikeLinkedInUrl('https://www.linkedin.com/in/john-doe')).toBe(true);
    expect(looksLikeLinkedInUrl('linkedin.com/company/anthropic')).toBe(true);
    expect(looksLikeLinkedInUrl('/in/john-doe')).toBe(true);
  });

  it('is false for a bare username', () => {
    expect(looksLikeLinkedInUrl('john-doe')).toBe(false);
    expect(looksLikeLinkedInUrl('')).toBe(false);
  });
});

describe('isReservedUsername', () => {
  it('flags the endpoint names, case-insensitively', () => {
    expect(isReservedUsername('search')).toBe(true);
    expect(isReservedUsername('STATS')).toBe(true);
    expect(isReservedUsername(' import ')).toBe(true);
    expect(isReservedUsername('john-doe')).toBe(false);
  });
});

describe('profileUrlFor', () => {
  it('builds the canonical public profile URL', () => {
    expect(profileUrlFor('john-doe')).toBe('https://www.linkedin.com/in/john-doe/');
  });
});

describe('profileUrlOf', () => {
  const lead = (over: Partial<Lead> = {}): Lead => ({
    _id: '507f1f77bcf86cd799439011',
    username: 'john-doe',
    ...over,
  });

  it('prefers the URL the backend stored', () => {
    const stored = lead({
      profile: { identity: { profileUrl: 'https://www.linkedin.com/in/renamed-slug/' } },
    });
    expect(profileUrlOf(stored)).toBe('https://www.linkedin.com/in/renamed-slug/');
  });

  it('falls back to the username when no URL was stored', () => {
    expect(profileUrlOf(lead())).toBe('https://www.linkedin.com/in/john-doe/');
    expect(profileUrlOf(lead({ profile: { identity: { profileUrl: null } } }))).toBe(
      'https://www.linkedin.com/in/john-doe/',
    );
  });

  it('ignores a stored value that is not an http(s) URL', () => {
    const hostile = lead({
      profile: { identity: { profileUrl: 'javascript:alert(1)' } },
    });
    expect(profileUrlOf(hostile)).toBe('https://www.linkedin.com/in/john-doe/');
  });

  it('never returns null, so the link is always safe to render', () => {
    expect(profileUrlOf(null)).toBe('https://www.linkedin.com/');
    expect(profileUrlOf(undefined)).toBe('https://www.linkedin.com/');
    expect(profileUrlOf(lead({ username: '   ' }))).toBe('https://www.linkedin.com/');
  });
});
