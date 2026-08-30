import type { Lead, ProfileStatus } from '../../types/lead.ts';
import { Badge } from '../common/Badge.tsx';
import { BoltIcon, BriefcaseIcon, SparkIcon, StarIcon } from '../common/icons.tsx';

interface StatusBadgesProps {
  lead: Lead;
  /**
   * Names the flags LinkedIn did not provide. Used on the detail page, where the
   * distinction between "false" and "not provided" is worth stating.
   */
  showUnknown?: boolean;
}

/** Flags worth reporting on, in the order they should read. */
const FLAGS: ReadonlyArray<readonly [keyof ProfileStatus, string]> = [
  ['openToWork', 'Open to work'],
  ['hiring', 'Hiring'],
  ['premium', 'Premium'],
  ['creator', 'Creator'],
  ['influencer', 'Influencer'],
];

/**
 * Profile flags are tri-state: true, false, or null for "LinkedIn told us
 * nothing". A badge is rendered only for `true` — a null or false flag is never
 * turned into a negative claim such as "Hiring: No".
 */
export function StatusBadges({ lead, showUnknown = false }: StatusBadgesProps) {
  const status = lead.profile?.profileStatus;
  if (!status) return null;

  // `premium` and `premiumBadge` describe the same thing in the payload.
  const premium = status.premium ?? status.premiumBadge ?? null;

  const valueOf = (key: keyof ProfileStatus): boolean | null =>
    key === 'premium' ? premium : (status[key] ?? null);

  const unknown = showUnknown
    ? FLAGS.filter(([key]) => valueOf(key) === null).map(([, label]) => label)
    : [];

  const badges = [
    status.openToWork === true && (
      <Badge key="openToWork" tone="ok" icon={<BriefcaseIcon className="size-3" />}>
        Open to work
      </Badge>
    ),
    status.hiring === true && (
      <Badge key="hiring" tone="brand" icon={<BoltIcon className="size-3" />}>
        Hiring
      </Badge>
    ),
    premium === true && (
      <Badge key="premium" tone="warn" icon={<StarIcon className="size-3" />}>
        Premium
      </Badge>
    ),
    status.creator === true && (
      <Badge key="creator" tone="cache" icon={<SparkIcon className="size-3" />}>
        Creator
      </Badge>
    ),
    status.influencer === true && (
      <Badge key="influencer" tone="brand">
        Influencer
      </Badge>
    ),
  ].filter((node) => node !== false);

  if (badges.length === 0 && unknown.length === 0) return null;

  return (
    <>
      {badges}
      {unknown.length > 0 ? (
        <span
          className="text-2xs text-ink-faint"
          title="LinkedIn returned no value for these, so no claim is made either way."
        >
          {unknown.join(', ')} not reported
        </span>
      ) : null}
    </>
  );
}
