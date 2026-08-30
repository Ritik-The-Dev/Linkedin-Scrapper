# LinkedIn Lead Extractor — Frontend

A React + TypeScript single-page app for extracting, browsing and refreshing LinkedIn leads.

This repository contains **the frontend only**. It is a pure consumer of the existing backend REST
API: it never contacts LinkedIn, never scrapes, and never parses a LinkedIn page. Every piece of
profile data on screen arrives from the backend, already normalized.

---

## Quick start

```bash
npm install          # once
cp .env.example .env # point VITE_API_BASE_URL at your backend
npm run dev          # http://localhost:5173
```

The backend is expected at `http://localhost:3000/api` by default.

### Running with no backend attached

```bash
npm run dev:mock
```

That loads `.env.mock`, which sets `VITE_USE_MOCK_API=true`. Every API call is then served from
in-memory fixtures that implement **the same contract** — same request shapes, same response
shapes, same error codes, same 10-per-page cap. Nothing else in the app changes; the switch happens
inside `src/services/api.ts` and nowhere else.

Mock mode is useful for reviewing the UI, and it covers the failure paths that are hard to trigger
against a live LinkedIn session. These usernames behave specially:

| Username           | Behaviour                              |
| ------------------ | -------------------------------------- |
| `bad-user-404`     | `LINKEDIN_PROFILE_NOT_FOUND`           |
| `rate-limited`     | `LINKEDIN_RATE_LIMITED` (HTTP 429)     |
| `auth-error`       | `LINKEDIN_AUTH_ERROR`                  |
| `sneha-kapoor-pm`  | fails, and appears in the demo import  |

Anything else is either an existing fixture (returned with `source: "database"`) or synthesised as a
new profile (`source: "linkedin"`).

One honest limitation: a real `.xlsx` is a binary workbook, and parsing one in the browser would
mean shipping a parser the backend already owns. In mock mode an `.xlsx` upload therefore falls back
to a fixed demo list, while `.csv` and `.tsv` uploads are parsed for real. Against the real backend
the file is uploaded untouched as `multipart/form-data`.

### Other scripts

| Script               | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Dev server against the configured backend           |
| `npm run dev:mock`   | Dev server against in-memory fixtures               |
| `npm run build`      | Typecheck, then production build to `dist/`         |
| `npm run build:mock` | Production build with mock mode baked in            |
| `npm run preview`    | Serve the built `dist/`                             |
| `npm run typecheck`  | `tsc -b` only                                       |
| `npm test`           | Unit tests (Vitest, single run)                     |
| `npm run test:watch` | Unit tests in watch mode                            |

---

## Environment variables

All configuration is read in exactly one module, `src/config/env.ts`. No component contains a
hardcoded host, and nothing outside that module touches `import.meta.env`.

| Variable                | Required | Default                     | Purpose                                                        |
| ----------------------- | -------- | --------------------------- | -------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | yes      | `http://localhost:3000/api` | Base URL of the backend, **including** the `/api` suffix        |
| `VITE_USE_MOCK_API`     | no       | `false`                     | `true` serves every call from in-memory fixtures                |
| `VITE_MOCK_LATENCY`     | no       | `550`                       | Artificial delay (ms) for mock responses, so loading states show |

`.env.example` documents these; `.env.mock` is the committed profile used by `dev:mock` and
`build:mock`. Local `.env` files are gitignored.

---

## Project structure

