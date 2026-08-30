import { useEffect } from 'react';

const SUFFIX = 'Lead Extractor';

/** Keeps the tab title in step with the route, which matters for screen readers. */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title === null || title.length === 0 ? SUFFIX : `${title} · ${SUFFIX}`;
  }, [title]);
}
