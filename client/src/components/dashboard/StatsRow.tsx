import type { ReactNode } from 'react';

import type { LeadStats } from '../../types/api.ts';
import { formatDateTime, formatNumber, relativeTime } from '../../utils/formatters.ts';
import { Card } from '../common/Card.tsx';
import { Skeleton } from '../common/Skeleton.tsx';
import { DatabaseIcon, RefreshIcon, UploadIcon } from '../common/icons.tsx';

interface StatsRowProps {
  stats: LeadStats | null;
  loading: boolean;
  error: string | null;
}

/**
 * The three counters from `GET /api/leads/stats`.
 *
 * Only what the endpoint returns is shown — no derived "growth" figures the API
 * has no data for. A failed stats call degrades to a quiet line rather than
 * taking over the dashboard.
 */
export function StatsRow({ stats, loading, error }: StatsRowProps) {
  if (error !== null) {
    return (
      <Card className="px-5 py-4">
        <p role="status" className="text-[0.8125rem] text-ink-muted">
          Stats are unavailable right now. Everything else on this page still works.
        </p>
      </Card>
    );
  }

  const imported = stats?.lastImportedAt ?? null;

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Stat
        icon={<DatabaseIcon className="size-4" />}
        label="Leads stored"
        loading={loading}
        value={formatNumber(stats?.totalLeads) ?? '0'}
        hint="Unique profiles in the database"
      />
      <Stat
        icon={<RefreshIcon className="size-4" />}
        label="Refreshes run"
        loading={loading}
        value={formatNumber(stats?.totalRefreshed) ?? '0'}
        hint="Times a stored profile was re-fetched"
      />
      <Stat
        icon={<UploadIcon className="size-4" />}
        label="Last import"
        loading={loading}
        value={relativeTime(imported) ?? 'Never'}
        hint={formatDateTime(imported) ?? 'No spreadsheet imported yet'}
      />
    </dl>
  );
}

interface StatProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}

function Stat({ icon, label, value, hint, loading }: StatProps) {
  return (
    <Card className="flex items-start gap-4 px-5 py-4">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
        <dd>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <span className="font-display text-2xl font-semibold tracking-tighter2 text-ink">
              {value}
            </span>
          )}
          <p className="mt-0.5 truncate text-2xs text-ink-muted" title={hint}>
            {loading ? '' : hint}
          </p>
        </dd>
      </div>
    </Card>
  );
}
