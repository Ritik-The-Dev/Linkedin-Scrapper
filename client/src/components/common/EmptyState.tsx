import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Compact variant for use inside a card. */
  dense?: boolean;
}

/** Shown when a request succeeded but there is nothing to display. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  dense = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong',
        'bg-white/60 text-center',
        dense ? 'gap-2 px-6 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          {icon}
        </span>
      ) : null}
      <h3 className={cn('font-semibold text-ink', dense ? 'text-sm' : 'text-base')}>{title}</h3>
      {description !== undefined ? (
        <p className="max-w-sm text-pretty text-[0.8125rem] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
