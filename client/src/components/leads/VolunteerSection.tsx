import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString } from '../../utils/entity.ts';
import { asArray, formatDateRange } from '../../utils/formatters.ts';
import { Badge } from '../common/Badge.tsx';
import { SectionCard } from '../common/Card.tsx';
import { HeartIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function VolunteerSection({ lead }: { lead: Lead }) {
  const entries = asArray(lead.volunteerExperience);
  if (entries.length === 0) return null;

  const items: EntityItemData[] = entries.map((entry, index) => {
    const role = fieldString(entry, ['role', 'title', 'position']);
    const cause = fieldString(entry, ['cause', 'causeName']);
    const start = fieldDate(entry, ['startDate', 'timePeriodStart']);
    const end = fieldDate(entry, ['endDate', 'timePeriodEnd']);
    const current = entry['current'] === true;

    return {
      key: entityKey(entry, role, index),
      title: role,
      subtitle: fieldString(entry, ['companyName', 'organization', 'organizationName']),
      meta: formatDateRange(start, end, current),
      description: fieldString(entry, ['description']),
      badge:
        cause !== null ? (
          <Badge tone="cache" className="translate-y-px">
            {cause}
          </Badge>
        ) : undefined,
    };
  });

  return (
    <SectionCard
      id="volunteering"
      title="Volunteering"
      count={items.length}
      icon={<HeartIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
