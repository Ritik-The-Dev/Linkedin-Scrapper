import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, ButtonLink } from '../components/common/Button.tsx';
import { EmptyState } from '../components/common/EmptyState.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { InlineNotice } from '../components/common/InlineNotice.tsx';
import { Pagination } from '../components/common/Pagination.tsx';
import { LeadCardSkeletonList } from '../components/common/Skeleton.tsx';
import { Spinner } from '../components/common/Spinner.tsx';
import {
  ArrowRightIcon,
  BoltIcon,
  CloseIcon,
  DatabaseIcon,
  SearchIcon,
  UsersIcon,
} from '../components/common/icons.tsx';
import { LeadGrid } from '../components/leads/LeadGrid.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useLeadsList } from '../hooks/useLeadsList.ts';
import { createOrGetLead } from '../services/api.ts';
import { errorMessage, isCancelled } from '../services/errors.ts';
import { pluralize } from '../utils/formatters.ts';
import { normalizeLinkedInInput } from '../utils/linkedin.ts';

/**
 * Router state is `unknown`, so the deleted-lead handoff is narrowed rather than
 * asserted. The detail page sets `{ deleted: username }` when it navigates here.
 */
function readDeleted(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const value = (state as { deleted?: unknown }).deleted;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The stored-leads browser.
 *
 * Typing searches the database through `GET /api/leads/search` — LinkedIn is
 * never contacted from here. Requests are debounced, and paging follows the
 * API's own `hasNextPage` / `hasPreviousPage` flags, ten rows at a time.
 */
export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const {
    query,
    setQuery,
    page,
    goToPage,
    leads,
    pagination,
    loading,
    pending,
    error,
    isSearching,
    reload,
  } = useLeadsList(350, params.get('q') ?? '');

  useDocumentTitle(isSearching ? `Search: ${query}` : 'Leads');

  // Captured once, on mount: arriving here from a delete remounts this route.
  const [deleted, setDeleted] = useState(() => readDeleted(location.state));

  // Keep ?q= in step with the field, replacing rather than stacking history.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (current === query) return;

    const next = new URLSearchParams(params);
    if (query.trim().length > 0) next.set('q', query);
    else next.delete('q');
    setParams(next, { replace: true });
  }, [query, params, setParams]);

  const onPageChange = useCallback(
    (next: number) => {
      goToPage(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [goToPage],
  );

  const showSkeletons = loading && leads.length === 0;
  const busy = loading || pending;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[1.75rem]">Leads</h1>
          <p className="mt-1.5 text-pretty text-sm text-ink-muted">
            Everything already stored, searchable by name, headline, company or username.
          </p>
        </div>
        <ButtonLink to="/dashboard" size="sm" iconLeft={<BoltIcon className="size-3.5" />}>
          Extract a new lead
        </ButtonLink>
      </header>

      {deleted !== null ? (
        <InlineNotice
          tone="success"
          className="mt-5"
          title="Lead deleted"
          onDismiss={() => setDeleted(null)}
        >
          <span className="slug">{deleted}</span> was removed from the database.
        </InlineNotice>
      ) : null}

      <div className="mt-6">
        <label htmlFor="lead-search" className="sr-only">
          Search stored leads
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="lead-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, headline, company or username"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-24 text-sm text-ink
                       placeholder:text-ink-faint focus:border-brand-400 focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {pending ? <Spinner size={14} className="text-ink-faint" /> : null}
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="rounded-md p-1 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <CloseIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-faint" aria-live="polite">
          <DatabaseIcon className="size-3" />
          {isSearching
            ? `Searching stored leads only — ${pagination.total} ${pluralize(pagination.total, 'match', 'matches')}`
            : 'Searching stored leads only. LinkedIn is never queried from here.'}
        </p>
      </div>

      <div className="mt-6">
        {showSkeletons ? (
          <LeadCardSkeletonList count={6} />
        ) : error !== null ? (
          <ErrorState message={error} onRetry={reload} />
        ) : leads.length === 0 ? (
          isSearching ? (
            <SearchMiss query={query} />
          ) : (
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title="No leads yet"
              description="Search a LinkedIn profile to create your first lead."
              action={
                <ButtonLink
                  to="/dashboard"
                  variant="primary"
                  size="sm"
                  iconRight={<ArrowRightIcon className="size-4" />}
                >
                  Go to dashboard
                </ButtonLink>
              }
            />
          )
        ) : (
          <>
            <LeadGrid leads={leads} pending={busy && leads.length > 0} />
            <Pagination
              pagination={pagination}
              onChange={onPageChange}
              busy={busy}
              className="mt-8 border-t border-line pt-5"
            />
          </>
        )}
      </div>

      {/* A page beyond the end of the result set: offer the way back. */}
      {!loading && leads.length === 0 && !isSearching && page > 1 ? (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => goToPage(1)}>
            Back to page 1
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nothing matched. Since the query may well be a username the database has not
 * seen, this offers to extract it — which is the same `POST /api/leads` the
 * dashboard uses, with the username normalised first.
 */
function SearchMiss({ query }: { query: string }) {
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = normalizeLinkedInInput(query);
  const candidate = parsed.ok ? parsed.username : null;

  const extract = useCallback(() => {
    if (candidate === null) return;
    setWorking(true);
    setError(null);

    createOrGetLead(candidate)
      .then(() => {
        navigate(`/leads/${encodeURIComponent(candidate)}`);
      })
      .catch((cause: unknown) => {
        if (isCancelled(cause)) return;
        setError(errorMessage(cause));
        setWorking(false);
      });
  }, [candidate, navigate]);

  return (
    <div>
      <EmptyState
        icon={<SearchIcon className="size-5" />}
        title="No stored leads match your search"
        description={
          candidate !== null
            ? `Nothing in the database matched “${query.trim()}”. If this is a profile username, it can be extracted from LinkedIn now.`
            : `Nothing in the database matched “${query.trim()}”. Try a shorter query, or a name, company or username.`
        }
        action={
          candidate !== null ? (
            <Button
              variant="primary"
              size="sm"
              onClick={extract}
              loading={working}
              iconLeft={working ? undefined : <BoltIcon className="size-3.5" />}
            >
              Extract {candidate}
            </Button>
          ) : undefined
        }
      />
      {error !== null ? (
        <InlineNotice tone="error" className="mt-4" onDismiss={() => setError(null)}>
          {error}
        </InlineNotice>
      ) : null}
    </div>
  );
}
