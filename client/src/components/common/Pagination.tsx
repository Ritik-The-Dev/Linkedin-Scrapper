import { cn } from '../../utils/cn.ts';
import type { Pagination as PaginationMeta } from '../../types/api.ts';
import { Button } from './Button.tsx';
import { ArrowLeftIcon, ArrowRightIcon } from './icons.tsx';

interface PaginationProps {
  pagination: PaginationMeta;
  onChange: (page: number) => void;
  /** Disabled while a page is in flight, to stop double navigation. */
  busy?: boolean;
  className?: string;
}

/**
 * Builds a compact page window: 1 … 4 5 6 … 12
 * Returns page numbers, with `null` standing in for a gap.
 */
function pageWindow(page: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < totalPages) pages.add(page + 1);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const ordered = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const withGaps: Array<number | null> = [];
  let previous = 0;
  for (const value of ordered) {
    if (previous !== 0 && value - previous > 1) withGaps.push(null);
    withGaps.push(value);
    previous = value;
  }
  return withGaps;
}

/**
 * Page navigation driven entirely by the API's own pagination block — the
 * next/previous buttons follow `hasNextPage` / `hasPreviousPage` rather than
 * guessing from counts.
 */
export function Pagination({ pagination, onChange, busy = false, className }: PaginationProps) {
  const { page, limit, total, totalPages, hasNextPage, hasPreviousPage } = pagination;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between', className)}
    >
      <p className="text-xs text-ink-muted" aria-live="polite">
        Showing <span className="font-mono text-ink-soft">{from}</span>–
        <span className="font-mono text-ink-soft">{to}</span> of{' '}
        <span className="font-mono text-ink-soft">{total}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={!hasPreviousPage || busy}
          onClick={() => onChange(page - 1)}
          iconLeft={<ArrowLeftIcon className="size-3.5" />}
          aria-label="Previous page"
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <ol className="flex items-center gap-1">
          {pageWindow(page, totalPages).map((value, index) =>
            value === null ? (
              <li
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-xs text-ink-faint"
              >
                …
              </li>
            ) : (
              <li key={value}>
                <button
                  type="button"
                  onClick={() => onChange(value)}
                  disabled={busy}
                  aria-label={`Page ${value}`}
                  aria-current={value === page ? 'page' : undefined}
                  className={cn(
                    'size-8 rounded-lg font-mono text-xs transition-colors',
                    value === page
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
                    busy && 'cursor-not-allowed opacity-60',
                  )}
                >
                  {value}
                </button>
              </li>
            ),
          )}
        </ol>

        <Button
          size="sm"
          variant="secondary"
          disabled={!hasNextPage || busy}
          onClick={() => onChange(page + 1)}
          iconRight={<ArrowRightIcon className="size-3.5" />}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>
    </nav>
  );
}
