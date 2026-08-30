/**
 * Tolerant readers for the loosely specified profile arrays.
 *
 * docs/data-model.md documents `certifications`, `languages`, `courses`,
 * `publications`, `honors`, `volunteerExperience`, `patents` and
 * `organizations` as "resolved entities" but does not pin their field names —
 * they arrive as empty arrays in the v1 sample. Rather than guess one name and
 * render blanks for everything else, each renderer asks for a list of likely
 * aliases and takes the first that holds a usable value.
 *
 * Pure functions, no React, so they are unit testable.
 */

import type { LinkedInDate } from '../types/lead.ts';
import { firstString } from './formatters.ts';

export type UnknownRecord = Record<string, unknown>;

/**
 * Callers pass whole entities of many different shapes, so these helpers accept
 * `unknown` and narrow here. That keeps every call site free of casts.
 */
function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

/** First alias holding a non-empty string. */
export function fieldString(record: unknown, keys: readonly string[]): string | null {
  const source = asRecord(record);
  for (const key of keys) {
    const value = firstString(source[key]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * First alias holding a link we are willing to put in an `href`.
 *
 * Only http(s) survives: these strings come from a remote payload, and
 * `javascript:` in an href would be a script injection.
 */
export function fieldUrl(record: unknown, keys: readonly string[]): string | null {
  const source = asRecord(record);
  for (const key of keys) {
    const candidate = safeUrl(source[key]);
    if (candidate !== null) return candidate;
  }
  return null;
}

export function safeUrl(value: unknown): string | null {
  const raw = firstString(value);
  if (raw === null) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.hostname.length === 0) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Hostname without `www.`, for a compact link label. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** "2024", "2024-06", "2024-06-01T00:00:00Z" → LinkedInDate. */
function parseDateish(raw: string): LinkedInDate | null {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(raw.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(year)) return null;
  const month = match[2] === undefined ? null : Number.parseInt(match[2], 10);
  const day = match[3] === undefined ? null : Number.parseInt(match[3], 10);
  return {
    year,
    month: month !== null && month >= 1 && month <= 12 ? month : null,
    day: day !== null && day >= 1 && day <= 31 ? day : null,
  };
}

/**
 * First alias holding something date-shaped. Accepts the documented
 * `{ year, month, day }` object, a bare year number, or an ISO-ish string.
 */
export function fieldDate(record: unknown, keys: readonly string[]): LinkedInDate | null {
  const source = asRecord(record);
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined) continue;

    const asNumber = numberOrNull(raw);
    if (asNumber !== null && asNumber > 1000 && asNumber < 3000) {
      return { year: asNumber, month: null, day: null };
    }

    if (typeof raw === 'string') {
      const parsed = parseDateish(raw);
      if (parsed !== null) return parsed;
      continue;
    }

    if (typeof raw === 'object') {
      const candidate = raw as Partial<LinkedInDate>;
      const year = numberOrNull(candidate.year);
      if (year !== null) {
        return { year, month: numberOrNull(candidate.month), day: numberOrNull(candidate.day) };
      }
    }
  }
  return null;
}

/** First alias holding a list of strings (contributors, authors, causes…). */
export function fieldStringList(record: unknown, keys: readonly string[]): string[] {
  const source = asRecord(record);
  for (const key of keys) {
    const raw = source[key];
    if (Array.isArray(raw)) {
      const items = raw.map((entry) => firstString(entry)).filter((entry): entry is string => entry !== null);
      if (items.length > 0) return items;
    } else {
      const single = firstString(raw);
      if (single !== null) return [single];
    }
  }
  return [];
}

/**
 * Stable list key. Entity URNs are the natural identity but are not guaranteed
 * to be present, so the label and index back it up.
 */
export function entityKey(record: unknown, label: string | null, index: number): string {
  const urn = fieldString(record, ['entityUrn', 'urn', 'id', '_id']);
  return urn ?? `${label ?? 'item'}-${index}`;
}
