# Architecture

## LinkedIn Lead Extractor — System Architecture

---

## Overview

The system is a REST API backend that accepts a LinkedIn public username,
optionally fetches the profile from LinkedIn's internal Voyager API,
parses the raw normalized entity graph into a clean structured document,
persists it as a Lead in MongoDB, and serves previously stored leads
from the database without contacting LinkedIn again.

---

## Layer Diagram

```
┌──────────────────────────────────────────────────────┐
│                     FRONTEND                         │
│  (React / any HTTP client)                           │
│  Responsible for: URL → username extraction,         │
│  display, pagination, search UI, Excel upload UI     │
└───────────────────────────┬──────────────────────────┘
                            │  HTTP  (username, not URL)
                            ▼
┌──────────────────────────────────────────────────────┐
│                  EXPRESS API LAYER                   │
│  src/routes/leads.js                                 │
│  Responsible for: HTTP routing only                  │
└───────────────────────────┬──────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│               EXPRESS CONTROLLERS                    │
│  src/controllers/leadController.js                   │
│  Responsible for: req/res handling, input            │
│  validation, response envelope formatting            │
└───────────────────────────┬──────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│                   LEAD SERVICE                       │
│  src/services/leadService.js                         │
│  Responsible for: business logic —                   │
│  - MongoDB lookup before calling LinkedIn            │
│  - orchestrating LinkedIn client + parser            │
│  - timestamp management                              │
│  - import orchestration                              │
└──────────┬────────────────┴──────────────────────────┘
           │                │
           ▼                ▼
┌──────────────────┐  ┌─────────────────────────────────┐
│   MONGODB        │  │       LINKEDIN CLIENT           │
│  src/models/     │  │  src/linkedin/client.js         │
│  Lead.js         │  │  Responsible for: ONE HTTP      │
│                  │  │  request to Voyager REST API,   │
│  Indexes:        │  │  auth headers, redirect/rate    │
│  - username      │  │  limit detection                │
│    (unique)      │  └──────────────┬──────────────────┘
│  - lastSeenAt    │                 │  raw JSON
│    (desc)        │                 ▼
└──────────────────┘  ┌─────────────────────────────────┐
                      │       LINKEDIN PARSER           │
                      │  src/linkedin/parser.js         │
                      │  Responsible for: resolving the │
                      │  normalized entity graph into   │
                      │  our canonical Lead profile     │
                      │  structure. No I/O.             │
                      └──────────────┬──────────────────┘
                                     │  normalized profile
                                     ▼
                             Lead Service
                             (stores in MongoDB)
```

---

## Excel Import Path

```
POST /api/leads/import
        │
        ▼
┌──────────────────────────────────────┐
│         EXCEL IMPORT SERVICE         │
│  src/services/excelImportService.js  │
│  Responsible for:                    │
│  - parse xlsx/xls/csv                │
│  - extract + normalize usernames     │
│  - deduplicate within batch          │
│  - check MongoDB for existing leads  │
│  - batch LinkedIn fetches            │
│    (concurrency = BATCH_CONCURRENCY) │
│  - collect per-username results      │
│  - return import summary             │
└──────────────────────────────────────┘
```

---

## Responsibilities by Layer

### Controller (`src/controllers/leadController.js`)
- Parse and validate HTTP request parameters
- Call Lead Service methods
- Format and send HTTP response using standard envelope
- Never contain business logic
- Never call LinkedIn directly
- Never call MongoDB directly

### Lead Service (`src/services/leadService.js`)
- Check MongoDB before calling LinkedIn (idempotency)
- Decide whether a LinkedIn request is needed
- Manage timestamps (`firstSeenAt`, `lastSeenAt`, `lastRefreshedAt`, `refreshCount`)
- Orchestrate LinkedIn client + parser
- Write/update Lead documents in MongoDB
- Never handle HTTP request/response objects

### LinkedIn Client (`src/linkedin/client.js`)
- Make exactly ONE HTTP request to Voyager REST API per call
- Attach all required headers and cookies from environment variables
- Detect and throw typed errors for: 401, 403, 429, 302/303, 410, 999
- Never parse the response body beyond JSON.parse
- Never retry automatically
- Never expose credentials in errors or logs

### LinkedIn Parser (`src/linkedin/parser.js`)
- Accept raw Voyager JSON as input
- Resolve the normalized entity graph (entityUrn index + collection traversal)
- Return a structured normalized profile object
- Pure function — no I/O, no side effects
- Already implemented in `test-linkedin-profile.js`; will be extracted as a module

### MongoDB Lead Model (`src/models/Lead.js`)
- Mongoose schema matching the canonical Lead document structure
- Indexes: `username` (unique), `lastSeenAt` (descending)
- No business logic

### Excel Import Service (`src/services/excelImportService.js`)
- Parse `.xlsx`, `.xls`, `.csv` files from multipart upload
- Extract `username` column values
- Normalize and deduplicate within the batch
- Use Lead Service for per-username create logic
- Cap concurrent LinkedIn requests to `BATCH_CONCURRENCY`
- Continue on individual failures, collect per-result status
- Return import summary

---

## Environment Variables

| Variable              | Used by            | Purpose                                      |
|-----------------------|--------------------|----------------------------------------------|
| `PORT`                | Express server     | HTTP listen port (default 3000)              |
| `MONGODB_URI`         | MongoDB connection | Connection string                            |
| `LINKEDIN_LI_AT`      | LinkedIn Client    | Session token                                |
| `LINKEDIN_JSESSIONID` | LinkedIn Client    | CSRF / session token                         |
| `LINKEDIN_USER_AGENT` | LinkedIn Client    | Browser user-agent string                    |
| `BATCH_CONCURRENCY`   | Excel Import Svc   | Max parallel LinkedIn requests (default 5)   |

LinkedIn credentials are read **only** inside the LinkedIn Client.
They are never passed through controllers, services, or API responses.

---

## What This Architecture Is NOT

- No Redis, no background queue, no job scheduler in v1
- No authentication or per-user ownership in v1
- No GraphQL
- No proxy rotation
- No automatic retry of failed LinkedIn requests
- No raw LinkedIn response storage
- No frontend server-side rendering

---

## File Structure (Proposed)

```
linkedin-lead-extractor/
├── src/
│   ├── routes/
│   │   └── leads.js
│   ├── controllers/
│   │   └── leadController.js
│   ├── services/
│   │   ├── leadService.js
│   │   └── excelImportService.js
│   ├── linkedin/
│   │   ├── client.js
│   │   └── parser.js
│   ├── models/
│   │   └── Lead.js
│   └── app.js
├── docs/
│   ├── architecture.md
│   ├── api-spec.md
│   ├── data-model.md
│   └── flow.md
├── .env
├── .env.example
├── package.json
└── README.md
```
