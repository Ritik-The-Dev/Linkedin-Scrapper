import { describe, expect, it } from 'vitest';

import type { Lead } from '../types/lead.ts';
import {
  asArray,
  bestImageUrl,
  currentCompanyOf,
  currentRoleOf,
  currentTitleOf,
  firstString,
  formatDateRange,
  formatDuration,
  formatLinkedInDate,
  formatNumber,
  formatPronouns,
  fullNameOf,
  hasItems,
  headlineOf,
  industryOf,
  initialsOf,
  isPresent,
  locationOf,
  pluralize,
  previousRolesOf,
  profileImageOf,
  relativeTime,
  truncate,
} from './formatters.ts';

const lead = (over: Partial<Lead> = {}): Lead => ({
  _id: '507f1f77bcf86cd799439011',
  username: 'john-doe',
  ...over,
});

describe('isPresent / asArray / hasItems', () => {
  it('treats null and undefined as absent, but keeps falsy values', () => {
    expect(isPresent(null)).toBe(false);
    expect(isPresent(undefined)).toBe(false);
    expect(isPresent(0)).toBe(true);
    expect(isPresent('')).toBe(true);
  });

  it('always yields an array, dropping holes', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray([1, null, 2, undefined])).toEqual([1, 2]);
  });

  it('reports whether there is anything to render', () => {
    expect(hasItems(null)).toBe(false);
    expect(hasItems([])).toBe(false);
    expect(hasItems([1])).toBe(true);
  });
});

describe('firstString', () => {
  it('returns the first usable string, trimmed', () => {
    expect(firstString(null, undefined, '  Ada  ', 'Grace')).toBe('Ada');
  });

  it('skips blanks and the strings "null" / "undefined"', () => {
    // A stringified null in a payload is absent data, not a name.
    expect(firstString('', '   ', 'null', 'undefined', 'Ada')).toBe('Ada');
  });

  it('ignores non-strings and returns null when nothing is usable', () => {
    expect(firstString(42, {}, [], null)).toBeNull();
    expect(firstString()).toBeNull();
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('Ada Lovelace', 20)).toBe('Ada Lovelace');
    expect(truncate('exact', 5)).toBe('exact');
  });

  it('adds a single ellipsis character and trims the seam', () => {
    expect(truncate('Ada Lovelace', 5)).toBe('Ada…');
    expect(truncate('abcdefgh', 4)).toBe('abc…');
  });
});

describe('pluralize', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'lead')).toBe('lead');
    expect(pluralize(0, 'lead')).toBe('leads');
    expect(pluralize(2, 'lead')).toBe('leads');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'company', 'companies')).toBe('companies');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
  });

  it('returns null rather than a placeholder for absent or broken values', () => {
    expect(formatNumber(null)).toBeNull();
    expect(formatNumber(undefined)).toBeNull();
    expect(formatNumber(Number.NaN)).toBeNull();
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatPronouns', () => {
  it('turns the LinkedIn enum into readable pronouns', () => {
    expect(formatPronouns('SHE_HER')).toBe('she/her');
    expect(formatPronouns('THEY_THEM')).toBe('they/them');
  });

  it('passes through a value that is already slashed', () => {
    expect(formatPronouns('He/Him')).toBe('he/him');
  });

  it('returns null when unset', () => {
    expect(formatPronouns(null)).toBeNull();
    expect(formatPronouns('  ')).toBeNull();
  });
});

describe('formatLinkedInDate', () => {
  it('renders month and year, or year alone', () => {
    expect(formatLinkedInDate({ year: 2026, month: 8, day: null })).toBe('Aug 2026');
    expect(formatLinkedInDate({ year: 2026, month: null, day: null })).toBe('2026');
  });

  it('ignores an out-of-range month instead of throwing', () => {
    expect(formatLinkedInDate({ year: 2026, month: 0, day: null })).toBe('2026');
    expect(formatLinkedInDate({ year: 2026, month: 13, day: null })).toBe('2026');
  });

  it('returns null without a year', () => {
    expect(formatLinkedInDate(null)).toBeNull();
    expect(formatLinkedInDate({ year: null, month: 8, day: null })).toBeNull();
  });
});

