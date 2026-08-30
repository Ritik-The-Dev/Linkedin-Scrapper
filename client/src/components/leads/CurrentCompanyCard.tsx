import type { CurrentCompany, Lead } from '../../types/lead.ts';
import { safeUrl } from '../../utils/entity.ts';
import {
  asArray,
  bestImageUrl,
  firstString,
  formatNumber,
  initialsOf,
} from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { BuildingIcon, ExternalIcon } from '../common/icons.tsx';

/** "5,001–10,000 employees" from an employeeCountRange. */
function sizeLabel(company: CurrentCompany): string | null {
  const exact = formatNumber(company.employeeCount);
  if (exact !== null) return `${exact} employees`;

  const range = company.employeeCountRange;
  const start = formatNumber(range?.start);
  const end = formatNumber(range?.end);
  if (start !== null && end !== null) return `${start}–${end} employees`;
  if (start !== null) return `${start}+ employees`;
  return null;
}

/**
 * The enriched company block from `metadata.currentCompany`.
 *
 * Kept separate from the experience timeline: this is company data the backend
 * resolved once, not a role the person held.
 */
export function CurrentCompanyCard({ lead }: { lead: Lead }) {
  const company = lead.metadata?.currentCompany;
  if (!company) return null;

  const name = firstString(company.companyName);
  const url = safeUrl(company.companyUrl) ?? safeUrl(company.website);
  const website = safeUrl(company.website);
  const logo = bestImageUrl(company.logo, 200);
  const tagline = firstString(company.tagline);
  const description = firstString(company.description);
  const industry = firstString(company.industry, asArray(company.industries)[0]);
  const headquarter = firstString(company.headquarter);
  const founded = typeof company.foundedYear === 'number' ? String(company.foundedYear) : null;
  const size = sizeLabel(company);
  const followers = formatNumber(company.followerCount);
  const specialties = asArray(company.specialties)
    .map((item) => firstString(item))
    .filter((item): item is string => item !== null);

  // Nothing beyond a bare name is not worth a section of its own.
  const hasDetail =
    tagline !== null ||
    description !== null ||
    industry !== null ||
    headquarter !== null ||
    founded !== null ||
    size !== null ||
    followers !== null ||
    specialties.length > 0;

  if (name === null && !hasDetail) return null;

  const facts: Array<[string, string]> = [];
  if (industry !== null) facts.push(['Industry', industry]);
  if (headquarter !== null) facts.push(['Headquarters', headquarter]);
  if (founded !== null) facts.push(['Founded', founded]);
  if (size !== null) facts.push(['Size', size]);
  if (followers !== null) facts.push(['Followers', followers]);

  return (
    <SectionCard
      id="company"
      title="Current company"
      icon={<BuildingIcon className="size-4" />}
    >
      <div className="flex gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-page">
          {logo !== null ? (
            <img
              src={logo}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-contain p-0.5"
            />
          ) : (
            <span aria-hidden="true" className="font-display text-sm font-semibold text-ink-faint">
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
                {name ?? 'Company'}
                <ExternalIcon className="size-3 text-ink-faint" />
              </a>
            ) : (
              (name ?? 'Company')
            )}
          </h3>

          {tagline !== null ? (
            <p className="mt-0.5 text-pretty text-[0.8125rem] text-ink-soft">{tagline}</p>
          ) : null}

          {facts.length > 0 ? (
            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-ink-faint">{label}</dt>
                  <dd className="text-right text-[0.8125rem] text-ink-soft">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {description !== null ? (
            <p className="mt-3 whitespace-pre-line text-pretty text-[0.8125rem] leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}

          {specialties.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {specialties.map((specialty) => (
                <li
                  key={specialty}
                  className="rounded-md border border-line bg-page px-2 py-0.5 text-2xs text-ink-muted"
                >
                  {specialty}
                </li>
              ))}
            </ul>
          ) : null}

          {website !== null && website !== url ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded text-2xs font-medium text-brand-700 hover:underline"
            >
              {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalIcon className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
