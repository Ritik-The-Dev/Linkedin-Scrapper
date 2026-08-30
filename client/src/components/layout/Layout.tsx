import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { AppFooter } from './AppFooter.tsx';
import { AppHeader } from './AppHeader.tsx';

/**
 * Routers do not manage scroll position, so this does: to the top on navigation,
 * or to the anchored section when the URL carries a hash (e.g. /dashboard#import).
 */
function useScrollBehaviour(): void {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash.length > 1) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);
}

/**
 * Shared chrome for every route: a skip link, the header, a labelled main
 * landmark and the footer.
 *
 * The keyed wrapper gives each route a short fade on entry — the page transition
 * is CSS only, and the global `prefers-reduced-motion` rule neutralises it.
 */
export function Layout() {
  useScrollBehaviour();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div key={pathname} className="animate-fade">
          <Outlet />
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