```
.
├── index.html
├── .env.example                  # documented template — copy to .env
├── .env.mock                     # mock-mode profile (dev:mock / build:mock)
├── public/
│   ├── demo-leads.xlsx           # valid workbook with a `username` column
│   └── favicon.svg
├── tailwind.config.js            # design tokens: type, colour, shadow, motion
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json                 # project references → app + node
├── tsconfig.app.json
├── tsconfig.node.json
└── src
    ├── main.tsx                  # entry: BrowserRouter + <App/>
    ├── App.tsx                   # route table
    ├── index.css                 # Tailwind layers, base styles, reduced-motion rules
    ├── config
    │   └── env.ts                # the only reader of import.meta.env
    ├── types
    │   ├── api.ts                # envelopes, pagination, import + stats result shapes
    │   └── lead.ts               # the normalized Lead document
    ├── services
    │   ├── api.ts                # the ONLY module that performs HTTP
    │   ├── errors.ts             # backend error → user-safe ApiError
    │   ├── errors.test.ts
    │   ├── mockApi.test.ts       # contract tests for the mock + the API surface
    │   └── mock
    │       ├── mockApi.ts        # in-memory implementation of all 8 endpoints
    │       └── mockLeads.ts      # fixtures + synthesiser
    ├── utils
    │   ├── linkedin.ts           # URL → username normalization (+ tests)
    │   ├── formatters.ts         # null-safe dates, names, images, ranges (+ tests)
    │   ├── entity.ts             # tolerant field access for loose sub-documents (+ tests)
    │   └── cn.ts                 # className joiner
    ├── hooks
    │   ├── useLead.ts            # one lead: load, refresh, delete
    │   ├── useLeadsList.ts       # paged list + debounced database search
    │   ├── useRecentLeads.ts     # dashboard "recently seen" strip
    │   ├── useImportedLeads.ts   # import lifecycle + result grouping
    │   ├── useStats.ts
    │   ├── useDebounce.ts
    │   ├── useDocumentTitle.ts
    │   └── usePrefersReducedMotion.ts
    ├── pages
    │   ├── LandingPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── LeadsPage.tsx
    │   ├── LeadDetailPage.tsx
    │   └── NotFoundPage.tsx
    └── components
        ├── layout/               # Layout, AppHeader, AppFooter
        ├── common/               # Button, Card, Badge, Avatar, Spinner, Skeleton,
        │                         # EmptyState, ErrorState, InlineNotice, Pagination,
        │                         # ConfirmDialog, CopyButton, Reveal, icons
        ├── dashboard/            # ExtractForm, ImportPanel, ImportResults, StatsRow
        └── leads/                # LeadCard, LeadGrid, LeadPreview, ProfileHeader,
                                  # StatusBadges, CurrentCompanyCard, LeadSections,
                                  # EntityList + 14 profile section components
```

---

## API layer

Every network call lives in `src/services/api.ts`. No component imports axios, and no component
calls `fetch`. There are eight functions, one per documented endpoint, and no others:

| Function                          | Endpoint                              | Notes                                                              |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `createOrGetLead(username, signal?)` | `POST /api/leads`                  | Body is `{ "username": "ritik-sde" }` — a bare username, never a URL. Resolves `{ lead, source }` where `source` is `"database"` or `"linkedin"`. 90 s timeout. |
| `getLeads(page?, limit?, signal?)`   | `GET /api/leads`                   | `limit` is clamped to 10. Returns `{ leads, pagination }`.          |
| `searchLeads(q, page?, limit?, signal?)` | `GET /api/leads/search`        | Database only. Same result shape as `getLeads`.                     |
| `getLead(username, signal?)`         | `GET /api/leads/:username`         | Stored profile; never triggers a LinkedIn fetch.                    |
| `refreshLead(username, signal?)`     | `POST /api/leads/:username/refresh`| Re-fetches and overwrites. 90 s timeout.                            |
| `deleteLead(username, signal?)`      | `DELETE /api/leads/:username`      | Resolves `{ username, deleted }`.                                   |
| `importLeads(file, onUploadProgress?, signal?)` | `POST /api/leads/import` | `multipart/form-data`, field name `file`. 10 min timeout.            |
| `getStats(signal?)`                  | `GET /api/leads/stats`             | Resolves `{ totalLeads, lastImportedAt, totalRefreshed }`.           |

Cross-cutting behaviour in that module:

Response envelopes are unwrapped once, here, so components deal in plain data. If a response is
missing the fields the contract promises, the call rejects rather than rendering undefined values.
Pagination is rebuilt locally if the backend omits or partially fills it. `page`/`limit` are clamped
before the request, so the UI can never ask for more than the contract's maximum of 10. Every
function accepts an `AbortSignal`, and every hook aborts its in-flight request when inputs change or
the component unmounts — a slow response can never overwrite newer state.

