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

---

## Repository Structure

```
linkedin-lead-extractor/
├── src/
│   ├── routes/
│   │   └── leads.js               ← Express route definitions
│   ├── controllers/
│   │   └── leadController.js      ← HTTP req/res handling only
│   ├── services/
│   │   ├── leadService.js         ← Business logic
│   │   └── excelImportService.js  ← Excel parsing + batch import
│   ├── linkedin/
│   │   ├── client.js              ← LinkedIn HTTP client (ONE request)
│   │   └── parser.js              ← Entity graph → normalized profile
│   ├── models/
│   │   └── Lead.js                ← Mongoose schema
│   └── app.js                     ← Express app setup
├── docs/
│   ├── architecture.md            ← System architecture
│   ├── api-spec.md                ← Full REST API contract
│   ├── data-model.md              ← MongoDB Lead document spec
│   └── flow.md                    ← Request flow diagrams
├── test-linkedin-profile.js       ← Existing standalone parser/client PoC
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
| `PORT`                | No       | 3000    | HTTP server port                          |
| `MONGODB_URI`         | Yes      | —       | MongoDB connection string                 |
| `LINKEDIN_LI_AT`      | Yes      | —       | LinkedIn session token                    |
| `LINKEDIN_JSESSIONID` | Yes      | —       | LinkedIn CSRF / session token             |
| `LINKEDIN_USER_AGENT` | Yes      | —       | Browser user-agent string                 |
| `BATCH_CONCURRENCY`   | No       | 5       | Max parallel LinkedIn requests in imports |

**Security:**
- These variables are read only inside the LinkedIn Client module
- They are never returned via API responses
- They are never logged
- `.env` is gitignored — never commit credentials

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
