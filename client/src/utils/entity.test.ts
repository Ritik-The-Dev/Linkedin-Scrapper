import { describe, expect, it } from 'vitest';

import {
  displayHost,
  entityKey,
  fieldDate,
  fieldString,
  fieldStringList,
  fieldUrl,
  safeUrl,
} from './entity.ts';

describe('fieldString', () => {
  it('takes the first alias that holds a usable string', () => {
    const record = { name: null, title: '  Advanced React  ' };
    expect(fieldString(record, ['name', 'title'])).toBe('Advanced React');
  });

  it('returns null when no alias matches', () => {
    expect(fieldString({ other: 'x' }, ['name', 'title'])).toBeNull();
    expect(fieldString({}, ['name'])).toBeNull();
  });

  it('tolerates a non-object, which is what an unexpected payload gives', () => {
    expect(fieldString(null, ['name'])).toBeNull();
    expect(fieldString('a string', ['name'])).toBeNull();
    expect(fieldString(undefined, ['name'])).toBeNull();
  });
});

describe('safeUrl', () => {
  it('keeps http and https URLs', () => {
    expect(safeUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(safeUrl('http://example.com/')).toBe('http://example.com/');
  });

  it('assumes https for a schemeless host', () => {
    expect(safeUrl('example.com')).toBe('https://example.com/');
    expect(safeUrl('www.example.com/page')).toBe('https://www.example.com/page');
  });

  it('rejects every other scheme — these strings come from a remote payload', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
    expect(safeUrl('mailto:ada@example.com')).toBeNull();
  });

  it('rejects absent or unparseable values', () => {
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl(42)).toBeNull();
    expect(safeUrl('http://')).toBeNull();
  });
});

describe('fieldUrl', () => {
  it('returns the first alias that survives the scheme check', () => {
    const record = { link: 'javascript:alert(1)', url: 'https://example.com/' };
    expect(fieldUrl(record, ['link', 'url'])).toBe('https://example.com/');
  });

  it('returns null when nothing is linkable', () => {
    expect(fieldUrl({ url: 'javascript:alert(1)' }, ['url'])).toBeNull();
    expect(fieldUrl({}, ['url'])).toBeNull();
  });
});

describe('displayHost', () => {
  it('strips the scheme, path and www prefix', () => {
    expect(displayHost('https://www.example.com/some/path')).toBe('example.com');
    expect(displayHost('https://docs.example.co.uk/x')).toBe('docs.example.co.uk');
  });

  it('hands back the input when it cannot be parsed', () => {
    expect(displayHost('not a url')).toBe('not a url');
  });
});

describe('fieldDate', () => {
  it('accepts the documented { year, month, day } object', () => {
    expect(fieldDate({ startDate: { year: 2024, month: 6, day: 1 } }, ['startDate'])).toEqual({
      year: 2024,
      month: 6,
      day: 1,
    });
  });

  it('accepts a bare year number', () => {
    expect(fieldDate({ year: 2024 }, ['year'])).toEqual({ year: 2024, month: null, day: null });
  });

  it('accepts ISO-ish strings at three precisions', () => {
    expect(fieldDate({ date: '2024' }, ['date'])).toEqual({ year: 2024, month: null, day: null });
    expect(fieldDate({ date: '2024-06' }, ['date'])).toEqual({ year: 2024, month: 6, day: null });
    expect(fieldDate({ date: '2024-06-01T00:00:00Z' }, ['date'])).toEqual({
      year: 2024,
      month: 6,
      day: 1,
    });
  });

  it('discards out-of-range month and day rather than rendering nonsense', () => {
    expect(fieldDate({ date: '2024-13-40' }, ['date'])).toEqual({
      year: 2024,
      month: null,
      day: null,
    });
    expect(fieldDate({ d: { year: 2024, month: 99, day: 0 } }, ['d'])).toEqual({
      year: 2024,
      month: 99,
      day: 0,
    });
  });

  it('skips a number that is not plausibly a year', () => {
    expect(fieldDate({ year: 12 }, ['year'])).toBeNull();
    expect(fieldDate({ year: 9999 }, ['year'])).toBeNull();
  });

  it('walks past empty aliases to a later one', () => {
    expect(fieldDate({ issueDate: null, date: '2024-06' }, ['issueDate', 'date'])).toEqual({
      year: 2024,
      month: 6,
      day: null,
    });
  });

  it('returns null when nothing is date-shaped', () => {
    expect(fieldDate({ date: 'sometime last year' }, ['date'])).toBeNull();
    expect(fieldDate({ date: {} }, ['date'])).toBeNull();
    expect(fieldDate(null, ['date'])).toBeNull();
  });
});

describe('fieldStringList', () => {
  it('reads an array of strings', () => {
    expect(fieldStringList({ contributors: ['Ada', 'Grace'] }, ['contributors'])).toEqual([
      'Ada',
      'Grace',
    ]);
  });

  it('drops holes inside the array', () => {
    expect(fieldStringList({ authors: ['Ada', null, '', 'Grace'] }, ['authors'])).toEqual([
      'Ada',
      'Grace',
    ]);
  });

  it('wraps a lone string so callers only handle one shape', () => {
    expect(fieldStringList({ cause: 'Education' }, ['cause'])).toEqual(['Education']);
  });

  it('moves on when an alias holds an empty array', () => {
    expect(fieldStringList({ authors: [], contributors: ['Ada'] }, ['authors', 'contributors'])).toEqual(
      ['Ada'],
    );
  });

  it('always returns an array, so render code never guards', () => {
    expect(fieldStringList({}, ['contributors'])).toEqual([]);
    expect(fieldStringList(null, ['contributors'])).toEqual([]);
  });
});

describe('entityKey', () => {
  it('prefers whichever identifier the payload carries', () => {
    expect(entityKey({ entityUrn: 'urn:li:cert:1' }, 'AWS', 0)).toBe('urn:li:cert:1');
    expect(entityKey({ id: 'abc' }, 'AWS', 0)).toBe('abc');
    expect(entityKey({ _id: 'mongo-id' }, 'AWS', 0)).toBe('mongo-id');
  });

  it('falls back to label and index so keys stay unique and stable', () => {
    expect(entityKey({}, 'AWS Certified', 2)).toBe('AWS Certified-2');
    expect(entityKey({}, null, 3)).toBe('item-3');
    expect(entityKey(null, null, 0)).toBe('item-0');
  });
});
