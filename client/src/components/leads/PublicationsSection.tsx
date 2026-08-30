import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString, fieldStringList, fieldUrl } from '../../utils/entity.ts';
import { asArray, formatLinkedInDate } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { FileIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function PublicationsSection({ lead }: { lead: Lead }) {
  const publications = asArray(lead.publications);
  if (publications.length === 0) return null;

  const items: EntityItemData[] = publications.map((publication, index) => {
    const name = fieldString(publication, ['name', 'title']);
    const date = fieldDate(publication, ['date', 'publishedOn', 'publicationDate']);

    return {
      key: entityKey(publication, name, index),
      title: name,
      subtitle: fieldString(publication, ['publisher', 'journal', 'publicationName']),
      meta: formatLinkedInDate(date),
      description: fieldString(publication, ['description', 'summary']),
      url: fieldUrl(publication, ['url', 'link']),
      tags: fieldStringList(publication, ['authors', 'contributors']),
    };
  });

  return (
    <SectionCard
      id="publications"
      title="Publications"
      count={items.length}
      icon={<FileIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
