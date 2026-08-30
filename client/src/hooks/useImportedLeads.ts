import { useEffect, useMemo, useState } from 'react';

import { getLead } from '../services/api.ts';
import { isCancelled } from '../services/errors.ts';
import type { Lead } from '../types/lead.ts';

/** How many profile fetches may be in flight at once. */
const CONCURRENCY = 3;

/** Usernames cannot contain a NUL, so it is a safe key separator. */
const SEP = '\u0000';

export interface ImportedLeadsController {
  /** Resolved leads, in the order the usernames were given. */
  leads: Lead[];
  loading: boolean;
  /** Requested usernames that could not be fetched (only meaningful once settled). */
  unresolved: number;
}

/**
 * Turns usernames from an import response into full leads.
 *
 * The import endpoint reports statuses, not profiles, so the cards need a
 * follow-up `GET /api/leads/:username` each. Those run through a small worker
 * pool rather than all at once, and any that fail are simply left out — the row
 * table in the import results still lists every username the backend returned.
 */
export function useImportedLeads(
  usernames: readonly string[],
  limit: number,
): ImportedLeadsController {
  // The joined key is the effect's only dependency, so a caller may rebuild the
  // array on every render without restarting the fetches.
  const key = usernames.slice(0, Math.max(0, limit)).join(SEP);

  const [resolved, setResolved] = useState<ReadonlyMap<string, Lead>>(() => new Map());
  const [loading, setLoading] = useState(key.length > 0);

  useEffect(() => {
    const wanted = key.length === 0 ? [] : key.split(SEP);

    setResolved(new Map());
    setLoading(wanted.length > 0);
    if (wanted.length === 0) return;

    const controller = new AbortController();
    let active = true;
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (active) {
        const username = wanted[cursor];
        cursor += 1;
        if (username === undefined) return;

        try {
          const lead = await getLead(username, controller.signal);
          if (!active) return;
          setResolved((current) => new Map(current).set(username, lead));
        } catch (cause: unknown) {
          if (!active || isCancelled(cause)) return;
          // Left unresolved on purpose: one unreadable row must not stop the rest.
        }
      }
    };

    const pool = Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, () => worker());

    void Promise.all(pool).then(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key]);

  const leads = useMemo(() => {
    const wanted = key.length === 0 ? [] : key.split(SEP);
    return wanted
      .map((username) => resolved.get(username))
      .filter((lead): lead is Lead => lead !== undefined);
  }, [key, resolved]);

  const requested = key.length === 0 ? 0 : key.split(SEP).length;

  return { leads, loading, unresolved: loading ? 0 : requested - leads.length };
}
