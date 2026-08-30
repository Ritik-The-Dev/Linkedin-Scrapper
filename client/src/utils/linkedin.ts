/**
 * LinkedIn URL → public username extraction.
 *
 * This is the frontend's one real responsibility in the contract: the backend
 * must only ever receive `{ "username": "<slug>" }`, never a full URL.
 *
 * Hyphens are part of the slug and are always preserved:
 *   linkedin.com/in/ritik-sde  →  ritik-sde
 *   linkedin.com/in/ritik-joshi        →  ritik-joshi
 *
 * The extraction logic below is pure, so it can be unit tested in isolation; the
 * only imports are the equally pure URL/type helpers used by `profileUrlOf`.
 */

import type { Lead } from '../types/lead.ts';
import { safeUrl } from './entity.ts';

/** Reserved by the API's route table — see docs/api-spec.md. */
const RESERVED_USERNAMES: ReadonlySet<string> = new Set(['search', 'import', 'stats']);

/** Allowed characters per docs/api-spec.md: a–z, 0–9, dot, hyphen, underscore. */
const VALID_USERNAME = /^[a-z0-9._-]+$/;

const MAX_USERNAME_LENGTH = 100;

/** Path segments that introduce a member profile slug. */
const PROFILE_SEGMENTS: ReadonlySet<string> = new Set(['in', 'pub']);

/** First path segments that mean "this is not a member profile". */
const NON_PROFILE_SEGMENTS: Record<string, string> = {
  company: 'company',
  school: 'school',
  showcase: 'showcase',
  posts: 'post',
  feed: 'feed',
  jobs: 'jobs',
  groups: 'group',
  learning: 'Learning',
  pulse: 'article',
  events: 'event',
  newsletters: 'newsletter',
  mynetwork: 'network',
  services: 'services',
  sales: 'Sales Navigator',
  talent: 'Recruiter',
};

export type UsernameFailureReason =
  | 'empty'
  | 'missing_slug'
  | 'not_profile_url'
  | 'invalid_chars'
  | 'too_long'
  | 'reserved';

export interface UsernameSuccess {
  ok: true;
  /** The bare slug, lowercased. This is what goes to the backend. */
  username: string;
  /** True when the input was a URL rather than a bare username. */
  wasUrl: boolean;
}

export interface UsernameFailure {
  ok: false;
  reason: UsernameFailureReason;
  /** Ready to render; explains what to do next rather than just what broke. */
  message: string;
}

export type UsernameResult = UsernameSuccess | UsernameFailure;

