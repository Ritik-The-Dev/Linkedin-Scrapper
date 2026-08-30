import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';

export type BadgeTone = 'brand' | 'cache' | 'ok' | 'warn' | 'bad' | 'neutral' | 'outline';

const TONES: Record<BadgeTone, string> = {
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  cache: 'border-cache-100 bg-cache-50 text-cache-700',
  ok: 'border-ok-100 bg-ok-50 text-ok-700',
  warn: 'border-warn-100 bg-warn-50 text-warn-700',
  bad: 'border-bad-100 bg-bad-50 text-bad-700',
  neutral: 'border-line bg-white text-ink-muted',
  outline: 'border-line-strong bg-transparent text-ink-soft',
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  title?: string;
}

/**
 * Small status pill.
 *
 * Only ever used for facts that are positively true — a null profile flag means
 * "unknown", so no badge is rendered at all rather than a negative one.
 */
export function Badge({ tone = 'neutral', icon, className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium leading-none',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
