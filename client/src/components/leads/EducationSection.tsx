import type { Education, Lead } from '../../types/lead.ts';
import { safeUrl } from '../../utils/entity.ts';
import {
  asArray,
  bestImageUrl,
  firstString,
  formatDateRange,
  initialsOf,
} from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { CapIcon, ExternalIcon } from '../common/icons.tsx';

export function EducationSection({ lead }: { lead: Lead }) {
  const schools = asArray(lead.education);
  if (schools.length === 0) return null;

  return (
    <SectionCard
      id="education"
      title="Education"
      count={schools.length}
      icon={<CapIcon className="size-4" />}
    >
      <ul className="flex flex-col divide-y divide-line">
        {schools.map((school, index) => (
          <li
            key={firstString(school.entityUrn, school.schoolUrn) ?? `school-${index}`}
            className="py-4 first:pt-0 last:pb-0"
          >
            <SchoolRow school={school} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function SchoolRow({ school }: { school: Education }) {
  const name = firstString(school.schoolName);
  const url = safeUrl(school.schoolUrl);
  const logo = bestImageUrl(school.schoolLogo, 200);
  const degree = firstString(school.degree);
  const field = firstString(school.fieldOfStudy);
  const grade = firstString(school.grade);
  const activities = firstString(school.activities);
  const description = firstString(school.description);
  const range = formatDateRange(school.startDate, school.endDate);

  const qualification = [degree, field].filter((part): part is string => part !== null).join(', ');

  return (
    <div className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-page">
        {logo !== null ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-contain p-0.5"
          />
        ) : (
          <span aria-hidden="true" className="font-display text-xs font-semibold text-ink-faint">
            {initialsOf(name)}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-[0.9375rem] font-semibold text-ink">
          {url !== null ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded hover:text-brand-700 hover:underline"
            >
              {name ?? 'School'}
              <ExternalIcon className="size-3 text-ink-faint" />
            </a>
          ) : (
            (name ?? 'School')
          )}
        </h3>

        {qualification.length > 0 ? (
          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{qualification}</p>
        ) : null}

        {range !== null ? <p className="mt-1 font-mono text-2xs text-ink-faint">{range}</p> : null}

        {grade !== null ? (
          <p className="mt-1 text-2xs text-ink-muted">Grade: {grade}</p>
        ) : null}

        {activities !== null ? (
          <p className="mt-2 whitespace-pre-line text-pretty text-[0.8125rem] leading-relaxed text-ink-soft">
            {activities}
          </p>
        ) : null}

        {description !== null ? (
          <p className="mt-2 whitespace-pre-line text-pretty text-[0.8125rem] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
