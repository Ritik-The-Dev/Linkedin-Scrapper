/**
 * Single place where environment configuration is read.
 * Nothing else in the app should touch `import.meta.env`, and no component
 * should contain a hardcoded host.
 */

/** First candidate that holds a non-empty value, else the fallback. */
function readString(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
    if (trimmed.length > 0) return trimmed;
  }
  return '';
}

/**
 * `import.meta.env` is injected by Vite and is the only source that matters in
 * the browser. The empty fallback keeps this module safe to import from a plain
 * Node process (unit tests, tooling), where it does not exist.
 */
const env: Partial<ImportMetaEnv> = (import.meta as { env?: ImportMetaEnv }).env ?? {};

/**
 * Secondary source for those Node processes. Reached through `globalThis` so the
 * bundler never sees a bare `process` reference to shim into the browser build.
 */
const nodeEnv: Record<string, string | undefined> =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/**
 * Base URL of the backend, including the `/api` suffix.
 * Configured with VITE_API_BASE_URL. The fallback exists so a fresh clone
 * boots without a .env file; it is never referenced outside this module.
 */
export const API_BASE_URL: string = readString(
  env.VITE_API_BASE_URL,
  nodeEnv['VITE_API_BASE_URL'],
  'http://localhost:3000/api',
).replace(/\/+$/, '');

/** When true, all API calls are served from in-memory fixtures. */
export const USE_MOCK_API: boolean =
  readString(env.VITE_USE_MOCK_API, nodeEnv['VITE_USE_MOCK_API'], 'false').toLowerCase() === 'true';

/** Artificial delay for mock responses so loading states stay visible. */
export const MOCK_LATENCY: number = (() => {
  const parsed = Number.parseInt(
    readString(env.VITE_MOCK_LATENCY, nodeEnv['VITE_MOCK_LATENCY'], '550'),
    10,
  );
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();

/** Hard cap from the API contract: the backend never returns more than 10 per page. */
export const PAGE_SIZE = 10;
