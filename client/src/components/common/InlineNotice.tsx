import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons.tsx';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<NoticeTone, { shell: string; icon: string }> = {
  info: { shell: 'border-brand-100 bg-brand-50 text-brand-900', icon: 'text-brand-600' },
  success: { shell: 'border-ok-100 bg-ok-50 text-ok-700', icon: 'text-ok-500' },
  warning: { shell: 'border-warn-100 bg-warn-50 text-warn-700', icon: 'text-warn-500' },
  error: { shell: 'border-bad-100 bg-bad-50 text-bad-700', icon: 'text-bad-500' },
};

function iconFor(tone: NoticeTone): ReactNode {
  const className = cn('size-4 shrink-0', TONES[tone].icon);
  if (tone === 'success') return <CheckIcon className={className} />;
  if (tone === 'info') return <InfoIcon className={className} />;
  return <AlertIcon className={className} />;
}

interface InlineNoticeProps {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Contextual message shown next to the thing it refers to.
 *
 * Errors get `role="alert"` so they are announced immediately; everything else
 * is a polite status update.
 */
export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: InlineNoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-[0.8125rem] animate-fade',
        TONES[tone].shell,
        className,
      )}
    >
      <span className="mt-0.5">{iconFor(tone)}</span>
      <div className="min-w-0 flex-1">
        {title !== undefined ? <p className="font-medium">{title}</p> : null}
        {children !== undefined ? (
          <div className={cn('text-pretty', title !== undefined && 'mt-0.5 opacity-90')}>
            {children}
          </div>
        ) : null}
      </div>
      {action}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-mr-1 -mt-1 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <CloseIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