describe('formatDateRange', () => {
  const start = { year: 2022, month: 3, day: null };
  const end = { year: 2024, month: 6, day: null };

  it('joins both ends with an en dash', () => {
    expect(formatDateRange(start, end)).toBe('Mar 2022 – Jun 2024');
  });

  it('says Present only for a role explicitly marked current', () => {
    expect(formatDateRange(start, null, true)).toBe('Mar 2022 – Present');
    // `current` is null/unknown: do not claim the role is ongoing.
    expect(formatDateRange(start, null, null)).toBe('Mar 2022');
    expect(formatDateRange(start, null)).toBe('Mar 2022');
  });

  it('falls back to whichever end exists', () => {
    expect(formatDateRange(null, end)).toBe('Jun 2024');
    expect(formatDateRange(null, null)).toBeNull();
  });
});

describe('formatDuration', () => {
  const now = new Date('2026-08-30T00:00:00Z');

  it('counts inclusive months as years and months', () => {
    expect(
      formatDuration({ year: 2024, month: 1, day: null }, { year: 2025, month: 2, day: null }),
    ).toBe('1 yr 2 mos');
  });

  it('singularises a one-year and one-month span', () => {
    expect(
      formatDuration({ year: 2024, month: 1, day: null }, { year: 2025, month: 1, day: null }),
    ).toBe('1 yr 1 mo');
  });

  it('never reports zero', () => {
    expect(
      formatDuration({ year: 2026, month: 8, day: null }, { year: 2026, month: 8, day: null }),
    ).toBe('1 mo');
  });

  it('measures an ongoing role against now', () => {
    expect(formatDuration({ year: 2026, month: 6, day: null }, null, true, now)).toBe('3 mos');
  });

  it('refuses to invent an end date for a role that is not current', () => {
    expect(formatDuration({ year: 2020, month: 1, day: null }, null, null, now)).toBeNull();
    expect(formatDuration({ year: 2020, month: 1, day: null }, null, false, now)).toBeNull();
  });

  it('returns null without a start year', () => {
    expect(formatDuration(null, { year: 2024, month: 1, day: null })).toBeNull();
    expect(formatDuration({ year: null, month: 4, day: null }, null, true, now)).toBeNull();
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-08-30T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('reads seconds as "just now"', () => {
    expect(relativeTime(ago(5 * SECOND), now)).toBe('just now');
  });

  it('keeps the min/hr units invariant', () => {
    expect(relativeTime(ago(12 * MINUTE), now)).toBe('12 min ago');
    expect(relativeTime(ago(3 * HOUR), now)).toBe('3 hr ago');
  });

  it('switches to days then weeks', () => {
    expect(relativeTime(ago(1 * DAY), now)).toBe('1 day ago');
    expect(relativeTime(ago(2 * DAY), now)).toBe('2 days ago');
    expect(relativeTime(ago(10 * DAY), now)).toBe('1 week ago');
  });

  it('falls back to a calendar date beyond a month', () => {
    expect(relativeTime('2026-01-04T12:00:00Z', now)).toBe('Jan 4');
    expect(relativeTime('2024-01-04T12:00:00Z', now)).toBe('Jan 4, 2024');
  });

  it('does not produce a negative age from clock skew', () => {
    expect(relativeTime(new Date(now.getTime() + 5 * MINUTE).toISOString(), now)).toBe('just now');
  });

  it('returns null for absent or unparseable timestamps', () => {
    expect(relativeTime(null, now)).toBeNull();
    expect(relativeTime('', now)).toBeNull();
    expect(relativeTime('not a date', now)).toBeNull();
  });
});

describe('bestImageUrl', () => {
  it('takes the exact requested width when present', () => {
    const url = bestImageUrl(
      { urls: { '100': 'https://cdn/100.jpg', '400': 'https://cdn/400.jpg' } },
      400,
    );
    expect(url).toBe('https://cdn/400.jpg');
  });

  it('otherwise takes the largest at or below the request', () => {
    const url = bestImageUrl(
      { urls: { '100': 'https://cdn/100.jpg', '200': 'https://cdn/200.jpg' } },
      400,
    );
    expect(url).toBe('https://cdn/200.jpg');
  });

  it('accepts an oversized image rather than rendering nothing', () => {
    const url = bestImageUrl({ urls: { '800': 'https://cdn/800.jpg' } }, 400);
    expect(url).toBe('https://cdn/800.jpg');
  });

  it('falls back to the explicit large/small URLs', () => {
    expect(bestImageUrl({ largeUrl: 'https://cdn/large.jpg' })).toBe('https://cdn/large.jpg');
    expect(bestImageUrl({ smallUrl: 'https://cdn/small.jpg' })).toBe('https://cdn/small.jpg');
  });

  it('ignores rootUrl, which is not a complete image URL on its own', () => {
    expect(bestImageUrl({ rootUrl: 'https://cdn/root/' })).toBeNull();
  });

  it('returns null for an absent or empty asset', () => {
    expect(bestImageUrl(null)).toBeNull();
    expect(bestImageUrl({})).toBeNull();
    expect(bestImageUrl({ urls: {} })).toBeNull();
  });
});

describe('initialsOf', () => {
  it('takes the first and last words', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('Ada Byron King Lovelace')).toBe('AL');
    expect(initialsOf('Ada')).toBe('A');
  });

  it('splits a username on its separators', () => {
    expect(initialsOf('ritik-sde')).toBe('RS');
    expect(initialsOf('john.doe')).toBe('JD');
  });

  it('degrades to a dot rather than an empty circle', () => {
    expect(initialsOf(null)).toBe('·');
    expect(initialsOf('   ')).toBe('·');
  });
});

