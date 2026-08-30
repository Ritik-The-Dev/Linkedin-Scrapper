import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useImportedLeads } from '../../hooks/useImportedLeads.ts';
import { importRowMessage } from '../../services/errors.ts';
import type { ImportResult, ImportRowResult, ImportRowStatus } from '../../types/api.ts';
import { cn } from '../../utils/cn.ts';
import { pluralize } from '../../utils/formatters.ts';
import { Badge } from '../common/Badge.tsx';
import { EmptyState } from '../common/EmptyState.tsx';
import { LeadCardSkeletonList } from '../common/Skeleton.tsx';
import { AlertIcon, BoltIcon, DatabaseIcon, FileIcon, LayersIcon } from '../common/icons.tsx';
import { LeadGrid } from '../leads/LeadGrid.tsx';

/**
 * How many newly extracted profiles are fetched and shown as full cards. Beyond
 * this the row table below carries them, so a 200-row import stays usable.
 */
const CARD_LIMIT = 9;

interface ImportResultsProps {
  result: ImportResult;
}

/**
 * What the import actually did, kept clearly separate from the dashboard's own
 * "recently seen" list.
 *
 * Newly extracted profiles are shown as real lead cards, the ones that were
 * already stored form a smaller group beneath them, and every single row the
 * backend returned — successes and failures alike — is listed in the table at
 * the end. Nothing is hidden.
 */
