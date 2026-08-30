import { cn } from '../../utils/cn.ts';

interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder. Decorative, so hidden from assistive tech. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block rounded-md shimmer-bg animate-shimmer', className)}
    />
  );
}

/** Card-shaped placeholder used while a page of leads loads. */
export function LeadCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
}

export function LeadCardSkeletonList({ count = 6 }: SkeletonListProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Loading leads"
    >
      {Array.from({ length: count }, (_, index) => (
        <LeadCardSkeleton key={index} />
      ))}
    </div>
  );
}
