import type { Experience, Lead } from '../../types/lead.ts';
import { cn } from '../../utils/cn.ts';
import {
  asArray,
  firstString,
  formatDateRange,
  formatDuration,
  initialsOf,
} from '../../utils/formatters.ts';
import { safeUrl } from '../../utils/entity.ts';
import { Badge } from '../common/Badge.tsx';
import { SectionCard } from '../common/Card.tsx';
import { BriefcaseIcon, ExternalIcon, PinIcon } from '../common/icons.tsx';

/** "Full-time" from "FULL_TIME". */
function employmentLabel(value: string | null | undefined): string | null {
  const raw = firstString(value);
  if (raw === null) return null;
  if (!raw.includes('_') && raw !== raw.toUpperCase()) return raw;
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join('-');
}

interface ExperienceTimelineProps {
  lead: Lead;
  /** Narrows the timeline, so a page can show current and previous separately. */
  only?: 'current' | 'previous';
  /** Overrides the section id, required when two timelines share a page. */
  id?: string;
  title?: string;
  /** Caps how many roles are listed; the rest are summarised in a footer line. */
  limit?: number;
  /** Clamps long descriptions — used by the dashboard preview, never the detail page. */
  clamp?: boolean;
}

/**
 * Work history as a vertical timeline.
 *
 * The order the backend stored is preserved — LinkedIn already returns roles
 * newest first, and re-sorting on partial dates would shuffle entries that only
 * have a year.
 */
export function ExperienceTimeline({
  lead,
  only,
  id = 'experience',
  title = 'Experience',
  limit,
  clamp = false,
}: ExperienceTimelineProps) {
  const all = asArray(lead.experience);
  const roles =
    only === 'current'
      ? all.filter((role) => role.current === true)
      : only === 'previous'
        ? all.filter((role) => role.current !== true)
        : all;

  if (roles.length === 0) return null;

  const shown = typeof limit === 'number' ? roles.slice(0, Math.max(0, limit)) : roles;
  const hidden = roles.length - shown.length;

  return (
    <SectionCard id={id} title={title} count={roles.length} icon={<BriefcaseIcon className="size-4" />}>
      <ol className="relative flex flex-col">
        {shown.map((role, index) => (
          <RoleRow
            key={firstString(role.entityUrn, role.positionUrn) ?? `role-${index}`}
            role={role}
            last={index === shown.length - 1}
            clamp={clamp}
          />
        ))}
      </ol>

      {hidden > 0 ? (
        <p className="mt-4 border-t border-line pt-3 text-2xs text-ink-faint">
          {hidden} earlier {hidden === 1 ? 'role' : 'roles'} on the full profile.
        </p>
      ) : null}
    </SectionCard>
  );
}

function RoleRow({ role, last, clamp }: { role: Experience; last: boolean; clamp: boolean }) {
  const title = firstString(role.title);
  const company = firstString(role.companyName);
  const companyUrl = safeUrl(role.companyUrl);
  const logo = firstString(role.companyLogoUrl);
  const range = formatDateRange(role.startDate, role.endDate, role.current);
  const duration = formatDuration(role.startDate, role.endDate, role.current);
  const employment = employmentLabel(role.employmentType);
  const location = firstString(role.location);
  const industry = firstString(role.companyIndustry);
  const description = firstString(role.description);

  const meta = [range, duration, employment].filter((part): part is string => part !== null);

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline rail. Decorative, so it is hidden from assistive tech. */}
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute left-[1.3125rem] top-11 h-[calc(100%-2.25rem)] w-px bg-line"
        />
      )}

      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-page">
        {logo !== null ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-contain p-0.5"
          />
        ) : (
          <span aria-hidden="true" className="font-display text-xs font-semibold text-ink-faint">
            {initialsOf(company)}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-[0.9375rem] font-semibold text-ink">{title ?? 'Role'}</h3>
          {role.current === true ? (
            <Badge tone="ok" className="translate-y-px">
              Current
            </Badge>
          ) : null}
        </div>

        {company !== null ? (
          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
            {companyUrl !== null ? (
              <a
                href={companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded font-medium text-brand-700 hover:underline"
              >
                {company}
                <ExternalIcon className="size-3" />
              </a>
            ) : (
              <span className="font-medium">{company}</span>
            )}
            {industry !== null ? <span className="text-ink-muted"> · {industry}</span> : null}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <p className="mt-1 font-mono text-2xs text-ink-faint">{meta.join('  ·  ')}</p>
        ) : null}

        {location !== null ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-2xs text-ink-muted">
            <PinIcon className="size-3" />
            {location}
          </p>
        ) : null}

        {description !== null ? (
          <p
            className={cn(
              'mt-2.5 whitespace-pre-line text-pretty text-[0.8125rem] leading-relaxed text-ink-soft',
              clamp && 'line-clamp-4',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </li>
  );
}
