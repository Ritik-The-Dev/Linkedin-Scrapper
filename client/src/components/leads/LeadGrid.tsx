import type { Lead } from '../../types/lead.ts';
import { cn } from '../../utils/cn.ts';
import { LeadCard } from './LeadCard.tsx';

interface LeadGridProps {
  leads: Lead[];
  /** Usernames to mark as just-added or just-refreshed. */
  highlighted?: ReadonlySet<string>;
  /** Dims the grid while a new page is being fetched. */
  pending?: boolean;
  className?: string;
}

/**
 * The shared card grid for the dashboard and the leads list.
 *
 * While a new page loads the existing cards stay on screen and simply dim,
 * which keeps the layout from collapsing between pages.
 */
export function LeadGrid({ leads, highlighted, pending = false, className }: LeadGridProps) {
  return (
    <ul
      className={cn(
        'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
        pending && 'pointer-events-none opacity-60 transition-opacity duration-200',
        className,
      )}
      aria-busy={pending || undefined}
    >
      {leads.map((lead) => (
        <li key={lead._id.length > 0 ? lead._id : lead.username} className="flex">
          <LeadCard
            lead={lead}
            highlight={highlighted?.has(lead.username) === true}
            className="w-full"
          />
        </li>
      ))}
    </ul>
  );
}
