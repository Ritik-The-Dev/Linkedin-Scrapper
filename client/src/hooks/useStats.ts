import { useCallback, useEffect, useState } from 'react';

import { getStats } from '../services/api.ts';
import { errorMessage, isCancelled } from '../services/errors.ts';
import type { LeadStats } from '../types/api.ts';

export interface StatsController {
  stats: LeadStats | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the dashboard counters from GET /api/leads/stats. */
export function useStats(): StatsController {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    getStats(controller.signal)
      .then((result) => {
        if (!active) return;
        setStats(result);
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

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { stats, loading, error, reload };
}
