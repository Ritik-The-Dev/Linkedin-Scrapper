import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink, ExternalButtonLink } from '../components/common/Button.tsx';
import { Card } from '../components/common/Card.tsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { InlineNotice } from '../components/common/InlineNotice.tsx';
import { Skeleton } from '../components/common/Skeleton.tsx';
import {
  ArrowLeftIcon,
  BoltIcon,
  ExternalIcon,
  RefreshIcon,
  TrashIcon,
} from '../components/common/icons.tsx';
import { LeadSections } from '../components/leads/LeadSections.tsx';
import { ProfileHeader } from '../components/leads/ProfileHeader.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useLead } from '../hooks/useLead.ts';
import { createOrGetLead, deleteLead, refreshLead } from '../services/api.ts';
import { errorMessage, isCancelled } from '../services/errors.ts';
import { formatDateTime, fullNameOf } from '../utils/formatters.ts';
import { profileUrlOf } from '../utils/linkedin.ts';

/**
 * One stored profile, in full.
 *
 * Refresh never overwrites optimistically: the visible profile is replaced only
 * once `POST /api/leads/:username/refresh` succeeds. If it fails, the stored
 * profile stays exactly as it was and the error is shown above it.
 */
export function LeadDetailPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { lead, loading, error, errorCode, setLead, reload } = useLead(username);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  // Clear per-lead action state when navigating between profiles.
  useEffect(() => {
    setRefreshError(null);
    setRefreshedAt(null);
    setDeleteError(null);
    setConfirmOpen(false);
  }, [username]);

  useDocumentTitle(lead !== null ? fullNameOf(lead) : loading ? 'Loading…' : 'Lead');

  const refresh = useCallback(() => {
    if (username === undefined) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setRefreshing(true);
    setRefreshError(null);
    setRefreshedAt(null);

    refreshLead(username, controller.signal)
      .then((updated) => {
        if (controller.signal.aborted) return;
        setLead(updated);
        setRefreshedAt(updated.lastRefreshedAt ?? new Date().toISOString());
        setRefreshing(false);
      })
      .catch((cause: unknown) => {
        if (isCancelled(cause) || controller.signal.aborted) {
          setRefreshing(false);
          return;
        }
        // The existing profile is left untouched on purpose.
        setRefreshError(errorMessage(cause));
        setRefreshing(false);
      });
  }, [setLead, username]);

  const confirmDelete = useCallback(() => {
    if (username === undefined) return;

    setDeleting(true);
    setDeleteError(null);

    deleteLead(username)
      .then(() => {
        setDeleting(false);
        setConfirmOpen(false);
        navigate('/leads', { replace: true, state: { deleted: username } });
      })
      .catch((cause: unknown) => {
        if (isCancelled(cause)) {
          setDeleting(false);
          return;
        }
        setDeleteError(errorMessage(cause));
        setDeleting(false);
      });
  }, [navigate, username]);

  if (loading) return <DetailSkeleton />;

  if (lead === null) {
    return (
      <MissingLead
        username={username ?? ''}
        notStored={errorCode === 'LEAD_NOT_FOUND'}
        message={error ?? 'This lead could not be loaded.'}
        onRetry={reload}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <ButtonLink
        to="/leads"
        variant="ghost"
        size="sm"
        iconLeft={<ArrowLeftIcon className="size-3.5" />}
        className="-ml-3"
      >
        All leads
      </ButtonLink>

      <div className="mt-4 flex flex-col gap-5">
        {refreshError !== null ? (
          <InlineNotice
            tone="error"
            title="Refresh failed — the stored profile below is unchanged"
            onDismiss={() => setRefreshError(null)}
            action={
              <Button variant="ghost" size="sm" onClick={refresh} loading={refreshing}>
                Retry
              </Button>
            }
          >
            {refreshError}
          </InlineNotice>
        ) : null}

        {refreshedAt !== null ? (
          <InlineNotice tone="success" title="Profile refreshed" onDismiss={() => setRefreshedAt(null)}>
            Re-fetched from LinkedIn{' '}
            {formatDateTime(refreshedAt) !== null ? `at ${formatDateTime(refreshedAt)}` : 'just now'}.
          </InlineNotice>
        ) : null}

        <ProfileHeader
          lead={lead}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={refresh}
                loading={refreshing}
                iconLeft={refreshing ? undefined : <RefreshIcon className="size-3.5" />}
              >
                {refreshing ? 'Refreshing' : 'Refresh'}
              </Button>
              <ExternalButtonLink
                href={profileUrlOf(lead)}
                variant="secondary"
                size="sm"
                iconRight={<ExternalIcon className="size-3.5" />}
              >
                View LinkedIn Profile
              </ExternalButtonLink>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                iconLeft={<TrashIcon className="size-3.5" />}
                aria-label={`Delete ${fullNameOf(lead)}`}
              >
                Delete
              </Button>
            </>
          }
        />

        {refreshing ? (
          <p role="status" className="text-2xs text-ink-muted">
            Asking LinkedIn for the latest version. The profile below stays in place until the new
            data arrives.
          </p>
        ) : null}

        <LeadSections lead={lead} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this lead?"
        description={`${fullNameOf(lead)} will be removed from the database. The profile can be extracted again later, which will fetch it from LinkedIn.`}
        confirmLabel={deleting ? 'Deleting' : 'Delete lead'}
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

interface MissingLeadProps {
  username: string;
  notStored: boolean;
  message: string;
  onRetry: () => void;
}

/**
 * Either the lead is not in the database, or the request failed. The first case
 * has an obvious next step, so it gets its own panel with an extract button.
 */
function MissingLead({ username, notStored, message, onRetry }: MissingLeadProps) {
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(() => {
    setWorking(true);
    setError(null);

    createOrGetLead(username)
      .then(() => {
        // Same route: reload it now that the profile exists.
        navigate(`/leads/${encodeURIComponent(username)}`, { replace: true });
        onRetry();
      })
      .catch((cause: unknown) => {
        if (isCancelled(cause)) return;
        setError(errorMessage(cause));
        setWorking(false);
      });
  }, [navigate, onRetry, username]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {notStored ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-faint">
            Not in the database
          </p>
          <h1 className="mt-3 text-2xl">
            <span className="slug">{username}</span> is not stored yet
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm text-ink-muted">
            Nothing has been extracted for this username. Fetching it from LinkedIn will store the
            profile and open it here.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="primary"
              onClick={extract}
              loading={working}
              iconLeft={working ? undefined : <BoltIcon className="size-4" />}
            >
              Extract from LinkedIn
            </Button>
            <ButtonLink to="/leads">Back to leads</ButtonLink>
          </div>

          {error !== null ? (
            <InlineNotice tone="error" className="mt-5 text-left" onDismiss={() => setError(null)}>
              {error}
            </InlineNotice>
          ) : null}
        </Card>
      ) : (
        <ErrorState
          title="This profile could not be loaded"
          message={message}
          onRetry={onRetry}
          action={<ButtonLink to="/leads" size="sm">Back to leads</ButtonLink>}
        />
      )}
    </div>
  );
}

/** Mirrors the real layout so the page does not jump when data lands. */
function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Loading profile">
      <Skeleton className="h-8 w-24 rounded-lg" />
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <Skeleton className="h-28 rounded-none sm:h-40" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex items-end gap-4 sm:-mt-16">
            <Skeleton className="size-28 rounded-xl ring-4 ring-white sm:size-32" />
            <div className="space-y-2 pb-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="mt-6 flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {[0, 1].map((index) => (
          <div key={index} className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
