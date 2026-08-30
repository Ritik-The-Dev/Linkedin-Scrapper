import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString, fieldStringList, fieldUrl } from '../../utils/entity.ts';
import { asArray, formatLinkedInDate } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { BulbIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function PatentsSection({ lead }: { lead: Lead }) {
  const patents = asArray(lead.patents);
  if (patents.length === 0) return null;

  const items: EntityItemData[] = patents.map((patent, index) => {
    const title = fieldString(patent, ['title', 'name']);
    const number = fieldString(patent, ['number', 'patentNumber', 'applicationNumber']);
    const date = fieldDate(patent, ['issueDate', 'date', 'filingDate']);

    const meta = [
      number !== null ? `Patent ${number}` : null,
      formatLinkedInDate(date),
    ].filter((part): part is string => part !== null);

    return {
      key: entityKey(patent, title, index),
      title,
      subtitle: fieldString(patent, ['office', 'issuer', 'authority']),
      meta: meta.length > 0 ? meta.join('  ·  ') : null,
      description: fieldString(patent, ['description']),
      url: fieldUrl(patent, ['url', 'link']),
      tags: fieldStringList(patent, ['inventors', 'contributors']),
    };
  });

  return (
    <SectionCard
      id="patents"
      title="Patents"
      count={items.length}
      icon={<BulbIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
