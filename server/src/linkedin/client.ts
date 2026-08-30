/**
 * src/linkedin/client.ts
 *
 * LinkedIn Voyager REST API client.
 * Makes EXACTLY ONE HTTP GET request per call.
 * Credentials are read ONLY from environment variables here — nowhere else.
 */

import {
  LinkedInAuthError,
  LinkedInForbiddenError,
  LinkedInRateLimitError,
  LinkedInProfileNotFoundError,
  LinkedInUpstreamError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Credentials — read per call, never exported, never logged
//
// Read lazily rather than at module load: in a serverless deployment this
// module is imported during a cold start, and throwing there would fail every
// route in the function (including /health) with an opaque 500 instead of a
// typed LINKEDIN_AUTH_ERROR on the one endpoint that actually needs LinkedIn.
// ---------------------------------------------------------------------------

interface LinkedInCredentials {
  liAt: string;
  jsessionId: string;
  userAgent: string;
  /** JSESSIONID with the surrounding quotes some .env readers add stripped off. */
  csrfToken: string;
}

const VOYAGER_ENDPOINT = 'https://www.linkedin.com/voyager/api/identity/dash/profiles';
const DECORATION_ID    = 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101';

// ---------------------------------------------------------------------------
// Optional debug flag — set DEBUG_LINKEDIN=true in .env to enable
// ---------------------------------------------------------------------------
const DEBUG = process.env['DEBUG_LINKEDIN'] === 'true';

function readCredentials(): LinkedInCredentials {
  const liAt       = process.env['LINKEDIN_LI_AT']      ?? '';
  const jsessionId = process.env['LINKEDIN_JSESSIONID'] ?? '';
  const userAgent  = process.env['LINKEDIN_USER_AGENT'] ?? '';

  const missing: string[] = [];
  if (!liAt)       missing.push('LINKEDIN_LI_AT');
  if (!jsessionId) missing.push('LINKEDIN_JSESSIONID');
  if (!userAgent)  missing.push('LINKEDIN_USER_AGENT');

  if (missing.length > 0) {
    throw new LinkedInAuthError(
      `Missing LinkedIn session configuration: ${missing.join(', ')}. Set these as environment variables.`
    );
  }

  return {
    liAt,
    jsessionId,
    userAgent,
    csrfToken: jsessionId.replace(/^"(.*)"$/, '$1'),
  };
}

/**
 * Fetch a LinkedIn profile by public identifier.
 * Returns the raw parsed Voyager JSON.
 *
 * Status 999 means LinkedIn's bot-detection blocked the request.
 * The most common causes are:
 *   1. Server IP doesn't match the IP where the session was created.
 *      Fix: run the server on the same machine you use to browse LinkedIn,
 *           OR refresh the cookies from the server's IP address.
 *   2. Request headers look too bare / non-browser-like.
 *      Fix: the full browser header set is sent below.
 *
 * @throws {LinkedInAuthError}             on HTTP 401, or when credentials are not configured
 * @throws {LinkedInForbiddenError}        on HTTP 403
 * @throws {LinkedInRateLimitError}        on HTTP 429
 * @throws {LinkedInProfileNotFoundError}  on HTTP 404 or 200+empty
 * @throws {LinkedInUpstreamError}         on all other failure modes (incl. 999)
 */
export async function fetchLinkedInProfile(
  publicIdentifier: string
): Promise<Record<string, unknown>> {
  const { liAt, jsessionId, userAgent, csrfToken } = readCredentials();

  const params = new URLSearchParams({
    q:              'memberIdentity',
    memberIdentity: publicIdentifier,
    decorationId:   DECORATION_ID,
  });

  const url = `${VOYAGER_ENDPOINT}?${params.toString()}`;

  if (DEBUG) {
    process.stderr.write(`[linkedin/client] GET ${url}\n`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method:   'GET',
      redirect: 'manual',
      headers: {
        // ── Required Voyager headers ──────────────────────────────────────
        'accept':                    'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token':                csrfToken,
        'x-restli-protocol-version': '2.0.0',

        // ── Browser identity headers ──────────────────────────────────────
        // These are critical — LinkedIn 999 fires when the request looks
        // too bare compared to a real browser session.
        'user-agent':      userAgent,
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'sec-fetch-dest':  'empty',
        'sec-fetch-mode':  'cors',
        'sec-fetch-site':  'same-origin',
        'origin':          'https://www.linkedin.com',
        'referer':         `https://www.linkedin.com/in/${publicIdentifier}/`,

        // ── LinkedIn internal tracking (reduces bot-detection score) ──────
        'x-li-lang':  'en_US',
        'x-li-track': JSON.stringify({
          clientVersion:     '1.13.10685',
          mpVersion:         '1.13.10685',
          osName:            'web',
          timezoneOffset:    5.5,
          timezone:          'Asia/Kolkata',
          deviceFormFactor:  'DESKTOP',
          mpName:            'voyager-web',
          displayDensity:    1,
          displayWidth:      1920,
          displayHeight:     1080,
        }),

        // ── Session cookies ───────────────────────────────────────────────
        // li_at  = authentication token
        // JSESSIONID = CSRF token (must also appear in csrf-token header)
        'cookie': `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
      },
    });
  } catch (networkErr) {
    throw new LinkedInUpstreamError(
      `Network error contacting LinkedIn: ${(networkErr as Error).message}`
    );
  }

  if (DEBUG) {
    process.stderr.write(
      `[linkedin/client] HTTP ${res.status} — content-type: ${res.headers.get('content-type') ?? 'none'}\n`
    );
  }

  // ── Status handling ───────────────────────────────────────────────────────

  if (res.status === 302 || res.status === 303) {
    throw new LinkedInUpstreamError(
      `LinkedIn redirected the request (${res.status}) — session may be expired. ` +
      `Location: ${res.headers.get('location') ?? 'unknown'}`
    );
  }

  if (res.status === 401) throw new LinkedInAuthError();
  if (res.status === 403) throw new LinkedInForbiddenError();
  if (res.status === 404) throw new LinkedInProfileNotFoundError(publicIdentifier);
  if (res.status === 410) {
    throw new LinkedInUpstreamError(
      'LinkedIn Voyager endpoint removed (HTTP 410 Gone). The endpoint URL or decoration ID may need updating.'
    );
  }
  if (res.status === 429) throw new LinkedInRateLimitError();

  if (res.status === 999) {
    // LinkedIn bot/scraping detection.
    // Most likely cause: server IP ≠ the IP where li_at was created.
    // Solution: refresh li_at and JSESSIONID cookies from the same IP
    // that your server runs on, then update .env.
    throw new LinkedInUpstreamError(
      'LinkedIn bot detection triggered (HTTP 999). ' +
      'The server IP likely does not match the IP where your session cookies were created. ' +
      'Refresh li_at and JSESSIONID from the same IP as the server and update your .env file.'
    );
  }

  if (res.status !== 200) {
    throw new LinkedInUpstreamError(
      `LinkedIn returned unexpected HTTP status: ${res.status}`
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new LinkedInUpstreamError(
      'LinkedIn returned HTTP 200 but body is not valid JSON.'
    );
  }

  const included = Array.isArray(json['included']) ? json['included'] : [];
  if (included.length === 0) {
    throw new LinkedInProfileNotFoundError(publicIdentifier);
  }

  return json;
}
