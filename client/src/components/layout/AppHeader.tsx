import { NavLink, Link } from 'react-router-dom';

import { USE_MOCK_API } from '../../config/env.ts';
import { cn } from '../../utils/cn.ts';
import { LayersIcon } from '../common/icons.tsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
] as const;

const LINK_BASE =
  'inline-flex h-9 items-center rounded-lg px-3 text-[0.8125rem] font-medium transition-colors';
const LINK_IDLE = 'text-ink-muted hover:bg-ink/[0.04] hover:text-ink';

/** Wordmark: the product's whole job is URL in, username out. */
function Wordmark() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-2.5 rounded-lg py-1 pr-2"
      aria-label="Lead Extractor home"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-[0_1px_2px_rgba(10,22,40,0.18)]">
        <LayersIcon className="size-4" />
      </span>
      <span className="font-display text-[0.9375rem] font-semibold tracking-tighter2 text-ink">
        Lead<span className="text-brand-600">Extractor</span>
      </span>
    </Link>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Wordmark />

        <nav aria-label="Primary" className="ml-auto">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(LINK_BASE, isActive ? 'bg-brand-50 text-brand-700' : LINK_IDLE)
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            {/* Import lives inside the dashboard, so this is an anchor to that
                section rather than a route of its own. */}
            <li>
              <Link to="/dashboard#import" className={cn(LINK_BASE, LINK_IDLE)}>
                Import
              </Link>
            </li>
          </ul>
        </nav>

        {USE_MOCK_API ? (
          <span
            className="hidden items-center gap-1.5 rounded-full border border-warn-100 bg-warn-50 px-2.5 py-1 text-2xs font-medium text-warn-700 sm:inline-flex"
            title="VITE_USE_MOCK_API is true — responses come from in-memory fixtures, not the backend."
          >
            <span className="size-1.5 rounded-full bg-warn-500" aria-hidden="true" />
            Mock data
          </span>
        ) : null}
      </div>
    </header>
  );
}
