import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ExtractForm } from '../components/dashboard/ExtractForm.tsx';
import { ImportPanel } from '../components/dashboard/ImportPanel.tsx';
import { StatsRow } from '../components/dashboard/StatsRow.tsx';
import { ButtonLink } from '../components/common/Button.tsx';
import { Card } from '../components/common/Card.tsx';
import { EmptyState } from '../components/common/EmptyState.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { LeadCardSkeletonList } from '../components/common/Skeleton.tsx';
import { ArrowRightIcon, SearchIcon, UsersIcon } from '../components/common/icons.tsx';
import { LeadGrid } from '../components/leads/LeadGrid.tsx';
import { LeadPreview } from '../components/leads/LeadPreview.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useRecentLeads } from '../hooks/useRecentLeads.ts';
import { useStats } from '../hooks/useStats.ts';
import type { LeadSource } from '../types/api.ts';
import type { Lead } from '../types/lead.ts';
import { pluralize } from '../utils/formatters.ts';

interface Extracted {
  lead: Lead;
  source: LeadSource | null;
}

/**
 * Working surface: extract one profile, import many, see what is stored.
 *
 * A successful extraction stays on this page — the full profile opens in place,
 * directly under the input, with the recently seen list still below it. Nothing
 * navigates away on its own.
 */
export function DashboardPage() {
  useDocumentTitle('Dashboard');

  // The landing page hands over whatever was typed there as ?u=, so the field
  // arrives prefilled rather than making the visitor paste the URL twice.
  const [params] = useSearchParams();
  const handoff = params.get('u') ?? '';

  const { stats, loading: statsLoading, error: statsError, reload: reloadStats } = useStats();
  const {
    leads,
    total,
    loading,
    error,
    hasMore,
    reload: reloadRecent,
    promote,
  } = useRecentLeads();

  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(() => new Set());

  const onExtracted = useCallback(
    (lead: Lead, source: LeadSource | null) => {
      setExtracted({ lead, source });
      promote(lead, source === 'linkedin');
      setHighlighted((current) => new Set(current).add(lead.username));
      reloadStats();
    },
    [promote, reloadStats],
  );

  const onImported = useCallback(() => {
    reloadRecent();
    reloadStats();
  }, [reloadRecent, reloadStats]);

  const dismissPreview = useCallback(() => setExtracted(null), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl sm:text-[1.75rem]">Dashboard</h1>
        <p className="mt-1.5 max-w-2xl text-pretty text-sm text-ink-muted">
          Paste a LinkedIn profile to store it, or import a spreadsheet of usernames. Profiles
          already in the database are served without contacting LinkedIn.
        </p>
      </header>

      <Card className="mt-6 p-5 sm:p-6">
        <ExtractForm onExtracted={onExtracted} initialValue={handoff} />
      </Card>

      {/* The result of the search above, in place. */}
      {extracted !== null ? (
        <div className="mt-4">
          <LeadPreview
            lead={extracted.lead}
            source={extracted.source}
            onDismiss={dismissPreview}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <ImportPanel onImported={onImported} />
      </div>

      <div className="mt-6">
        <StatsRow stats={stats} loading={statsLoading} error={statsError} />
      </div>

      <section aria-labelledby="recent-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-heading" className="text-lg">
              Recently seen leads
            </h2>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              {loading
                ? 'Loading…'
                : total > 0
                  ? `Showing ${leads.length} of ${total} stored ${pluralize(total, 'lead')}, most recent first.`
                  : 'Nothing stored yet.'}
            </p>
          </div>
          {total > 0 ? (
            <ButtonLink to="/leads" size="sm" iconLeft={<SearchIcon className="size-3.5" />}>
              Search all leads
            </ButtonLink>
          ) : null}
        </div>

        <div className="mt-4">
          {loading ? (
            <LeadCardSkeletonList count={6} />
          ) : error !== null && leads.length === 0 ? (
            <ErrorState message={error} onRetry={reloadRecent} />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title="No leads yet"
              description="Search a LinkedIn profile to create your first lead, or import a spreadsheet of usernames."
            />
          ) : (
            <>
              <LeadGrid leads={leads} highlighted={highlighted} />

              {/*
                More stored leads than this page shows: send people to /leads,
                which is built for browsing and searching, rather than growing
                this list indefinitely.
              */}
              {hasMore ? (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <ButtonLink
                    to="/leads"
                    variant="secondary"
                    iconRight={<ArrowRightIcon className="size-4" />}
                  >
                    Show More
                  </ButtonLink>
                  <p className="text-2xs text-ink-faint">
                    {total - leads.length} more stored {pluralize(total - leads.length, 'lead')} on
                    the leads page
                  </p>
                </div>
              ) : null}

              {error !== null ? (
                <div className="mt-4">
                  <ErrorState message={error} onRetry={reloadRecent} dense />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
