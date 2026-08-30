import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldString } from '../../utils/entity.ts';
import { asArray } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { BookIcon } from '../common/icons.tsx';

export function CoursesSection({ lead }: { lead: Lead }) {
  const courses = asArray(lead.courses);
  if (courses.length === 0) return null;

  const rows = courses.map((course, index) => {
    const name = fieldString(course, ['name', 'title', 'courseName']);
    return {
      key: entityKey(course, name, index),
      name,
      number: fieldString(course, ['number', 'courseNumber', 'code']),
    };
  });

  return (
    <SectionCard
      id="courses"
      title="Courses"
      count={rows.length}
      icon={<BookIcon className="size-4" />}
    >
      <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline gap-2 text-[0.875rem]">
            {row.number !== null ? (
              <span className="shrink-0 font-mono text-2xs text-ink-faint">{row.number}</span>
            ) : (
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" />
            )}
            <span className="text-ink-soft">{row.name ?? 'Course'}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
