import { useCallback, useEffect, useState } from 'react';

import { getLead } from '../services/api.ts';
import { isCancelled, toApiError } from '../services/errors.ts';
import type { ApiErrorCode } from '../types/api.ts';
import type { Lead } from '../types/lead.ts';

export interface LeadController {
  lead: Lead | null;
  loading: boolean;
  error: string | null;
  /** Lets the page distinguish "not stored" from a transport failure. */
  errorCode: ApiErrorCode | null;
  /** Replaces the lead in place, used by a successful refresh. */
  setLead: (lead: Lead) => void;
  reload: () => void;
}

/** Loads one stored lead by username from GET /api/leads/:username. */
export function useLead(username: string | undefined): LeadController {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (username === undefined || username.length === 0) {
      setLead(null);
      setLoading(false);
      setError('No username was provided.');
      setErrorCode('INVALID_USERNAME');
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setErrorCode(null);

    getLead(username, controller.signal)
      .then((result) => {
        if (!active) return;
        setLead(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active || isCancelled(cause)) return;
        const failure = toApiError(cause);
        setLead(null);
        setError(failure.userMessage);
        setErrorCode(failure.code);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [username, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { lead, loading, error, errorCode, setLead, reload };
}
