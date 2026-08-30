import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldString } from '../../utils/entity.ts';
import { asArray } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { GlobeIcon } from '../common/icons.tsx';

/** "NATIVE_OR_BILINGUAL" → "Native or bilingual". */
function proficiencyLabel(value: string | null): string | null {
  if (value === null) return null;
  if (!value.includes('_')) return value;
  const words = value.toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function LanguagesSection({ lead }: { lead: Lead }) {
  const languages = asArray(lead.languages);
  if (languages.length === 0) return null;

  const rows = languages.map((language, index) => {
    const name = fieldString(language, ['name', 'language', 'languageName']);
    return {
      key: entityKey(language, name, index),
      name,
      proficiency: proficiencyLabel(
        fieldString(language, ['proficiency', 'proficiencyLevel', 'level']),
      ),
    };
  });

  return (
    <SectionCard
      id="languages"
      title="Languages"
      count={rows.length}
      icon={<GlobeIcon className="size-4" />}
    >
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
            <dt className="text-[0.875rem] font-medium text-ink">{row.name ?? 'Language'}</dt>
            {row.proficiency !== null ? (
              <dd className="shrink-0 text-2xs text-ink-muted">{row.proficiency}</dd>
            ) : (
              <dd className="sr-only">Proficiency not reported</dd>
            )}
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
