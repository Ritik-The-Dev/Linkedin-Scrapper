import { describe, expect, it } from 'vitest';

import { API_BASE_URL, PAGE_SIZE } from '../config/env.ts';
import type { ImportResult } from '../types/api.ts';
import * as api from './api.ts';
import { ApiError } from './errors.ts';
import {
  createOrGetLead,
  deleteLead,
  getLead,
  getLeads,
  getStats,
  importLeads,
  refreshLead,
  searchLeads,
} from './mock/mockApi.ts';

/**
 * The mock backend must behave like the real one: same inputs, same result
 * shapes, same error codes, same 10-per-page cap. These tests are the guard
 * against mock mode quietly drifting into a different schema.
 *
 * The mock store is module-scoped, exactly as it is in the running app, so each
 * test either uses a username of its own or asserts on a delta rather than an
 * absolute total.
 */

/** Asserts the call rejects, and hands back the ApiError for inspection. */
async function rejects(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject, but it resolved');
}

function csv(body: string, name = 'leads.csv'): File {
  return new File([body], name, { type: 'text/csv' });
}

describe('POST /api/leads — createOrGetLead', () => {
  it('fetches an unknown profile from LinkedIn and stores it', async () => {
    const created = await createOrGetLead('mock-test-fresh-one');
    expect(created.source).toBe('linkedin');
    expect(created.lead.username).toBe('mock-test-fresh-one');
    expect(typeof created.lead._id).toBe('string');
  });

  it('serves the second request from the database instead', async () => {
    await createOrGetLead('mock-test-twice');
    const again = await createOrGetLead('mock-test-twice');
    expect(again.source).toBe('database');
    expect(again.lead.username).toBe('mock-test-twice');
  });

  it('returns a lead the fixtures already contain without touching LinkedIn', async () => {
    const result = await createOrGetLead('ritik-joshi-sde');
    expect(result.source).toBe('database');
    expect(result.lead.profile?.firstName).toBe('Ritik');
  });

  it('rejects a username the backend would reject', async () => {
    // The frontend normalizes before sending, so this is the belt-and-braces path.
    expect((await rejects(() => createOrGetLead('Not A Username'))).code).toBe('INVALID_USERNAME');
    expect((await rejects(() => createOrGetLead(''))).status).toBe(400);
  });

  it('surfaces LinkedIn failures with the documented codes', async () => {
    expect((await rejects(() => createOrGetLead('bad-user-404'))).code).toBe(
      'LINKEDIN_PROFILE_NOT_FOUND',
    );

    const limited = await rejects(() => createOrGetLead('rate-limited'));
    expect(limited.code).toBe('LINKEDIN_RATE_LIMITED');
    expect(limited.status).toBe(429);

    expect((await rejects(() => createOrGetLead('auth-error'))).code).toBe('LINKEDIN_AUTH_ERROR');
  });

  it('stores nothing when the LinkedIn fetch fails', async () => {
    await rejects(() => createOrGetLead('bad-user-404'));
    // A failed extraction must not leave a half-built record behind.
    expect((await rejects(() => getLead('bad-user-404'))).code).toBe('LEAD_NOT_FOUND');
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    const inflight = createOrGetLead('mock-test-aborted', controller.signal);
    controller.abort();
    expect((await rejects(() => inflight)).code).toBe('REQUEST_CANCELLED');
  });
});

