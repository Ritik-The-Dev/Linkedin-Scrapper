import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';
import { Button } from './Button.tsx';
import { AlertIcon, RefreshIcon } from './icons.tsx';

interface ErrorStateProps {
  /** A user-facing sentence. Never a raw backend message or stack trace. */
  message: string;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  action?: ReactNode;
  className?: string;
  dense?: boolean;
}

/**
 * Failure panel with a way forward.
 *
 * Messages come from the API error mapper, which only ever hands over vetted,
 * single-line text — internal detail is never surfaced here.
 */
export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retrying = false,
  action,
  className,
  dense = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-bad-100',
        'bg-bad-50/60 text-center',
        dense ? 'px-6 py-8' : 'px-6 py-12',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-bad-100 text-bad-600">
        <AlertIcon className="size-5" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-md text-pretty text-[0.8125rem] text-ink-soft">{message}</p>
      </div>
      {onRetry || action ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              loading={retrying}
              iconLeft={<RefreshIcon className="size-3.5" />}
            >
              Try again
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
