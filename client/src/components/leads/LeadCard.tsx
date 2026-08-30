import { Link } from 'react-router-dom';

import type { Lead } from '../../types/lead.ts';
import { cn } from '../../utils/cn.ts';
import {
  asArray,
  currentCompanyOf,
  currentTitleOf,
  fullNameOf,
  headlineOf,
  locationOf,
  profileImageOf,
  relativeTime,
} from '../../utils/formatters.ts';
import { Avatar } from '../common/Avatar.tsx';
import { BriefcaseIcon, ClockIcon, PinIcon } from '../common/icons.tsx';
import { StatusBadges } from './StatusBadges.tsx';

interface LeadCardProps {
  lead: Lead;
  /** Highlights a card that was just extracted or refreshed. */
  highlight?: boolean;
  className?: string;
}

/**
 * Summary card used on the dashboard and the leads list.
 *
 * Only the name is a link; it is stretched over the whole card with a pseudo
 * element, so the entire surface is clickable while keyboard users get a single
 * clear tab stop.
 */
export function LeadCard({ lead, highlight = false, className }: LeadCardProps) {
  const name = fullNameOf(lead);
  const headline = headlineOf(lead);
  const location = locationOf(lead);
  const company = currentCompanyOf(lead);
  const title = currentTitleOf(lead);
  // Title and company share one line to keep the card compact (spec §16).
  const role =
    title !== null && company !== null ? `${title} · ${company}` : (title ?? company);
  const seen = relativeTime(lead.lastSeenAt);
  const skillCount = asArray(lead.skills).length;

  return (
    <article
      className={cn(
        'motion-translate group relative flex flex-col rounded-2xl border bg-white p-5',
        'shadow-card transition-[border-color,box-shadow,transform] duration-200',
        'hover:-translate-y-0.5 hover:shadow-lift focus-within:-translate-y-0.5 focus-within:shadow-lift',
        highlight ? 'border-brand-300 ring-1 ring-brand-200' : 'border-line hover:border-brand-200',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar src={profileImageOf(lead, 200)} name={name} size="md" />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.9375rem] font-semibold text-ink">
            <Link
              to={`/leads/${encodeURIComponent(lead.username)}`}
              className="rounded after:absolute after:inset-0 after:content-[''] hover:text-brand-700"
            >
              {name}
            </Link>
          </h3>
          <p className="slug mt-0.5 truncate">{lead.username}</p>

          {headline !== null ? (
            <p className="mt-2 line-clamp-2 text-pretty text-[0.8125rem] leading-snug text-ink-soft">
              {headline}
            </p>
          ) : null}
        </div>
      </div>

      {role !== null || location !== null ? (
        <dl className="mt-4 space-y-1.5 text-xs text-ink-muted">
          {role !== null ? (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Current role</dt>
              <BriefcaseIcon className="size-3.5 shrink-0 text-ink-faint" />
              <dd className="truncate">{role}</dd>
            </div>
          ) : null}
          {location !== null ? (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <PinIcon className="size-3.5 shrink-0 text-ink-faint" />
              <dd className="truncate">{location}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
        <StatusBadges lead={lead} />
        {skillCount > 0 ? (
          <span className="text-2xs text-ink-faint">
            {skillCount} skill{skillCount === 1 ? '' : 's'}
          </span>
        ) : null}
        {seen !== null ? (
          <span className="ml-auto inline-flex items-center gap-1 text-2xs text-ink-faint">
            <ClockIcon className="size-3" />
            {seen}
          </span>
        ) : null}
      </div>
    </article>
  );
}
