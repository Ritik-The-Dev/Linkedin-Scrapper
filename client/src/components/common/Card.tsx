import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';

interface CardProps {
  className?: string;
  children: ReactNode;
}

/** Plain white surface with the standard border and radius. */
export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('rounded-2xl border border-line bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

interface SectionCardProps {
  /** Used as the heading id so the section can be linked and labelled. */
  id: string;
  title: string;
  icon?: ReactNode;
  /** Rendered next to the title, e.g. the number of rows in this section. */
  count?: number | null;
  action?: ReactNode;
  description?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * A titled block on the detail page.
 *
 * Rendered as a real `<section>` labelled by its own `<h2>`, so the profile is
 * navigable by landmark and heading rather than by visual scanning alone.
 */
export function SectionCard({
  id,
  title,
  icon,
  count,
  action,
  description,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn('rounded-2xl border border-line bg-white shadow-card', className)}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              {icon}
            </span>
          ) : null}
          <div>
            <h2
              id={`${id}-heading`}
              className="flex items-baseline gap-2 text-[0.9375rem] font-semibold text-ink"
            >
              {title}
              {typeof count === 'number' && count > 0 ? (
                <span className="font-mono text-2xs font-normal text-ink-faint">{count}</span>
              ) : null}
            </h2>
            {description !== null && description !== undefined ? (
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
