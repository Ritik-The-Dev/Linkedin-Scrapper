import { useCallback, useEffect, useRef, useState } from 'react';

import { PAGE_SIZE } from '../config/env.ts';
import { getLeads, searchLeads } from '../services/api.ts';
import { errorMessage, isCancelled } from '../services/errors.ts';
import type { Pagination } from '../types/api.ts';
import type { Lead } from '../types/lead.ts';
import { useDebounce } from './useDebounce.ts';

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export interface LeadsListController {
  query: string;
  /** Updates the query and returns to page 1. */
  setQuery: (value: string) => void;
  page: number;
  goToPage: (page: number) => void;
  leads: Lead[];
  pagination: Pagination;
  loading: boolean;
  /** True while the debounce timer is still running, so the input feels live. */
  pending: boolean;
  error: string | null;
  isSearching: boolean;
  reload: () => void;
  /** Drops a lead locally after a successful delete, avoiding a refetch. */
  removeLocally: (username: string) => void;
}

/**
 * Owns the state behind the leads browser: a debounced query, a page number and
 * whichever endpoint matches — GET /api/leads or GET /api/leads/search.
 *
 * Searching hits the database endpoint only; LinkedIn is never involved. In-flight
 * requests are aborted when the inputs change so late responses cannot overwrite
 * newer results.
 *
 * `initialQuery` seeds the field from the URL, so a search can be linked to.
 */
export function useLeadsList(debounceMs = 350, initialQuery = ''): LeadsListController {
  const [query, setQueryState] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  // Read inside the effect so a keystroke does not need to be a dependency.
  const queryRef = useRef(query);
  queryRef.current = query;

  const trimmed = debouncedQuery.trim();
  const isSearching = trimmed.length > 0;
  const pending = query.trim() !== trimmed;

  useEffect(() => {
    // Still mid-typing: leave the current results on screen until the debounce
    // settles, rather than firing a request that is already out of date.
    if (queryRef.current.trim() !== trimmed) return;

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    const request = trimmed.length > 0
      ? searchLeads(trimmed, page, PAGE_SIZE, controller.signal)
      : getLeads(page, PAGE_SIZE, controller.signal);

    request
      .then((result) => {
        if (!active) return;
        setLeads(result.leads);
        setPagination(result.pagination);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active || isCancelled(cause)) return;
        setLeads([]);
        setPagination(EMPTY_PAGINATION);
        setError(errorMessage(cause));
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [trimmed, page, reloadToken]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPage(1);
  }, []);

  const goToPage = useCallback((next: number) => {
    setPage(Math.max(1, Math.trunc(next)));
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const removeLocally = useCallback((username: string) => {
    setLeads((current) => current.filter((lead) => lead.username !== username));
    setPagination((current) => ({
      ...current,
      total: Math.max(0, current.total - 1),
    }));
  }, []);

  return {
    query,
    setQuery,
    page,
    goToPage,
    leads,
    pagination,
    loading,
    pending,
    error,
    isSearching,
    reload,
    removeLocally,
  };
}