describe('GET /api/leads/:username — getLead', () => {
  it('returns a stored lead', async () => {
    const lead = await getLead('ritik-joshi-sde');
    expect(lead.username).toBe('ritik-joshi-sde');
    expect(Array.isArray(lead.experience)).toBe(true);
  });

  it('404s for a username that is not stored', async () => {
    const error = await rejects(() => getLead('definitely-not-stored-xyz'));
    expect(error.code).toBe('LEAD_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('hands back a copy, so the caller cannot mutate the store', async () => {
    const first = await getLead('ritik-joshi-sde');
    first.username = 'tampered';
    const second = await getLead('ritik-joshi-sde');
    expect(second.username).toBe('ritik-joshi-sde');
  });
});

describe('GET /api/leads — getLeads', () => {
  it('returns leads plus the documented pagination block', async () => {
    const { leads, pagination } = await getLeads(1, PAGE_SIZE);
    const { totalLeads } = await getStats();

    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(PAGE_SIZE);
    expect(pagination.total).toBe(totalLeads);
    expect(pagination.totalPages).toBe(Math.ceil(totalLeads / PAGE_SIZE));
    expect(pagination.hasPreviousPage).toBe(false);
    expect(leads.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(leads.length).toBe(Math.min(totalLeads, PAGE_SIZE));
  });

  it('never returns more than ten per request, whatever is asked for', async () => {
    const { leads, pagination } = await getLeads(1, 500);
    expect(pagination.limit).toBe(PAGE_SIZE);
    expect(leads.length).toBeLessThanOrEqual(PAGE_SIZE);
  });

  it('pages forward without repeating a lead', async () => {
    const first = await getLeads(1, 5);
    const second = await getLeads(2, 5);

    expect(first.pagination.hasNextPage).toBe(true);
    expect(second.pagination.hasPreviousPage).toBe(true);

    const overlap = second.leads.filter((lead) =>
      first.leads.some((other) => other.username === lead.username),
    );
    expect(overlap).toEqual([]);
  });

  it('sorts newest-seen first, matching the backend default', async () => {
    const { leads } = await getLeads(1, PAGE_SIZE);
    const seen = leads.map((lead) => Date.parse(lead.lastSeenAt ?? '') || 0);
    const sorted = [...seen].sort((a, b) => b - a);
    expect(seen).toEqual(sorted);
  });

  it('clamps a nonsensical page to the first one', async () => {
    expect((await getLeads(0, PAGE_SIZE)).pagination.page).toBe(1);
    expect((await getLeads(-3, PAGE_SIZE)).pagination.page).toBe(1);
  });
});

describe('GET /api/leads/search — searchLeads', () => {
  it('matches on the username', async () => {
    const { leads } = await searchLeads('ritik-joshi-sde');
    expect(leads.some((lead) => lead.username === 'ritik-joshi-sde')).toBe(true);
  });

  it('matches on name and on current company, case-insensitively', async () => {
    // Needles are derived from the fixtures rather than hardcoded, so renaming a
    // demo profile cannot silently turn this into a no-op.
    const { leads } = await getLeads(1, PAGE_SIZE);

    const named = leads.find((lead) => (lead.profile?.firstName ?? '').length > 2);
    expect(named).toBeTruthy();
    const byName = await searchLeads((named?.profile?.firstName ?? '').toUpperCase());
    expect(byName.leads.some((lead) => lead.username === named?.username)).toBe(true);

    const employed = leads.find(
      (lead) => (lead.metadata?.currentCompany?.companyName ?? '').length > 2,
    );
    expect(employed).toBeTruthy();
    const company = employed?.metadata?.currentCompany?.companyName ?? '';
    const byCompany = await searchLeads(company.toUpperCase());
    expect(byCompany.leads.some((lead) => lead.username === employed?.username)).toBe(true);
  });

  it('returns an empty page rather than an error when nothing matches', async () => {
    const { leads, pagination } = await searchLeads('zzz-no-such-person-zzz');
    expect(leads).toEqual([]);
    expect(pagination.total).toBe(0);
    expect(pagination.totalPages).toBe(0);
    expect(pagination.hasNextPage).toBe(false);
  });

  it('treats a blank query as an unfiltered list', async () => {
    const { totalLeads } = await getStats();
    expect((await searchLeads('   ')).pagination.total).toBe(totalLeads);
  });

  it('never creates anything — database search must not reach LinkedIn', async () => {
    const before = (await getStats()).totalLeads;
    await searchLeads('some-username-that-does-not-exist');
    expect((await getStats()).totalLeads).toBe(before);
  });

  it('caps search results at ten per request too', async () => {
    const { leads, pagination } = await searchLeads('', 1, 999);
    expect(pagination.limit).toBe(PAGE_SIZE);
    expect(leads.length).toBeLessThanOrEqual(PAGE_SIZE);
  });
});

describe('POST /api/leads/:username/refresh — refreshLead', () => {
  it('re-fetches a stored lead and bumps its refresh metadata', async () => {
    const username = 'mock-test-refresh';
    const before = (await createOrGetLead(username)).lead;
    const after = await refreshLead(username);

    expect(after.username).toBe(username);
    expect(after.refreshCount ?? 0).toBe((before.refreshCount ?? 0) + 1);
    expect(typeof after.lastRefreshedAt).toBe('string');
  });

  it('persists the refreshed copy', async () => {
    const username = 'mock-test-refresh-persist';
    await createOrGetLead(username);
    const refreshed = await refreshLead(username);
    expect((await getLead(username)).refreshCount).toBe(refreshed.refreshCount);
  });

  it('404s for a lead that is not stored, without contacting LinkedIn', async () => {
    const error = await rejects(() => refreshLead('never-stored-abc'));
    expect(error.code).toBe('LEAD_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('counts each refresh in the stats', async () => {
    const username = 'mock-test-refresh-stats';
    await createOrGetLead(username);
    const before = (await getStats()).totalRefreshed;
    await refreshLead(username);
    expect((await getStats()).totalRefreshed).toBe(before + 1);
  });
});

describe('DELETE /api/leads/:username — deleteLead', () => {
  it('returns the documented result and removes the lead', async () => {
    const username = 'mock-test-delete';
    await createOrGetLead(username);

    expect(await deleteLead(username)).toEqual({ username, deleted: true });
    expect((await rejects(() => getLead(username))).code).toBe('LEAD_NOT_FOUND');
  });

  it('404s on a second delete', async () => {
    const username = 'mock-test-delete-twice';
    await createOrGetLead(username);
    await deleteLead(username);
    expect((await rejects(() => deleteLead(username))).status).toBe(404);
  });

  it('lowers the stored count by exactly one', async () => {
    const username = 'mock-test-delete-count';
    await createOrGetLead(username);
    const before = (await getStats()).totalLeads;
    await deleteLead(username);
    expect((await getStats()).totalLeads).toBe(before - 1);
  });
});

describe('POST /api/leads/import — importLeads', () => {
  /** created + alreadyExists + failed must account for every unique row. */
  function expectConsistent(result: ImportResult): void {
    const { summary, results } = result;
    expect(summary.created + summary.alreadyExists + summary.failed).toBe(
      summary.uniqueUsernames,
    );
    expect(results.length).toBe(summary.uniqueUsernames);
    expect(results.filter((row) => row.status === 'created').length).toBe(summary.created);
    expect(results.filter((row) => row.status === 'exists').length).toBe(summary.alreadyExists);
    expect(results.filter((row) => row.status === 'failed').length).toBe(summary.failed);
  }

  it('classifies every row and reports a consistent summary', async () => {
    const file = csv(
      [
        'username,notes',
        'ritik-joshi-sde,already stored',
        'mock-import-brand-new,',
        'mock-import-brand-new,duplicate row',
        'bad-user-404,unreachable',
        'Not A Username,malformed',
      ].join('\n'),
    );

    const result = await importLeads(file);
    expectConsistent(result);

    expect(result.summary.totalRows).toBe(5);
    expect(result.summary.uniqueUsernames).toBe(4);
    expect(result.summary.alreadyExists).toBe(1);
    expect(result.summary.created).toBe(1);
    expect(result.summary.failed).toBe(2);
  });

  it('gives every failed row a reason, and successful rows a lead id', async () => {
    const file = csv(['username', 'bad-user-404', 'mock-import-reason-ok'].join('\n'));
    const { results } = await importLeads(file);

    for (const row of results) {
      if (row.status === 'failed') {
        expect(typeof row.error).toBe('string');
        expect(row.error?.length).toBeGreaterThan(0);
      } else {
        expect(typeof row.leadId).toBe('string');
      }
    }
  });

  it('lowercases usernames, so the same person is not imported twice', async () => {
    const file = csv(['username', 'MOCK-IMPORT-CASE', 'mock-import-case'].join('\n'));
    const result = await importLeads(file);
    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.uniqueUsernames).toBe(1);
  });

  it('reads a tab-separated file too', async () => {
    const file = new File(
      [['username\tnotes', 'mock-import-tsv\tfrom a tsv'].join('\n')],
      'leads.tsv',
      { type: 'text/tab-separated-values' },
    );
    const result = await importLeads(file);
    expect(result.summary.uniqueUsernames).toBe(1);
    expect(result.results[0]?.username).toBe('mock-import-tsv');
  });

  it('falls back to the demo list for a binary .xlsx it cannot parse', async () => {
    const result = await importLeads(new File([new Uint8Array([0x50, 0x4b])], 'leads.xlsx'));
    expectConsistent(result);
    expect(result.summary.uniqueUsernames).toBeGreaterThan(0);
    // The demo list deliberately contains one profile LinkedIn cannot serve.
    expect(result.results.some((row) => row.status === 'failed')).toBe(true);
  });

  it('rejects a file with no username column', async () => {
    const error = await rejects(() => importLeads(csv('email,name\nada@example.com,Ada')));
    expect(error.code).toBe('INVALID_EXCEL');
    expect(error.status).toBe(400);
  });

  it('rejects a header-only file and a non-spreadsheet', async () => {
    expect((await rejects(() => importLeads(csv('username')))).code).toBe('INVALID_EXCEL');
    expect((await rejects(() => importLeads(csv('username', 'notes.pdf')))).code).toBe(
      'INVALID_EXCEL',
    );
  });

  it('reports upload progress up to 100', async () => {
    const seen: number[] = [];
    await importLeads(csv(['username', 'mock-import-progress'].join('\n')), (percent) =>
      seen.push(percent),
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('records the import time in the stats', async () => {
    await importLeads(csv(['username', 'mock-import-stamp'].join('\n')));
    const { lastImportedAt } = await getStats();
    expect(typeof lastImportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(lastImportedAt ?? ''))).toBe(false);
  });
});

describe('GET /api/leads/stats — getStats', () => {
  it('returns exactly the three documented fields', async () => {
    const stats = await getStats();
    expect(Object.keys(stats).sort()).toEqual(['lastImportedAt', 'totalLeads', 'totalRefreshed']);
    expect(typeof stats.totalLeads).toBe('number');
    expect(typeof stats.totalRefreshed).toBe('number');
  });

  it('tracks the stored count as leads are added', async () => {
    const before = (await getStats()).totalLeads;
    await createOrGetLead('mock-test-stats-count');
    expect((await getStats()).totalLeads).toBe(before + 1);
  });
});

/** Eight endpoints, eight functions — see docs/api-spec.md. */
const ENDPOINT_FUNCTIONS = [
  'createOrGetLead',
  'deleteLead',
  'getLead',
  'getLeads',
  'getStats',
  'importLeads',
  'refreshLead',
  'searchLeads',
];

describe('the API contract surface', () => {
  it('exposes one function per documented endpoint, and nothing else', () => {
    // `client` is the shared axios instance; every other export is an endpoint.
    // If this list changes, the contract changed.
    expect(Object.keys(api).sort()).toEqual(['client', ...ENDPOINT_FUNCTIONS].sort());

    for (const name of ENDPOINT_FUNCTIONS) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('is implemented by the mock under the same names', () => {
    // Mock mode swaps the implementation, never the shape of the call.
    const mocked = [
      createOrGetLead,
      deleteLead,
      getLead,
      getLeads,
      getStats,
      importLeads,
      refreshLead,
      searchLeads,
    ]
      .map((fn) => fn.name)
      .sort();

    expect(mocked).toEqual(ENDPOINT_FUNCTIONS);
  });

  it('points at the configured base URL, not a hardcoded host', () => {
    expect(api.client.defaults.baseURL).toBe(API_BASE_URL);
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });
});