Errors are funnelled through `src/services/errors.ts`, which maps backend codes and HTTP statuses to
short, human sentences. Stack traces, `node_modules` paths, driver errors such as
`MongoServerError:` and anything multi-line or unreasonably long are dropped rather than shown. A
cancelled request is recognised and never surfaces as an error.

---

## Routes

| Path               | Page               | What it does                                                                 |
| ------------------ | ------------------ | ---------------------------------------------------------------------------- |
| `/`                | `LandingPage`      | Product landing page. Primary CTA **Get Started** → `/dashboard`, carrying whatever was typed as `?u=`. |
| `/dashboard`       | `DashboardPage`    | Extract one profile, import a spreadsheet, see stats and recently seen leads. |
| `/leads`           | `LeadsPage`        | All stored leads: paged, with debounced database search (the query is reflected in the URL as `?q=`, so a search is linkable). |
| `/leads/:username` | `LeadDetailPage`   | Full profile, refresh, delete, and a link out to LinkedIn.                    |
| `*`                | `NotFoundPage`     | Fallback.                                                                     |

---

## How the main flows behave

**Extracting one profile.** The input accepts a full LinkedIn URL *or* a bare username. It is
normalized in the browser first (see below), and only the bare username is sent as
`POST /api/leads`. On success the **full profile opens in place, directly below the search area** —
nothing navigates away. A badge says whether the result came from the cache or from a fresh LinkedIn
fetch, and the lead is promoted into the "recently seen" strip below.

**Refreshing.** Refresh is only offered for a lead that is already stored. The existing profile stays
on screen while the request is in flight and, critically, if the refresh fails: the error is shown
next to the button and the previously loaded data is left untouched. Nothing is optimistically
overwritten.

**Deleting.** Guarded by a focus-trapped confirmation dialog. On the detail page a successful delete
returns to `/leads`; in a list the card is removed locally without a refetch.

**Browsing and searching.** `/leads` pages through `GET /api/leads` ten at a time. Typing in the
search box is debounced (350 ms) and hits `GET /api/leads/search` — the database only, never
LinkedIn. Results keep the previous page visible until the new one arrives, so the list does not
flash. The dashboard's "Show more" link navigates to `/leads` rather than appending another fifty
cards.

**Importing.** Upload an `.xlsx`, `.xls` or `.csv` file with a `username` column (a valid demo
workbook is downloadable from the import panel, and works without the backend). Type and size are
checked client-side before upload. The progress bar reflects **bytes uploaded only**; once it
reaches 100% the UI switches to an indeterminate "processing" state, because the API does not report
per-lead progress and pretending otherwise would be a lie. Results come back as a summary
(`totalRows`, `uniqueUsernames`, `created`, `alreadyExists`, `failed`), a per-row table where
**failed rows are shown, never hidden**, and two visually separate groups — newly extracted leads as
full cards, already-existing ones as a smaller group. Every card stays clickable. The import result
block is kept distinct from "Recently seen leads".

**Null handling.** The backend's normalized document has many optional fields, and the UI treats
`null` as *unknown*, not as *false*. Empty sections are hidden rather than rendered as blank rows,
and tri-state flags only ever produce a positive badge — a profile with `hiring: null` shows no
hiring badge at all, never "Hiring: No". On the full detail page descriptions are shown in full,
untruncated.

---

## Username normalization

`src/utils/linkedin.ts` turns user input into the bare username the API expects, before any request
is made. It accepts `https://www.linkedin.com/in/<slug>/`, regional and `http` variants, `/pub/`
paths, schemeless hosts, backslash paths, `@handle`, `in/<slug>` and a plain slug; it strips query
strings, fragments, locale suffixes and `detail/contact-info` noise, unwraps the `<…>` and quoting
that chat clients add, decodes percent-encoding, and lowercases the result. It rejects non-LinkedIn
hosts, non-profile LinkedIn URLs (company, school, jobs, feed), characters outside
`[a-z0-9._-]`, slugs over 100 characters, and the reserved words that would collide with a
sub-route (`search`, `import`, `stats`). Failures come back as a discriminated union with a reason
code, so the form can explain what was wrong instead of showing a generic message.

