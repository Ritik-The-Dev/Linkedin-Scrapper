import type { ReactNode } from 'react';

import { cn } from '../../utils/cn.ts';
import { displayHost } from '../../utils/entity.ts';
import { ExternalIcon } from '../common/icons.tsx';

export interface EntityItemData {
  key: string;
  title: string | null;
  subtitle?: string | null;
  meta?: string | null;
  /** Full text — never truncated, per the detail-page rule. */
  description?: string | null;
  url?: string | null;
  /** Small pills under the text, e.g. contributors or a proficiency level. */
  tags?: string[];
  badge?: ReactNode;
}

interface EntityListProps {
  items: EntityItemData[];
  /** Two columns on wide screens, for short entries such as courses. */
  columns?: boolean;
  className?: string;
}

/**
 * The repeated "title / subtitle / meta / description" block used by most
 * profile sections.
 *
 * Every row is a `<li>` inside a real list, so a screen reader announces how
 * many entries a section holds before reading them.
 */
export function EntityList({ items, columns = false, className }: EntityListProps) {
  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        columns ? 'grid gap-x-8 gap-y-4 sm:grid-cols-2' : 'flex flex-col divide-y divide-line',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.key} className={columns ? undefined : 'py-4 first:pt-0 last:pb-0'}>
          <EntityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function EntityRow({ item }: { item: EntityItemData }) {
  const { title, subtitle, meta, description, url, tags, badge } = item;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[0.875rem] font-semibold text-ink">{title ?? 'Untitled'}</h3>
        {badge}
      </div>

      {subtitle !== null && subtitle !== undefined ? (
        <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{subtitle}</p>
      ) : null}

      {meta !== null && meta !== undefined ? (
        <p className="mt-1 font-mono text-2xs text-ink-faint">{meta}</p>
      ) : null}

      {description !== null && description !== undefined ? (
        <p className="mt-2 whitespace-pre-line text-pretty text-[0.8125rem] leading-relaxed text-ink-soft">
          {description}
        </p>
      ) : null}

      {tags !== undefined && tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-md border border-line bg-page px-2 py-0.5 text-2xs text-ink-muted"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {url !== null && url !== undefined ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded text-2xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          {displayHost(url)}
          <ExternalIcon className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
