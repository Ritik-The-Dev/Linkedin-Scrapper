import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString, fieldUrl } from '../../utils/entity.ts';
import { asArray, formatDateRange } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { UsersIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function OrganizationsSection({ lead }: { lead: Lead }) {
  const organizations = asArray(lead.organizations);
  if (organizations.length === 0) return null;

  const items: EntityItemData[] = organizations.map((organization, index) => {
    const name = fieldString(organization, ['name', 'organizationName', 'title']);
    const start = fieldDate(organization, ['startDate', 'timePeriodStart']);
    const end = fieldDate(organization, ['endDate', 'timePeriodEnd']);

    return {
      key: entityKey(organization, name, index),
      title: name,
      subtitle: fieldString(organization, ['position', 'role', 'positionHeld']),
      meta: formatDateRange(start, end, organization['current'] === true),
      description: fieldString(organization, ['description']),
      url: fieldUrl(organization, ['url', 'link']),
    };
  });

  return (
    <SectionCard
      id="organizations"
      title="Organizations"
      count={items.length}
      icon={<UsersIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