export function ImportResults({ result }: ImportResultsProps) {
  const { summary, results } = result;

  const created = results.filter((row) => row.status === 'created');
  const exists = results.filter((row) => row.status === 'exists');
  const failed = results.filter((row) => row.status === 'failed');

  const {
    leads: createdLeads,
    loading: cardsLoading,
    unresolved,
  } = useImportedLeads(
    created.map((row) => row.username),
    CARD_LIMIT,
  );

  const duplicates = Math.max(0, summary.totalRows - summary.uniqueUsernames);
  const empty = summary.totalRows === 0;

  return (
    <section aria-labelledby="import-results-heading" className="animate-rise mt-6 border-t border-line pt-5">
      <h3 id="import-results-heading" className="text-sm font-semibold text-ink">
        Import results
      </h3>

      {empty ? (
        <EmptyState
          className="mt-3"
          dense
          icon={<FileIcon className="size-5" />}
          title="No rows found in this file."
          description="The sheet needs a column named username, with one profile username or URL per row. The demo file above shows the expected shape."
        />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total rows" value={summary.totalRows} tone="neutral" />
            <SummaryCard
              label="New leads"
              value={summary.created}
              tone="created"
              icon={<BoltIcon className="size-3.5" />}
            />
            <SummaryCard
              label="Already existing"
              value={summary.alreadyExists}
              tone="exists"
              icon={<DatabaseIcon className="size-3.5" />}
            />
            <SummaryCard
              label="Failed"
              value={summary.failed}
              tone={summary.failed > 0 ? 'failed' : 'neutral'}
              icon={summary.failed > 0 ? <AlertIcon className="size-3.5" /> : undefined}
            />
          </div>

          <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-faint">
            <span>
              <span className="font-mono text-ink-muted">{summary.uniqueUsernames}</span> unique{' '}
              {pluralize(summary.uniqueUsernames, 'username')}
            </span>
            {duplicates > 0 ? (
              <span>
                <span className="font-mono text-ink-muted">{duplicates}</span> duplicate{' '}
                {pluralize(duplicates, 'row')} skipped
              </span>
            ) : null}
          </p>

          {/* Newly extracted: the leads this import actually added. */}
          {summary.created > 0 ? (
            <div className="mt-6">
              <GroupHeading
                title="Newly extracted"
                blurb="Fetched from LinkedIn and stored for the first time."
                count={summary.created}
                icon={<BoltIcon className="size-3.5 text-ok-500" />}
              />

              <div className="mt-3">
                {cardsLoading && createdLeads.length === 0 ? (
                  <LeadCardSkeletonList count={Math.min(created.length, CARD_LIMIT)} />
                ) : createdLeads.length > 0 ? (
                  <LeadGrid
                    leads={createdLeads}
                    highlighted={new Set(createdLeads.map((lead) => lead.username))}
                    pending={cardsLoading}
                  />
                ) : (
                  <UsernameChips rows={created} tone="created" />
                )}
              </div>

              {createdLeads.length > 0 && summary.created > createdLeads.length ? (
                <p className="mt-3 text-2xs text-ink-faint">
                  Showing {createdLeads.length} of {summary.created} new{' '}
                  {pluralize(summary.created, 'lead')} as cards
                  {unresolved > 0 ? ' (some could not be loaded just now)' : null}. All rows are
                  listed below.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Already existing: a deliberately smaller group — nothing was fetched. */}
          {summary.alreadyExists > 0 ? (
            <div className="mt-6 rounded-xl border border-cache-100 bg-cache-50/40 px-4 py-3.5">
              <GroupHeading
                title="Already existing"
                blurb="Served from the database — LinkedIn was not contacted for these."
                count={summary.alreadyExists}
                icon={<DatabaseIcon className="size-3.5 text-cache-500" />}
              />
              <div className="mt-3">
                <UsernameChips rows={exists} tone="exists" />
              </div>
              {exists.length < summary.alreadyExists ? (
                <p className="mt-2.5 text-2xs text-ink-faint">
                  {summary.alreadyExists - exists.length} more were not itemised by the API.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Every row, failures included. */}
          <RowTable rows={results} failedCount={failed.length} />
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

const CARD_TONES = {
  neutral: 'border-line bg-white text-ink',
  created: 'border-ok-100 bg-ok-50/60 text-ok-700',
  exists: 'border-cache-100 bg-cache-50/60 text-cache-700',
  failed: 'border-bad-100 bg-bad-50/60 text-bad-700',
} as const;

interface SummaryCardProps {
  label: string;
  value: number;
  tone: keyof typeof CARD_TONES;
  icon?: ReactNode;
}

function SummaryCard({ label, value, tone, icon }: SummaryCardProps) {
  return (
    <div className={cn('rounded-xl border px-3.5 py-3', CARD_TONES[tone])}>
      <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.08em] opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

interface GroupHeadingProps {
  title: string;
  blurb: string;
  count: number;
  icon: ReactNode;
}

function GroupHeading({ title, blurb, count, icon }: GroupHeadingProps) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
        {icon}
        {title}
        <span className="font-mono text-2xs font-normal tabular-nums text-ink-faint">{count}</span>
      </h4>
      <p className="mt-1 text-2xs text-ink-muted">{blurb}</p>
    </div>
  );
}

/**
 * Compact fallback list. Used for the already-stored group, and for new leads
 * whose follow-up fetch has not landed — a link is still a link.
 */
function UsernameChips({ rows, tone }: { rows: ImportRowResult[]; tone: 'created' | 'exists' }) {
  if (rows.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {rows.map((row) => (
        <li key={row.username}>
          <Link
            to={`/leads/${encodeURIComponent(row.username)}`}
            className={cn(
              'slug inline-flex items-center rounded-full border px-2.5 py-1 text-2xs transition-colors',
              tone === 'created'
                ? 'border-ok-100 bg-ok-50 text-ok-700 hover:border-ok-500'
                : 'border-cache-100 bg-white text-cache-700 hover:border-cache-500',
            )}
          >
            {row.username}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABEL: Record<ImportRowStatus, string> = {
  created: 'New',
  exists: 'Existing',
  failed: 'Failed',
};

const STATUS_TONE = {
  created: 'ok',
  exists: 'cache',
  failed: 'bad',
} as const;

/**
 * The complete row-by-row outcome.
 *
 * Failed rows are listed in the same table as the successful ones, with the
 * reason spelled out — an import that quietly drops a row is worse than one that
 * says which rows it could not read.
 */
function RowTable({ rows, failedCount }: { rows: ImportRowResult[]; failedCount: number }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-6">
      <GroupHeading
        title="All rows"
        blurb={
          failedCount > 0
            ? `Every row the import returned, including the ${failedCount} that failed.`
            : 'Every row the import returned.'
        }
        count={rows.length}
        icon={<LayersIcon className="size-3.5 text-ink-faint" />}
      />

      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <caption className="sr-only">
              Import outcome for every row, with the reason for each failure
            </caption>
            <thead className="sticky top-0 bg-page/95 backdrop-blur">
              <tr className="border-b border-line text-2xs uppercase tracking-[0.08em] text-ink-faint">
                <th scope="col" className="px-3.5 py-2.5 font-medium">
                  Username
                </th>
                <th scope="col" className="px-3.5 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-3.5 py-2.5 font-medium">
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.status}-${row.username}-${index}`}
                  className={cn(
                    'border-b border-line/70 last:border-0',
                    row.status === 'failed' && 'bg-bad-50/40',
                  )}
                >
                  <th scope="row" className="max-w-[16rem] px-3.5 py-2.5 font-normal">
                    {row.status === 'failed' ? (
                      <span className="slug text-ink-soft">{row.username}</span>
                    ) : (
                      <Link
                        to={`/leads/${encodeURIComponent(row.username)}`}
                        className="slug rounded hover:text-brand-700 hover:underline"
                      >
                        {row.username}
                      </Link>
                    )}
                  </th>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </td>
                  <td className="px-3.5 py-2.5 text-ink-muted">
                    {row.status === 'failed' ? importRowMessage(row.error) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
