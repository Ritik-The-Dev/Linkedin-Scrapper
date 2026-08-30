import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import { importLeads } from '../../services/api.ts';
import { errorMessage, isCancelled } from '../../services/errors.ts';
import type { ImportResult } from '../../types/api.ts';
import { cn } from '../../utils/cn.ts';
import { Button } from '../common/Button.tsx';
import { SectionCard } from '../common/Card.tsx';
import { InlineNotice } from '../common/InlineNotice.tsx';
import { DownloadIcon, UploadIcon } from '../common/icons.tsx';
import { ImportResults } from './ImportResults.tsx';

/** Exactly the extensions the contract lists: .xlsx, .xls, .csv. */
const ACCEPT = '.xlsx,.xls,.csv';
const ALLOWED = ['.xlsx', '.xls', '.csv'];

/** Guard rail before the upload leaves the browser; the backend validates too. */
const MAX_BYTES = 10 * 1024 * 1024;

type Phase = 'idle' | 'uploading' | 'processing';

interface ImportPanelProps {
  /** Fired after a successful import so the dashboard can refresh its data. */
  onImported: () => void;
}

/**
 * Excel import.
 *
 * Two honest phases: the upload has a real byte-level percentage, and once the
 * bytes have landed the backend works through the rows without reporting
 * progress — so the UI says exactly that instead of animating a fake per-lead
 * counter.
 */
export function ImportPanel({ onImported }: ImportPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => () => inFlight.current?.abort(), []);

  const busy = phase !== 'idle';

  const upload = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      if (!ALLOWED.some((extension) => lower.endsWith(extension))) {
        setError('That file type is not supported. Upload an .xlsx, .xls or .csv file.');
        setResult(null);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('That file is larger than 10 MB. Split the list into smaller batches.');
        setResult(null);
        return;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setFileName(file.name);
      setError(null);
      setResult(null);
      setPercent(0);
      setPhase('uploading');

      importLeads(
        file,
        (sent) => {
          if (controller.signal.aborted) return;
          setPercent(sent);
          if (sent >= 100) setPhase('processing');
        },
        controller.signal,
      )
        .then((imported) => {
          if (controller.signal.aborted) return;
          setResult(imported);
          setPhase('idle');
          onImported();
        })
        .catch((cause: unknown) => {
          if (isCancelled(cause) || controller.signal.aborted) {
            setPhase('idle');
            return;
          }
          setError(errorMessage(cause));
          setPhase('idle');
        })
        .finally(() => {
          // Allows the same file to be picked again after a failure.
          if (inputRef.current) inputRef.current.value = '';
        });
    },
    [onImported],
  );

  const onPick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) upload(file);
    },
    [upload],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (busy) return;
      const file = event.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [busy, upload],
  );

  const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);

  const cancel = useCallback(() => {
    inFlight.current?.abort();
    setPhase('idle');
  }, []);

  return (
    <SectionCard
      id="import"
      title="Import from Excel"
      icon={<UploadIcon className="size-4" />}
      description="One column named username. Rows can be usernames or full profile URLs."
      action={
        <a
          href="/demo-leads.xlsx"
          download
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-2xs font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-ink"
        >
          <DownloadIcon className="size-3.5" />
          Demo file
        </a>
      }
    >
      <div
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={cn(
          'rounded-xl border border-dashed px-5 py-7 text-center transition-colors duration-150',
          dragging ? 'border-brand-400 bg-brand-50/70' : 'border-line-strong bg-page/60',
          busy && 'opacity-80',
        )}
      >
        <UploadIcon className="mx-auto size-6 text-ink-faint" />

        <p className="mt-3 text-sm text-ink-soft">
          {/* The input sits immediately before its label so `peer-focus-visible`
              can move the focus ring onto the visible control. */}
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            disabled={busy}
            className="peer sr-only"
          />
          <label
            htmlFor="import-file"
            className={cn(
              'cursor-pointer rounded font-medium text-brand-700 underline underline-offset-2',
              'hover:text-brand-800 peer-focus-visible:outline-none peer-focus-visible:ring-2',
              'peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            Choose a spreadsheet
          </label>{' '}
          or drop one here
        </p>
        <p className="mt-1 text-2xs text-ink-faint">.xlsx, .xls or .csv · up to 10 MB</p>

        {busy ? (
          <Progress phase={phase} percent={percent} fileName={fileName} onCancel={cancel} />
        ) : null}
      </div>

      {error !== null ? (
        <InlineNotice tone="error" title="Import failed" className="mt-4" onDismiss={() => setError(null)}>
          {error}
        </InlineNotice>
      ) : null}

      {result !== null ? <ImportResults result={result} /> : null}
    </SectionCard>
  );
}

interface ProgressProps {
  phase: Phase;
  percent: number;
  fileName: string | null;
  onCancel: () => void;
}

function Progress({ phase, percent, fileName, onCancel }: ProgressProps) {
  const uploading = phase === 'uploading';

  return (
    <div className="mx-auto mt-5 max-w-md text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[0.8125rem] font-medium text-ink" title={fileName ?? undefined}>
          {fileName ?? 'Spreadsheet'}
        </p>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {uploading ? (
        <>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-2xs text-ink-muted">Uploading… {percent}%</p>
        </>
      ) : (
        <>
          {/* Indeterminate on purpose: the API reports no per-row progress. */}
          <div className="shimmer-bg animate-shimmer mt-2 h-1.5 overflow-hidden rounded-full" />
          <p role="status" className="mt-1.5 text-2xs text-ink-muted">
            <span className="font-medium text-ink-soft">Processing leads…</span> Uploaded in full.
            The backend is working through the rows now — it does not report per-lead progress, so
            this stays put until the whole import comes back.
          </p>
        </>
      )}
    </div>
  );
}
