/**
 * Display formatters. Pure functions, no imports beyond types, so they can be
 * unit tested directly.
 *
 * Guiding rule: absent data returns `null` rather than a placeholder string, so
 * callers can omit the element entirely instead of rendering an empty field.
 */

import type { Experience, ImageAsset, Lead, LinkedInDate } from '../types/lead.ts';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Narrowing helper for `.filter()` over nullable arrays. */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Always hands back an array, so render code never guards for null. */
export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value.filter(isPresent) : [];
}

export function hasItems(value: unknown[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** First value that is a non-empty string, else null. */
export function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined') return trimmed;
    }
  }
  return null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function formatNumber(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value.toLocaleString('en-US');
}

/** "SHE_HER" → "she/her" */
export function formatPronouns(value: string | null | undefined): string | null {
  const raw = firstString(value);
  if (raw === null) return null;
  if (raw.includes('/')) return raw.toLowerCase();
  return raw.toLowerCase().split('_').filter(Boolean).join('/');
}

/* ------------------------------- dates ------------------------------- */

function monthLabel(month: number | null | undefined): string | null {
  if (typeof month !== 'number' || month < 1 || month > 12) return null;
  return MONTHS[month - 1] ?? null;
}

/** { year: 2026, month: 8 } → "Aug 2026"; year only → "2026". */
export function formatLinkedInDate(date: LinkedInDate | null | undefined): string | null {
  if (!date || typeof date.year !== 'number') return null;
  const month = monthLabel(date.month);
  return month ? `${month} ${date.year}` : `${date.year}`;
}

/** "Aug 2026 – Present", "2020 – 2024", or a single date when there is no end. */
export function formatDateRange(
  start: LinkedInDate | null | undefined,
  end: LinkedInDate | null | undefined,
  current?: boolean | null,
): string | null {
  const from = formatLinkedInDate(start);
  const to = formatLinkedInDate(end);

  if (from && to) return `${from} – ${to}`;
  if (from && current === true) return `${from} – Present`;
  if (from) return from;
  if (to) return to;
  return null;
}

function toMonthIndex(date: LinkedInDate): number | null {
  if (typeof date.year !== 'number') return null;
  const month = typeof date.month === 'number' && date.month >= 1 && date.month <= 12
    ? date.month
    : 1;
  return date.year * 12 + (month - 1);
}

/**
 * "1 yr 2 mos". Returns null unless a start year exists, and never guesses an
 * end date for a role that is not marked current.
 */
export function formatDuration(
  start: LinkedInDate | null | undefined,
  end: LinkedInDate | null | undefined,
  current?: boolean | null,
  now: Date = new Date(),
): string | null {
  if (!start) return null;
  const startIndex = toMonthIndex(start);
  if (startIndex === null) return null;

  let endIndex: number | null = end ? toMonthIndex(end) : null;
  if (endIndex === null) {
    if (current !== true) return null;
    endIndex = now.getFullYear() * 12 + now.getMonth();
  }

  const totalMonths = Math.max(0, endIndex - startIndex) + 1;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralize(years, 'yr')}`);
  if (months > 0) parts.push(`${months} ${pluralize(months, 'mo')}`);
  return parts.length > 0 ? parts.join(' ') : '1 mo';
}

function parseDate(iso: string | null | undefined): Date | null {
  if (typeof iso !== 'string' || iso.trim().length === 0) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "just now", "12 min ago", "3 hr ago", "2 days ago", then a calendar date. */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
  const date = parseDate(iso);
  if (!date) return null;

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 45) return 'just now';

  // "min" and "hr" stay invariant — "12 mins ago" reads worse than "12 min ago".
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${pluralize(days, 'day')} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${pluralize(weeks, 'week')} ago`;
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatDateTime(iso: string | null | undefined): string | null {
  const date = parseDate(iso);
  if (!date) return null;
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateOnly(iso: string | null | undefined): string | null {
  const date = parseDate(iso);
  if (!date) return null;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ------------------------------- images ------------------------------ */

/**
 * Picks the best available URL from a LinkedIn image asset.
 *
 * `urls` is keyed by pixel width; we prefer the requested width, then the next
 * largest available. `rootUrl` is deliberately ignored — on its own it is not a
 * complete image URL.
 */
export function bestImageUrl(
  asset: ImageAsset | null | undefined,
  preferredWidth = 800,
): string | null {
  if (!asset) return null;

  const urls = asset.urls;
  if (urls && typeof urls === 'object') {
    const exact = urls[String(preferredWidth)];
    if (typeof exact === 'string' && exact.length > 0) return exact;

    const widths = Object.keys(urls)
      .map((key) => Number.parseInt(key, 10))
      .filter((width) => Number.isFinite(width))
      .sort((a, b) => b - a);

    // Largest at or below the requested width, else simply the largest.
    const atOrBelow = widths.find((width) => width <= preferredWidth);
    const chosen = atOrBelow ?? widths[0];
    if (chosen !== undefined) {
      const candidate = urls[String(chosen)];
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
  }

  return firstString(asset.largeUrl, asset.smallUrl);
}

export function initialsOf(name: string | null | undefined): string {
  const source = firstString(name);
  if (source === null) return '·';
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const a = first ? first.charAt(0) : '';
  const b = last ? last.charAt(0) : '';
  const initials = `${a}${b}`.toUpperCase();
  return initials.length > 0 ? initials : '·';
}

/* -------------------------- lead convenience -------------------------- */

/** Best available display name, falling back to the username. */
export function fullNameOf(lead: Lead | null | undefined): string {
  if (!lead) return 'Unknown lead';
  const profile = lead.profile;
  const composed = [profile?.firstName, profile?.lastName]
    .map((part) => firstString(part))
    .filter(isPresent)
    .join(' ');
  return firstString(profile?.fullName, composed, lead.username) ?? 'Unknown lead';
}

export function headlineOf(lead: Lead | null | undefined): string | null {
  return firstString(lead?.profile?.headline, lead?.profile?.occupation);
}

export function locationOf(lead: Lead | null | undefined): string | null {
  const location = lead?.profile?.location;
  const composed = [location?.city, location?.country]
    .map((part) => firstString(part))
    .filter(isPresent)
    .join(', ');
  return firstString(location?.locationName, composed);
}

export function industryOf(lead: Lead | null | undefined): string | null {
  return firstString(lead?.profile?.industry?.industryName);
}

/** The role flagged `current: true`, if any. */
export function currentRoleOf(lead: Lead | null | undefined): Experience | null {
  return asArray(lead?.experience).find((role) => role.current === true) ?? null;
}

export function previousRolesOf(lead: Lead | null | undefined): Experience[] {
  return asArray(lead?.experience).filter((role) => role.current !== true);
}

/** Current company name, preferring the enriched metadata block. */
export function currentCompanyOf(lead: Lead | null | undefined): string | null {
  return firstString(
    lead?.metadata?.currentCompany?.companyName,
    currentRoleOf(lead)?.companyName,
  );
}

export function currentTitleOf(lead: Lead | null | undefined): string | null {
  return firstString(currentRoleOf(lead)?.title);
}

export function profileImageOf(lead: Lead | null | undefined, width = 400): string | null {
  return bestImageUrl(lead?.profile?.media?.profileImage, width);
}

export function backgroundImageOf(lead: Lead | null | undefined, width = 1400): string | null {
  return bestImageUrl(lead?.profile?.media?.backgroundImage, width);
}
