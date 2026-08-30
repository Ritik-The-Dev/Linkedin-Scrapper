import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString, fieldUrl } from '../../utils/entity.ts';
import { asArray, formatLinkedInDate } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { TrophyIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function HonorsSection({ lead }: { lead: Lead }) {
  const honors = asArray(lead.honors);
  if (honors.length === 0) return null;

  const items: EntityItemData[] = honors.map((honor, index) => {
    const title = fieldString(honor, ['title', 'name']);
    const date = fieldDate(honor, ['issueDate', 'date', 'issuedOn']);

    return {
      key: entityKey(honor, title, index),
      title,
      subtitle: fieldString(honor, ['issuer', 'authority', 'organization']),
      meta: formatLinkedInDate(date),
      description: fieldString(honor, ['description']),
      url: fieldUrl(honor, ['url', 'link']),
    };
  });

  return (
    <SectionCard
      id="honors"
      title="Honors & awards"
      count={items.length}
      icon={<TrophyIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
