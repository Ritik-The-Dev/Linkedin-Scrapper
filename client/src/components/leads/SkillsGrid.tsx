import { useState } from 'react';

import type { Lead } from '../../types/lead.ts';
import { asArray, firstString } from '../../utils/formatters.ts';
import { Button } from '../common/Button.tsx';
import { SectionCard } from '../common/Card.tsx';
import { CodeIcon } from '../common/icons.tsx';

/** Long skill lists collapse to this many until the user asks for the rest. */
const COLLAPSED = 24;

/**
 * Skills as a wrapping pill grid.
 *
 * Profiles can carry a hundred skills; showing them all by default pushes every
 * later section off the page, so the list collapses with an explicit control
 * rather than a scroll box.
 */
export function SkillsGrid({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false);

  const names = asArray(lead.skills)
    .map((skill) => firstString(skill.name))
    .filter((name): name is string => name !== null);

  if (names.length === 0) return null;

  const hidden = Math.max(0, names.length - COLLAPSED);
  const visible = expanded ? names : names.slice(0, COLLAPSED);

  return (
    <SectionCard
      id="skills"
      title="Skills"
      count={names.length}
      icon={<CodeIcon className="size-4" />}
      action={
        hidden > 0 ? (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="skills-list"
          >
            {expanded ? 'Show fewer' : `Show all ${names.length}`}
          </Button>
        ) : undefined
      }
    >
      <ul id="skills-list" className="flex flex-wrap gap-2">
        {visible.map((name) => (
          <li
            key={name}
            className="rounded-lg border border-line bg-page px-2.5 py-1.5 text-[0.8125rem] text-ink-soft"
          >
            {name}
          </li>
        ))}
      </ul>

      {hidden > 0 && !expanded ? (
        <p className="mt-3 text-2xs text-ink-faint">
          {hidden} more not shown
        </p>
      ) : null}
    </SectionCard>
  );
}