function fail(reason: UsernameFailureReason, message: string): UsernameFailure {
  return { ok: false, reason, message };
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Strips wrapping punctuation that survives a copy out of chat, email or prose —
 * `<https://…>` is what Slack and most mail clients hand over.
 *
 * This runs on the raw input rather than on the extracted slug, so that the
 * leading bracket cannot hide the hostname from the LinkedIn check below.
 */
function unwrap(value: string): string {
  return value
    .replace(/^[<("'“‘]+/, '')
    .replace(/[>)"'”’]+$/, '')
    .trim();
}

type SlugResult = { ok: true; slug: string } | UsernameFailure;

function slugFromUrlLike(input: string): SlugResult {
  let working = input.replace(/\\/g, '/').trim();

  // Drop scheme, then query string and fragment.
  working = working.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const pathOnly = working.split(/[?#]/)[0] ?? '';

  const segments = pathOnly.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return fail('missing_slug', 'That URL does not contain a profile username.');
  }

  const first = segments[0] ?? '';
  const isHost = first.includes('.');

  if (isHost) {
    const host = first.replace(/:\d+$/, '').toLowerCase();
    if (!/(^|\.)linkedin\.com$/.test(host)) {
      return fail(
        'not_profile_url',
        'That is not a LinkedIn URL. Paste a profile link like linkedin.com/in/username.',
      );
    }
  }

  const path = isHost ? segments.slice(1) : segments;
  const head = (path[0] ?? '').toLowerCase();

  // A company, school or post URL never yields a member username.
  const sectionLabel = NON_PROFILE_SEGMENTS[head];
  if (sectionLabel !== undefined) {
    return fail(
      'not_profile_url',
      `That is a LinkedIn ${sectionLabel} page. Paste a personal profile URL like linkedin.com/in/username.`,
    );
  }

  const markerIndex = path.findIndex((segment) => PROFILE_SEGMENTS.has(segment.toLowerCase()));

  if (markerIndex === -1) {
    // A bare username that happens to carry a trailing slash, e.g. "ritikjoshi/".
    const only = path[0];
    if (!isHost && path.length === 1 && only !== undefined) {
      return { ok: true, slug: only };
    }
    return fail(
      'not_profile_url',
      'Use a profile URL containing /in/, or paste the username on its own.',
    );
  }

  const slug = path[markerIndex + 1];
  if (slug === undefined || slug.length === 0) {
    return fail('missing_slug', 'Add the profile username after /in/.');
  }

  return { ok: true, slug };
}

/**
 * Normalises anything a user might paste into a backend-ready username.
 *
 * Accepts a full profile URL, a bare host-relative path, or the username alone.
 * Returns a discriminated result so callers can show a specific message instead
 * of a generic "invalid input".
 */
export function normalizeLinkedInInput(input: string): UsernameResult {
  const raw = unwrap(typeof input === 'string' ? input.trim() : '');
  if (raw.length === 0) {
    return fail('empty', 'Enter a LinkedIn profile URL or username.');
  }

  const wasUrl = /linkedin\.com/i.test(raw) || raw.includes('/') || raw.includes('\\');

  let candidate = raw;
  if (wasUrl) {
    const extracted = slugFromUrlLike(raw);
    if (!extracted.ok) return extracted;
    candidate = extracted.slug;
  }

  candidate = decodeOnce(candidate.replace(/^@+/, ''))
    .trim()
    .toLowerCase()
    // Punctuation that comes along when copying from prose or chat.
    .replace(/^[('"“‘]+/, '')
    .replace(/[)'"”’,;:.]+$/, '');

  if (candidate.length === 0) {
    return fail(
      wasUrl ? 'missing_slug' : 'empty',
      'That input does not contain a LinkedIn username.',
    );
  }

  if (candidate.length > MAX_USERNAME_LENGTH) {
    return fail('too_long', 'A LinkedIn username cannot be longer than 100 characters.');
  }

  if (!VALID_USERNAME.test(candidate)) {
    return fail(
      'invalid_chars',
      'A username can only contain letters, numbers, dots, hyphens and underscores.',
    );
  }

  if (RESERVED_USERNAMES.has(candidate)) {
    return fail('reserved', `"${candidate}" is reserved by the API and cannot be used.`);
  }

  return { ok: true, username: candidate, wasUrl };
}

/** Returns the username, or null when the input cannot yield one. */
export function extractUsername(input: string): string | null {
  const result = normalizeLinkedInInput(input);
  return result.ok ? result.username : null;
}

/** Canonical public profile URL, used when the stored document has none. */
export function profileUrlFor(username: string): string {
  return `https://www.linkedin.com/in/${username}/`;
}

/**
 * The URL "View LinkedIn Profile" should open.
 *
 * The backend's own `profile.identity.profileUrl` wins when it is present and a
 * real http(s) URL; the canonical form is only a fallback, since a stored
 * profile may have been renamed on LinkedIn since it was captured.
 */
export function profileUrlOf(lead: Lead | null | undefined): string {
  const stored = safeUrl(lead?.profile?.identity?.profileUrl);
  if (stored !== null) return stored;
  const username = typeof lead?.username === 'string' ? lead.username.trim() : '';
  return username.length > 0 ? profileUrlFor(username) : 'https://www.linkedin.com/';
}

/** True when the text mentions a LinkedIn host or contains a path separator. */
export function looksLikeLinkedInUrl(input: string): boolean {
  return /linkedin\.com/i.test(input) || input.includes('/');
}

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.trim().toLowerCase());
}
