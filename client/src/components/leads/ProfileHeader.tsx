import type { ReactNode } from 'react';

import type { Lead } from '../../types/lead.ts';
import { cn } from '../../utils/cn.ts';
import {
  currentCompanyOf,
  currentTitleOf,
  backgroundImageOf,
  formatDateTime,
  formatNumber,
  formatPronouns,
  fullNameOf,
  headlineOf,
  industryOf,
  profileImageOf,
  relativeTime,
} from '../../utils/formatters.ts';
import { profileUrlOf } from '../../utils/linkedin.ts';
import { Avatar } from '../common/Avatar.tsx';
import { CopyButton } from '../common/CopyButton.tsx';
import { CopyJsonButton } from '../common/CopyJsonButton.tsx';
import { StatusBadges } from './StatusBadges.tsx';
import { BriefcaseIcon, ClockIcon, GlobeIcon, PinIcon, UsersIcon } from '../common/icons.tsx';

interface ProfileHeaderProps {
  lead: Lead;
  /** Refresh / delete / open-on-LinkedIn controls, supplied by the page. */
  actions?: ReactNode;
  /**
   * Preview mode for the dashboard: the name becomes an `h2` (the page already
   * owns its `h1`) and the banner is shorter.
   */
  compact?: boolean;
}

/**
 * Top of the detail page: banner, photo, identity and the action row.
 *
 * Profile flags come from `StatusBadges` with `showUnknown`, which names the
 * flags LinkedIn did not return instead of implying they are false.
 */
export function ProfileHeader({ lead, actions, compact = false }: ProfileHeaderProps) {
  const name = fullNameOf(lead);
  const headline = headlineOf(lead);
  const pronouns = formatPronouns(lead.profile?.pronouns);
  const location = lead.profile?.location;
  const locationLabel = location?.locationName ?? null;
  const industry = industryOf(lead);
  const company = currentCompanyOf(lead);
  const title = currentTitleOf(lead);
  const banner = backgroundImageOf(lead);
  const relationship = lead.profile?.relationship;
  const followers = formatNumber(relationship?.followerCount);
  const connections = formatNumber(relationship?.connectionCount);
  const profileUrl = profileUrlOf(lead);

  const firstSeen = formatDateTime(lead.firstSeenAt);
  const lastRefreshed = formatDateTime(lead.lastRefreshedAt);
  const lastSeen = relativeTime(lead.lastSeenAt);
  const refreshCount = typeof lead.refreshCount === 'number' ? lead.refreshCount : null;

  // A page has exactly one h1; in preview mode the dashboard already has it.
  const Heading = compact ? 'h2' : 'h1';

  return (
    <header className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className={cn('relative', compact ? 'h-20 sm:h-24' : 'h-28 sm:h-40')}>
        {banner !== null ? (
          <img
            src={banner}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="mesh size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/15 to-transparent" />
      </div>

      <div className="px-5 pb-5 sm:px-7 sm:pb-6">
        <div className="-mt-12 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar src={profileImageOf(lead, 400)} name={name} size="xl" ring />

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <Heading className="text-2xl sm:text-[1.75rem]">{name}</Heading>
                {pronouns !== null ? (
                  <span className="text-xs text-ink-muted">({pronouns})</span>
                ) : null}
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="slug-chip">/in/{lead.username}</span>
                <CopyButton
                  value={lead.username}
                  label="username"
                  className="text-ink-faint hover:text-ink-soft"
                />
              </div>
            </div>
          </div>

          {actions !== undefined ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {headline !== null ? (
          <p className="mt-5 max-w-3xl text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
            {headline}
          </p>
        ) : null}

        <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-muted">
          {company !== null ? (
            <Fact icon={<BriefcaseIcon className="size-4 text-ink-faint" />} label="Current company">
              {title !== null ? `${title} · ${company}` : company}
            </Fact>
          ) : null}
          {locationLabel !== null ? (
            <Fact icon={<PinIcon className="size-4 text-ink-faint" />} label="Location">
              {locationLabel}
            </Fact>
          ) : null}
          {industry !== null ? (
            <Fact icon={<GlobeIcon className="size-4 text-ink-faint" />} label="Industry">
              {industry}
            </Fact>
          ) : null}
          {followers !== null ? (
            <Fact icon={<UsersIcon className="size-4 text-ink-faint" />} label="Followers">
              {followers} followers
            </Fact>
          ) : null}
          {connections !== null ? (
            <Fact icon={null} label="Connections">
              {connections} connections
            </Fact>
          ) : null}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <StatusBadges lead={lead} showUnknown />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4 font-mono text-2xs text-ink-faint">
          {lastSeen !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-3" />
              Last seen {lastSeen}
            </span>
          ) : null}
          {firstSeen !== null ? <span>First stored {firstSeen}</span> : null}
          {lastRefreshed !== null ? <span>Refreshed {lastRefreshed}</span> : null}
          {refreshCount !== null ? (
            <span>
              {refreshCount} refresh{refreshCount === 1 ? '' : 'es'}
            </span>
          ) : null}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded text-brand-700 hover:underline"
          >
            {profileUrl.replace(/^https:\/\//, '')}
          </a>
          <CopyJsonButton data={lead} variant="label" />
        </div>
      </div>
    </header>
  );
}

interface FactProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}

function Fact({ icon, label, children }: FactProps) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">{label}</dt>
      {icon}
      <dd>{children}</dd>
    </div>
  );
}