One note on the spec: its example table maps `linkedin.com/in/ritik-joshi/` to `ritikjoshi`, which
contradicts the row above it (`ritik-sde` keeps its hyphens) and the API contract, which
allows `-` in a username. Hyphens are therefore preserved byte for byte — the username is the
backend's primary key, and silently mangling it would make every lookup miss. A named test documents
this decision.

---

## Accessibility and motion

Semantic landmarks, a skip link, real `<button>` and `<a>` elements for actions, labelled form
controls, `alt` text on avatars, visible focus rings, keyboard-operable dialogs with focus return,
and ARIA only where semantics are genuinely missing (live regions for async status, `aria-current`
for pagination). Colour contrast targets WCAG AA.

Animation is decorative and short: entrance reveals, hover lifts, a subtle cursor-following glow on
the landing page. A global `prefers-reduced-motion: reduce` block neutralises transitions, animations
and transforms, and `usePrefersReducedMotion` disables the JS-driven cursor effect for the same
users.

---

## Tests

```bash
npm test
```

Vitest covers the logic that is easy to get quietly wrong: username normalization (URL shapes,
rejections, the hyphen case), null-safe formatters and date ranges, tolerant field access for loose
sub-documents, error sanitisation (including that stack traces and driver errors never reach the
UI), and a contract suite for the mock backend — source flags, 404s, the 10-per-page cap, search
matching, refresh counters, import summary arithmetic, and that mock mode exposes exactly the same
eight function names as the real client.

---

## Backend contract assumptions

The frontend was built against `docs/api-spec.md`, `docs/data-model.md`, `docs/architecture.md` and
`docs/flow.md`. Concretely it assumes:

1. **Base path.** All eight endpoints live under the `/api` prefix supplied in `VITE_API_BASE_URL`.
   Endpoint paths, request bodies and response structures are consumed exactly as specified; none
   were renamed or reshaped.
2. **`POST /api/leads` takes a bare username.** Body `{ "username": "<slug>" }`, not a URL. It
   returns `201` with `source: "linkedin"` for a fresh fetch and `200` with `source: "database"` for
   a cached one, both carrying the lead in `data`.
3. **`username` is the identity.** It is unique, lowercase, matches `[a-z0-9._-]+`, and is the path
   parameter for read, refresh and delete.
4. **Responses are enveloped.** `{ success, data }` for single documents, `{ success, data,
   pagination }` for lists, `{ success, summary, results }` for import. The client tolerates a
   missing or partial `pagination` block and rebuilds it, and tolerates `source` being absent.
5. **Pagination is capped at 10** per request, with `page`, `limit`, `total`, `totalPages`,
   `hasNextPage`, `hasPreviousPage`. Lists are sorted newest-seen first.
6. **`GET /api/leads/search`** takes `q` and searches stored leads only.
7. **Import** is `multipart/form-data` with the field name `file`, accepts `.xlsx`/`.xls`/`.csv`
   containing a `username` column, and responds with the whole batch at once — there is no
   per-lead progress stream, and the UI does not imply one.
8. **Errors** arrive as `{ success: false, error: { code, message } }` with a meaningful HTTP status.
   Recognised codes are `INVALID_USERNAME`, `INVALID_REQUEST`, `LEAD_NOT_FOUND`, `INVALID_EXCEL`,
   `IMPORT_ERROR`, `DATABASE_ERROR`, `LINKEDIN_PROFILE_NOT_FOUND`, `LINKEDIN_RATE_LIMITED`,
   `LINKEDIN_AUTH_ERROR`, `LINKEDIN_FORBIDDEN` and `LINKEDIN_UPSTREAM_ERROR`. Unknown codes fall
   back to a status-derived message, and the raw code is kept for debugging without being shown.
9. **Everything optional may be `null` or absent.** Only `_id` and `username` are relied upon; every
   other field is treated as unknown until proven present.
10. **CORS** allows the dev origin (`http://localhost:5173`), and no authentication header is
    required. If either changes, the single place to adjust is the axios instance in
    `src/services/api.ts`.

The backend was not modified, and no backend endpoint, parsing logic or LinkedIn call was recreated
here.
