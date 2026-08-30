import { API_BASE_URL, USE_MOCK_API } from '../../config/env.ts';

/** Host only — enough to confirm which backend is configured, without the noise. */
function apiLabel(): string {
  if (USE_MOCK_API) return 'in-memory fixtures';
  try {
    const url = new URL(API_BASE_URL);
    return `${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return API_BASE_URL;
  }
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-2xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Lead Extractor · a frontend for the LinkedIn lead extraction API. Profile data belongs to
          its owners.
        </p>
        <p className="font-mono">
          API <span className="text-ink-muted">{apiLabel()}</span>
        </p>
      </div>
    </footer>
  );
}
