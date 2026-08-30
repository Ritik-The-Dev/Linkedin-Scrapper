import type { Lead, Project } from '../../types/lead.ts';
import { entityKey, safeUrl } from '../../utils/entity.ts';
import { asArray, firstString, formatDateRange } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { LayersIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function ProjectsSection({ lead }: { lead: Lead }) {
  const projects = asArray(lead.projects);
  if (projects.length === 0) return null;

  const items: EntityItemData[] = projects.map((project: Project, index) => {
    const title = firstString(project.title);
    const contributors = asArray(project.contributors)
      .map((name) => firstString(name))
      .filter((name): name is string => name !== null);

    return {
      key: entityKey(project, title, index),
      title,
      meta: formatDateRange(project.startDate, project.endDate),
      description: firstString(project.description),
      url: safeUrl(project.url),
      tags: contributors,
    };
  });

  return (
    <SectionCard
      id="projects"
      title="Projects"
      count={items.length}
      icon={<LayersIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
