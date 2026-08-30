import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { LeadSource } from '../../types/api.ts';
import type { Lead } from '../../types/lead.ts';
import { fullNameOf } from '../../utils/formatters.ts';
import { profileUrlOf } from '../../utils/linkedin.ts';
import { Badge } from '../common/Badge.tsx';
import { Button, ButtonLink, ExternalButtonLink } from '../common/Button.tsx';
import { ArrowRightIcon, BoltIcon, DatabaseIcon, ExternalIcon } from '../common/icons.tsx';
import { AboutSection } from './AboutSection.tsx';
import { EducationSection } from './EducationSection.tsx';
import { ExperienceTimeline } from './ExperienceTimeline.tsx';
import { ProfileHeader } from './ProfileHeader.tsx';
import { ProjectsSection } from './ProjectsSection.tsx';
import { SkillsGrid } from './SkillsGrid.tsx';

/** How many past roles the preview lists before deferring to the detail page. */
const PREVIOUS_ROLE_LIMIT = 3;

interface LeadPreviewProps {
  lead: Lead;
  /** The backend's own `source`, shown as UX feedback only. */
  source: LeadSource | null;
  onDismiss?: () => void;
}

/**
 * The search result panel that appears directly below the dashboard's input.
 *
 * It is a preview, not a second detail page: the sections here are the ones the
 * spec calls for (about, current and previous experience, education, skills,
 * projects) and everything else waits behind "Open full profile", so the
 * dashboard stays scannable.
 */
export function LeadPreview({ lead, source, onDismiss }: LeadPreviewProps) {
  const detailPath = `/leads/${encodeURIComponent(lead.username)}`;

  return (
    <section
      aria-labelledby="search-result-heading"
      className="animate-rise rounded-2xl border border-brand-100 bg-brand-50/40 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2
            id="search-result-heading"
            className="font-mono text-2xs uppercase tracking-[0.18em] text-brand-700"
          >
            Search result
          </h2>
          <SourceBadge source={source} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            to={detailPath}
            variant="primary"
            size="sm"
            iconRight={<ArrowRightIcon className="size-3.5" />}
          >
            Open full profile
          </ButtonLink>
          <ExternalButtonLink
            href={profileUrlOf(lead)}
            size="sm"
            iconRight={<ExternalIcon className="size-3.5" />}
          >
            View LinkedIn Profile
          </ExternalButtonLink>
          {onDismiss !== undefined ? (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ProfileHeader lead={lead} compact />

        <SourceNote source={source} />

        <AboutSection lead={lead} />

        <ExperienceTimeline
          lead={lead}
          only="current"
          id="preview-experience-current"
          title="Current experience"
          clamp
        />
        <ExperienceTimeline
          lead={lead}
          only="previous"
          id="preview-experience-previous"
          title="Previous experience"
          limit={PREVIOUS_ROLE_LIMIT}
          clamp
        />

        <EducationSection lead={lead} />
        <SkillsGrid lead={lead} />
        <ProjectsSection lead={lead} />

        <p className="px-2 pb-1 text-center text-[0.8125rem] text-ink-muted">
          Certifications, languages, courses, publications and the rest of{' '}
          {fullNameOf(lead)}&rsquo;s record are on the{' '}
          <Link to={detailPath} className="font-medium text-brand-700 underline underline-offset-2 hover:no-underline">
            full profile
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/**
 * The backend tells us whether it went to LinkedIn or answered from Mongo. That
 * is genuinely useful feedback, so it is surfaced — but never inferred.
 */
function SourceBadge({ source }: { source: LeadSource | null }): ReactNode {
  if (source === 'linkedin') {
    return (
      <Badge tone="brand" icon={<BoltIcon className="size-3" />} title="source: linkedin">
        Fetched from LinkedIn
      </Badge>
    );
  }
  if (source === 'database') {
    return (
      <Badge tone="cache" icon={<DatabaseIcon className="size-3" />} title="source: database">
        Served from storage
      </Badge>
    );
  }
  return null;
}

/** The one line that explains what the badge above actually means. */
function SourceNote({ source }: { source: LeadSource | null }): ReactNode {
  if (source === null) return null;

  return (
    <p className="px-2 text-[0.8125rem] text-ink-muted">
      {source === 'database'
        ? 'This profile was already stored, so it came straight from the database — LinkedIn was not contacted. Use Refresh on the full profile to fetch it again.'
        : 'This profile was not stored yet, so the backend fetched it from LinkedIn and saved it. Searching it again will be instant.'}
    </p>
  );
}
