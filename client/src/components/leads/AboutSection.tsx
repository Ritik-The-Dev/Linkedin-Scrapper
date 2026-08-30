import type { Lead } from '../../types/lead.ts';
import { firstString } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { BulbIcon } from '../common/icons.tsx';

/**
 * The profile summary, in full.
 *
 * `whitespace-pre-line` keeps the author's own line breaks, and there is no
 * truncation here — summaries are shortened on cards, never on the detail page.
 */
export function AboutSection({ lead }: { lead: Lead }) {
  const summary = firstString(lead.profile?.summary);
  if (summary === null) return null;

  return (
    <SectionCard id="about" title="About" icon={<BulbIcon className="size-4" />}>
      <p className="max-w-3xl whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-soft">
        {summary}
      </p>
    </SectionCard>
  );
}
