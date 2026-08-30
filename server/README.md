# LinkedIn Lead Extractor

A backend API that accepts a LinkedIn public username, fetches the profile
using a reverse-engineered LinkedIn Voyager REST client, parses the normalized
entity graph into a clean structured document, stores it as a Lead in MongoDB,
and serves previously extracted leads from the database.

---

## Project Status

> **⚠ Architecture Under Review — No Implementation Yet**
>
> The specification documents are complete.
> Backend and frontend implementation begins only after architecture approval.
> See [Architecture Approval](#architecture-approval) at the bottom of this file.

---

## Technology Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Language         | TypeScript (strict mode)            |
| Runtime          | Node.js (ESM, v18+)                 |
| HTTP Framework   | Express.js v5                       |
| Database         | MongoDB via Mongoose                |
| LinkedIn Client  | Native Node.js `fetch` (no SDK)     |
| Excel Parsing    | `exceljs`                           |
| File Upload      | `multer`                            |
| Environment      | `dotenv`                            |
| Build            | `tsc` (TypeScript compiler)         |
| Dev server       | `tsx` (zero-config TS runner)       |
| Deployment       | Vercel Function (single Express handler) or any Node host |

---

## Repository Structure

```
linkedin-lead-extractor/
├── api/
│   └── index.ts                   ← Vercel Function entry (wraps the Express app)
├── src/
│   ├── routes/
│   │   └── leads.ts               ← Express route definitions + upload guard
│   ├── controllers/
│   │   └── leadController.ts      ← HTTP req/res handling only
│   ├── services/
│   │   ├── leadService.ts         ← Business logic
│   │   └── excelImportService.ts  ← Excel parsing + batch import
│   ├── linkedin/
│   │   ├── client.ts              ← LinkedIn HTTP client (ONE request)
│   │   ├── parser.ts              ← Entity graph → normalized profile
│   │   └── errors.ts              ← Typed error classes (code + httpStatus)
│   ├── models/
│   │   └── Lead.ts                ← Mongoose schema
│   ├── app.ts                     ← Express app setup (no port binding)
│   ├── server.ts                  ← Local entry point — connects DB, listens
│   ├── db.ts                      ← Cached Mongo connection + /api gate
│   ├── config.ts                  ← Upload limit / runtime flags
│   └── types.ts                   ← Shared response types
├── public/
│   └── index.html                 ← Static landing page served at /
├── docs/
│   ├── architecture.md            ← System architecture
│   ├── api-spec.md                ← Full REST API contract
│   ├── data-model.md              ← MongoDB Lead document spec
│   └── flow.md                    ← Request flow diagrams
├── test-linkedin-profile.js       ← Existing standalone parser/client PoC
├── vercel.json                    ← Function config + catch-all rewrite
├── .vercelignore                  ← Keeps .env and dist/ out of deployments
├── tsconfig.json                  ← Build config (emits src/ → dist/)
├── tsconfig.api.json              ← Typecheck config (also covers api/)
├── .env                           ← Local environment variables (gitignored)
├── .env.example                   ← Template — no real credentials
├── package.json
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/linkedin-leads
LINKEDIN_LI_AT=<your_li_at_cookie>
LINKEDIN_JSESSIONID=<your_jsessionid>
LINKEDIN_USER_AGENT=<your_browser_ua_string>
BATCH_CONCURRENCY=5
```

| Variable              | Required | Default | Description                               |
|-----------------------|----------|---------|-------------------------------------------|
| `PORT`                | No       | 3000    | HTTP server port (ignored on Vercel)      |
| `MONGODB_URI`         | Yes      | —       | MongoDB connection string                 |
| `LINKEDIN_LI_AT`      | Yes      | —       | LinkedIn session token                    |
| `LINKEDIN_JSESSIONID` | Yes      | —       | LinkedIn CSRF / session token             |
| `LINKEDIN_USER_AGENT` | Yes      | —       | Browser user-agent string                 |
| `BATCH_CONCURRENCY`   | No       | 5       | Max parallel LinkedIn requests in imports |
| `CORS_ORIGIN`         | No       | `*`     | Allowed browser origin — set to the frontend URL in production |
| `MAX_UPLOAD_BYTES`    | No       | 10 MB locally, 4 MB on Vercel | Largest accepted import file; above it the API returns `400 INVALID_EXCEL` |

Missing configuration degrades gracefully rather than crashing the process: an
absent `MONGODB_URI` produces `DATABASE_ERROR` on `/api/*` requests, absent
`LINKEDIN_*` values produce `LINKEDIN_AUTH_ERROR` on the endpoints that need
LinkedIn, and `/health` keeps answering in both cases.

**Security:**
- These variables are read only inside the LinkedIn Client module
- They are never returned via API responses
- They are never logged
- `.env` is gitignored and `.vercelignore`d — never commit or upload credentials

---

## Deploying to Vercel

The whole API deploys as a **single Vercel Function**. `api/index.ts` imports the
same Express app that `npm run dev` uses, and `vercel.json` rewrites every path
to it, so routing, validation and error shapes are identical in both runtimes —
there is no second copy of the routing table to keep in sync. `public/index.html`
is a static landing page served at `/`; everything else reaches the function.

1. Push this folder to Git and import the repository in Vercel. If the repo also
   contains the frontend, set **Root Directory** to `server`.
2. Add the environment variables from the table above under **Settings →
   Environment Variables** — at minimum `MONGODB_URI`, the three `LINKEDIN_*`
   values, and `CORS_ORIGIN` set to the deployed frontend origin.
3. `MONGODB_URI` has to point at a hosted database (e.g. MongoDB Atlas);
   `localhost` is not reachable from a function. In Atlas → **Network Access**,
   allow `0.0.0.0/0`, because function egress IPs are not stable.
4. Deploy, then check `GET /health` — it answers even when the database is
   unreachable, which makes it a useful first signal.
5. Point the frontend's `VITE_API_BASE_URL` at `https://<deployment>.vercel.app`.

No build step is required for the function itself — Vercel compiles
`api/index.ts` directly. `npm run vercel-build` runs `tsc --project
tsconfig.api.json`, which typechecks `src/` **and** `api/` without emitting, so a
type error fails the deploy instead of shipping.

### Platform limits that shape this deployment

| Limit             | Value                      | Consequence                                                                                   |
|-------------------|----------------------------|-----------------------------------------------------------------------------------------------|
| Request body      | ~4.5 MB                    | Bodies above the platform cap are refused by Vercel before the function runs (a bare 413); `MAX_UPLOAD_BYTES` defaults to 4 MB so the app itself answers `400 INVALID_EXCEL` just below it |
| Function duration | 60 s (Hobby)               | Set explicitly in `vercel.json`; raise it there if your plan allows more                               |
| Filesystem        | read-only except `/tmp`    | Uploads use `multer.memoryStorage()`; nothing is written to disk                               |
| Cold starts       | new container per idle gap | The connection promise is cached on `globalThis`, so warm invocations reuse one pool           |

**Import timeouts are the real risk.** `POST /api/leads/import` fetches every new
username from LinkedIn, `BATCH_CONCURRENCY` at a time (default 5). At a second or
two per profile, a sheet with more than roughly a hundred new usernames can pass
60 seconds and be terminated mid-run: leads already written stay in the database,
but the caller gets a gateway timeout instead of the import summary. Keep sheets
small on Vercel, split large ones across several uploads, or run bulk imports
against a self-hosted instance, which has no duration cap.

**LinkedIn blocks datacenter IPs — deploying does not fix `999`.** A `li_at`
cookie is bound to the IP and session that created it, and cloud egress ranges
are blocked far more aggressively than a residential connection. Expect the
extraction paths (`POST /api/leads` for a new username, `/refresh`, and imports
of unseen usernames) to return `502 LINKEDIN_UPSTREAM_ERROR` from Vercel, while
every database-only endpoint keeps working normally. Live extraction needs the
request to originate from an IP that LinkedIn already trusts for that session.

### Local versus deployed

| | Local (`npm run dev`) | Vercel |
|---|---|---|
| Entry point   | `src/server.ts` (binds a port) | `api/index.ts` (no port)     |
| DB connection | Once at boot                  | Per request, cached on `globalThis` |
| Upload limit  | 10 MB                         | 4 MB                         |
| Duration      | Unbounded                     | 60 s                         |

To self-host instead, `npm run build && npm start` still works exactly as
before — `tsconfig.json` emits `src/` to `dist/`, and `dist/server.js` remains
the entry point.

---

## API Endpoints Summary

| Method | Path                           | LinkedIn | DB   | Description                        |
|--------|--------------------------------|----------|------|------------------------------------|
| POST   | `/api/leads`                   | If new   | Yes  | Create lead or return existing     |
| GET    | `/api/leads`                   | Never    | Yes  | List leads, paginated              |
| GET    | `/api/leads/search?q=...`      | Never    | Yes  | Search leads by text               |
| GET    | `/api/leads/stats`             | Never    | Yes  | Database statistics                |
| GET    | `/api/leads/:username`         | Never    | Yes  | Get single stored lead             |
| POST   | `/api/leads/:username/refresh` | Always   | Yes  | Re-fetch lead from LinkedIn        |
| DELETE | `/api/leads/:username`         | Never    | Yes  | Remove lead from database          |
| POST   | `/api/leads/import`            | If new   | Yes  | Bulk import from Excel/CSV         |

Full contract: [`docs/api-spec.md`](docs/api-spec.md)

---

## Lead Lifecycle

```
username received
       │
       ▼
  in MongoDB?
  ┌────┴─────┐
  │          │
  YES        NO
  │          │
  │     LinkedIn API
  │          │
  │       Parser
  │          │
  │      MongoDB
  │          │
  └────┬─────┘
       │
     Lead document
       │
    Serve API response
```

- **Create** sets `firstSeenAt`, `lastSeenAt`, `lastRefreshedAt`, `refreshCount = 0`
- **GET** updates `lastSeenAt` only — profile unchanged
- **Refresh** updates profile, `lastSeenAt`, `lastRefreshedAt`, increments `refreshCount`
- **Refresh failure** — stored profile is never modified on error

---

## Documentation

| Document                                  | Contents                                      |
|-------------------------------------------|-----------------------------------------------|
| [`docs/architecture.md`](docs/architecture.md) | Layer diagram, responsibility boundaries   |
| [`docs/api-spec.md`](docs/api-spec.md)   | Every endpoint, request/response, error codes |
| [`docs/data-model.md`](docs/data-model.md) | MongoDB Lead schema, indexes, field reference |
| [`docs/flow.md`](docs/flow.md)           | Request flow diagrams for all 8 operations    |

---

## Frontend Development Contract

> **For the Frontend Agent**

The frontend builds against the API contract defined in
[`docs/api-spec.md`](docs/api-spec.md).

### Core rules

1. Frontend sends **username only** — never the full LinkedIn URL.
   URL → username extraction is the frontend's responsibility.
   Example: `https://www.linkedin.com/in/vanshika-goel-sde/` → `vanshika-goel-sde`

2. Frontend consumes the **normalized Lead document** returned by the backend.
   It must not depend on LinkedIn entityUrns, Voyager internals, or raw API structure.

3. Frontend must handle all documented error codes:
   `INVALID_USERNAME`, `LEAD_NOT_FOUND`, `LINKEDIN_RATE_LIMITED`, etc.

4. Frontend must implement pagination using the `pagination` envelope fields:
   `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`

5. For Excel import, the frontend uploads a file with a `username` column.
   The backend returns a `summary` and per-row `results`.

### Suggested Pages / Components

| Page / Component   | API Used                                      |
|--------------------|-----------------------------------------------|
| Dashboard          | `GET /api/leads/stats`                        |
| Lead List          | `GET /api/leads?page=&limit=`                 |
| Lead Detail        | `GET /api/leads/:username`                    |
| Create Lead        | `POST /api/leads`                             |
| Search             | `GET /api/leads/search?q=`                    |
| Refresh Lead       | `POST /api/leads/:username/refresh`           |
| Delete Lead        | `DELETE /api/leads/:username`                 |
| Excel Import       | `POST /api/leads/import`                      |

### Mocked API responses

Until the backend is ready, the frontend agent should use static mock responses
that match the exact shapes documented in `docs/api-spec.md` and
`docs/data-model.md`. Do not invent fields — mock only what is specified.

---

## Backend Development Contract

> **For the Backend Agent**

The backend implements exactly the endpoints defined in
[`docs/api-spec.md`](docs/api-spec.md).

### Core rules

1. Do NOT change endpoint paths, HTTP methods, or route names without
   updating `docs/api-spec.md` first and getting it approved.

2. Do NOT change the success/error response envelopes.
   All responses use `{ success, data }` or `{ success, error: { code, message } }`.

3. Do NOT change the pagination envelope shape.

4. The Lead document written to MongoDB must match the schema in
   [`docs/data-model.md`](docs/data-model.md) exactly.

5. The LinkedIn parser in `test-linkedin-profile.js` is already working.
   Extract the parser and client logic into `src/linkedin/parser.js` and
   `src/linkedin/client.js`. Do NOT redesign the parsing logic.

6. LinkedIn credentials must be read from environment variables ONLY inside
   `src/linkedin/client.js`. They must never appear in any other file.

7. The `username` field must be stored lowercase. Normalize on write.

8. Validate the `username` field on every inbound request.
   Reject anything that does not match: `^[a-z0-9\-_.]{1,100}$`

9. The `/api/leads/search`, `/api/leads/import`, and `/api/leads/stats`
   routes must be registered BEFORE the `/:username` wildcard routes.

---

## Not Implemented in Version 1

The following are explicitly out of scope for v1:

| Feature                          | Reason deferred           |
|----------------------------------|---------------------------|
| Authentication / user accounts   | Future extension          |
| Role-based access control        | Future extension          |
| Redis caching                    | Future extension          |
| Background job queue             | Future extension          |
| Import job progress streaming    | Future extension          |
| Lead change history / audit log  | Future extension          |
| Advanced filtering (company/loc) | Future extension          |
| Lead tagging / notes             | Future extension          |
| Lead scoring / AI enrichment     | Future extension          |
| Email / contact finding          | Future extension          |
| GraphQL API                      | Future extension          |
| Proxy rotation / CAPTCHA bypass  | Out of scope entirely     |
| Additional LinkedIn enrichment   | Out of scope for v1       |
| CSV export                       | Future extension          |
| Scheduled / automatic refresh    | Future extension          |

---

## Future Extensions

These can be implemented after v1 is stable:

- **Authentication** — JWT-based, with per-user lead ownership
- **Redis caching** — cache hot leads to avoid MongoDB reads on every request
- **Background import jobs** — queue large imports, return job ID immediately
- **Import job progress** — SSE or polling endpoint for import status
- **Lead change history** — diff-based audit log per refresh
- **Advanced search** — filter by company, title, location, skill, industry
- **Lead tagging and notes** — custom metadata per lead
- **Lead scoring** — configurable heuristics or AI-assisted
- **CSV import** — alongside Excel
- **Export** — CSV or JSON export of filtered leads
- **Scheduled refresh** — cron-based re-fetch of stale leads

---

## Architecture Approval

**Status: PENDING APPROVAL**

The following documents are ready for review:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api-spec.md`](docs/api-spec.md)
- [`docs/data-model.md`](docs/data-model.md)
- [`docs/flow.md`](docs/flow.md)

---

**DO NOT implement the backend until this approval status is changed.**

**DO NOT create Express routes yet.**

**DO NOT create Mongoose models yet.**

**DO NOT modify the existing LinkedIn parser (`test-linkedin-profile.js`).**

Once the architecture is approved, update this section to:

```
Status: APPROVED — [date]
Backend implementation: IN PROGRESS
Frontend implementation: IN PROGRESS
```