describe('lead accessors', () => {
  it('builds a name from whatever is available, ending at the username', () => {
    expect(fullNameOf(lead({ profile: { fullName: 'Ada Lovelace' } }))).toBe('Ada Lovelace');
    expect(fullNameOf(lead({ profile: { firstName: 'Ada', lastName: 'Lovelace' } }))).toBe(
      'Ada Lovelace',
    );
    expect(fullNameOf(lead({ profile: { firstName: 'Ada' } }))).toBe('Ada');
    expect(fullNameOf(lead())).toBe('john-doe');
    expect(fullNameOf(null)).toBe('Unknown lead');
  });

  it('prefers the headline but accepts the occupation', () => {
    expect(headlineOf(lead({ profile: { headline: 'SDE at Acme' } }))).toBe('SDE at Acme');
    expect(headlineOf(lead({ profile: { headline: null, occupation: 'Student' } }))).toBe('Student');
    expect(headlineOf(lead())).toBeNull();
  });

  it('prefers the composed location name, else city and country', () => {
    expect(locationOf(lead({ profile: { location: { locationName: 'Bengaluru, India' } } }))).toBe(
      'Bengaluru, India',
    );
    expect(locationOf(lead({ profile: { location: { city: 'Pune', country: 'India' } } }))).toBe(
      'Pune, India',
    );
    expect(locationOf(lead({ profile: { location: { city: 'Pune' } } }))).toBe('Pune');
    expect(locationOf(lead())).toBeNull();
  });

  it('reads the industry name', () => {
    expect(industryOf(lead({ profile: { industry: { industryName: 'Software' } } }))).toBe(
      'Software',
    );
    expect(industryOf(lead({ profile: { industry: null } }))).toBeNull();
  });

  it('splits experience by the current flag, treating null as not current', () => {
    const withRoles = lead({
      experience: [
        { title: 'SDE', companyName: 'Acme', current: true },
        { title: 'Intern', companyName: 'Globex', current: false },
        { title: 'Volunteer', companyName: 'Initech', current: null },
      ],
    });

    expect(currentRoleOf(withRoles)?.title).toBe('SDE');
    expect(currentTitleOf(withRoles)).toBe('SDE');
    expect(previousRolesOf(withRoles).map((role) => role.title)).toEqual(['Intern', 'Volunteer']);
    expect(currentRoleOf(lead())).toBeNull();
    expect(previousRolesOf(lead())).toEqual([]);
  });

  it('prefers the enriched company block for the current company', () => {
    const enriched = lead({
      experience: [{ companyName: 'Stale Name', current: true }],
      metadata: { currentCompany: { companyName: 'Acme Corp' } },
    });
    expect(currentCompanyOf(enriched)).toBe('Acme Corp');

    const bare = lead({ experience: [{ companyName: 'Acme Corp', current: true }] });
    expect(currentCompanyOf(bare)).toBe('Acme Corp');
    expect(currentCompanyOf(lead())).toBeNull();
  });

  it('reads the profile image through the asset picker', () => {
    const withImage = lead({
      profile: { media: { profileImage: { urls: { '400': 'https://cdn/400.jpg' } } } },
    });
    expect(profileImageOf(withImage, 400)).toBe('https://cdn/400.jpg');
    expect(profileImageOf(lead())).toBeNull();
    expect(profileImageOf(null)).toBeNull();
  });
});
