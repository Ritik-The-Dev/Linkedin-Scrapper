import { useCallback, useEffect, useRef, useState } from 'react';

import { PAGE_SIZE } from '../config/env.ts';
import { getLeads } from '../services/api.ts';
import { errorMessage, isCancelled } from '../services/errors.ts';
import type { Lead } from '../types/lead.ts';

export interface RecentLeadsController {
  leads: Lead[];
  total: number;
  loading: boolean;
  error: string | null;
  /** True when the database holds more leads than this one page shows. */
  hasMore: boolean;
  reload: () => void;
  /** Moves a lead to the front without a refetch, e.g. right after extraction. */
  promote: (lead: Lead, isNew?: boolean) => void;
}

/**
 * The dashboard's "recently seen" strip: exactly one page of ten.
 *
 * There is deliberately no in-place "load more" here. When there are more leads
 * than fit, the dashboard links to `/leads`, which is the surface built for
 * browsing and searching — the dashboard stays a summary.
 */
export function useRecentLeads(): RecentLeadsController {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    inFlight.current = controller;
    let active = true;

    setLoading(true);
    setError(null);

    getLeads(1, PAGE_SIZE, controller.signal)
      .then((result) => {
        if (!active) return;
        setLeads(result.leads);
        setTotal(result.pagination.total);
        setHasMore(result.pagination.hasNextPage);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active || isCancelled(cause)) return;
        setError(errorMessage(cause));
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    inFlight.current?.abort();
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * `isNew` comes from the create response's `source` — a lead that was actually
   * fetched from LinkedIn increases the total; a cached one does not. Both state
   * updaters stay pure so a StrictMode double-invoke cannot double-count.
   */
  const promote = useCallback((lead: Lead, isNew = false) => {
    setLeads((current) => [lead, ...current.filter((item) => item.username !== lead.username)]);
    if (isNew) setTotal((count) => count + 1);
  }, []);

  return { leads, total, loading, error, hasMore, reload, promote };
}
