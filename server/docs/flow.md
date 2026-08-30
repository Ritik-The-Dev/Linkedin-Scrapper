# Flow Diagrams

## LinkedIn Lead Extractor — Request Flows

---

## Flow 1 — Create / Fetch Lead

`POST /api/leads  { "username": "vanshika-goel-sde" }`

```
Frontend
  │
  │  POST /api/leads
  │  { "username": "vanshika-goel-sde" }
  ▼
Controller
  │
  │  validate username
  │  normalize to lowercase
  ▼
Lead Service
  │
  │  MongoDB: find by username
  ├──────────────────────────────────────────────┐
  │                                              │
  │  FOUND                                       │  NOT FOUND
  │                                              │
  ▼                                              ▼
Update lastSeenAt                         LinkedIn Client
Return lead                                    │
  │                                            │  GET Voyager REST API
  │                                            │  (ONE request)
  │                                            ▼
  │                                      LinkedIn Parser
  │                                            │
  │                                            │  normalized profile
  │                                            ▼
  │                                      MongoDB: insert
  │                                      Set timestamps:
  │                                        firstSeenAt = now
  │                                        lastSeenAt = now
  │                                        lastRefreshedAt = now
  │                                        refreshCount = 0
  │                                            │
  ▼                                            ▼
Controller                              Controller
  │                                            │
  │  source: "database"                        │  source: "linkedin"
  │  HTTP 200                                  │  HTTP 201
  ▼                                            ▼
Frontend                                 Frontend
```

**Key rule:** An existing lead NEVER triggers a LinkedIn request.

---

## Flow 2 — Get Single Lead

`GET /api/leads/:username`

```
Frontend
  │
  │  GET /api/leads/vanshika-goel-sde
  ▼
Controller
  │
  ▼
Lead Service
  │
  │  MongoDB: find by username
  ├────────────────────────────┐
  │                            │
  │  FOUND                     │  NOT FOUND
  │                            │
  ▼                            ▼
Update lastSeenAt         Controller
Return lead                    │
  │                       HTTP 404
  ▼                       LEAD_NOT_FOUND
Controller
  │
  │  HTTP 200
  ▼
Frontend
```

LinkedIn is never contacted.

---

## Flow 3 — Paginated Lead List

`GET /api/leads?page=1&limit=10`

```
Frontend
  │
  │  GET /api/leads?page=1&limit=10
  ▼
Controller
  │
  │  validate page, limit (cap limit at 10)
  ▼
Lead Service
  │
  │  MongoDB: find all
  │           sort by lastSeenAt DESC
  │           skip (page-1)*limit
  │           limit limit
  │           count total
  ▼
Controller
  │
  │  HTTP 200
  │  { data: [...], pagination: { page, limit, total, totalPages, ... } }
  ▼
Frontend
```

LinkedIn is never contacted.

---

## Flow 4 — Refresh Lead

`POST /api/leads/:username/refresh`

```
Frontend
  │
  │  POST /api/leads/vanshika-goel-sde/refresh
  ▼
Controller
  ▼
Lead Service
  │
  │  MongoDB: find by username
  ├────────────────────────────┐
  │                            │
  │  FOUND                     │  NOT FOUND
  │                            │
  ▼                            ▼
LinkedIn Client            Controller
  │                             │
  │  GET Voyager REST API        │  HTTP 404
  │  (ONE request)               │  LEAD_NOT_FOUND
  ▼
LinkedIn error?
  ├──────────────────────────────┐
  │                              │
  │  YES                         │  NO
  │                              │
  ▼                              ▼
Controller               LinkedIn Parser
  │                              │
  │  Return typed error          │  normalized profile
  │  Profile data UNCHANGED      ▼
  │                         MongoDB: update
  ▼                           profile      ← replaced
Frontend                     experience   ← replaced
                             education    ← replaced
                             skills       ← replaced
                             ... all sections replaced
                             lastSeenAt      = now
                             lastRefreshedAt = now
                             refreshCount    += 1
                                  │
                                  ▼
                             Controller
                                  │
                                  │  HTTP 200
                                  ▼
                             Frontend
```

**Key rule:** Profile is updated ONLY after a successful LinkedIn fetch AND parse.
A LinkedIn error leaves the stored data untouched.

---

## Flow 5 — Excel Import

`POST /api/leads/import  (multipart/form-data, file=...)`

```
Frontend
  │
  │  POST /api/leads/import
  │  multipart/form-data
  │  file: leads.xlsx
  ▼
Controller
  │
  │  validate file present
  │  validate extension (.xlsx / .xls / .csv)
  ▼
Excel Import Service
  │
  │  parse file
  │  extract username column
  │  normalize + trim usernames
  │  deduplicate within batch
  │  validate row count ≤ 500
  │
  │  For each unique username:
  │
  │  MongoDB: find by username
  ├───────────────────────────────────────────────────────┐
  │                                                       │
  │  EXISTS                                               │  NEW
  │                                                       │
  ▼                                                       ▼
Mark as "exists"                                  Add to LinkedIn queue
                                                          │
                                                          │  Process up to
                                                          │  BATCH_CONCURRENCY
                                                          │  at a time
                                                          ▼
                                                   LinkedIn Client
                                                   (one request per username)
                                                          │
                                                   LinkedIn error?
                                                   ├───────────────────┐
                                                   │                   │
                                                   │  YES              │  NO
                                                   │                   │
                                                   ▼                   ▼
                                              Mark as             LinkedIn Parser
                                              "failed"                 │
                                              Continue            MongoDB: insert
                                              next row                 │
                                                                  Mark as "created"
                                                                  Continue next row
  │                                                       │
  └────────────────────┬──────────────────────────────────┘
                       │
                       ▼
                  Collect results
                  Build summary
                       │
                       ▼
                  Controller
                       │
                       │  HTTP 200
                       │  { summary: {...}, results: [...] }
                       ▼
                  Frontend
```

**Key rules:**
- Existing leads are skipped — no LinkedIn request
- Individual failures do not abort the import
- Concurrency is capped at `BATCH_CONCURRENCY`

---

## Flow 6 — Search

`GET /api/leads/search?q=software&page=1&limit=10`

```
Frontend
  │
  │  GET /api/leads/search?q=software
  ▼
Controller
  │
  │  validate q present and non-empty
  ▼
Lead Service
  │
  │  MongoDB: case-insensitive regex search across:
  │    username
  │    profile.firstName
  │    profile.lastName
  │    profile.headline
  │  sort lastSeenAt DESC
  │  paginate
  ▼
Controller
  │
  │  HTTP 200
  │  pagination envelope
  ▼
Frontend
```

LinkedIn is never contacted.

---

## Flow 7 — Delete Lead

`DELETE /api/leads/:username`

```
Frontend
  │
  │  DELETE /api/leads/vanshika-goel-sde
  ▼
Controller
  ▼
Lead Service
  │
  │  MongoDB: findOneAndDelete by username
  ├────────────────────────────┐
  │                            │
  │  FOUND                     │  NOT FOUND
  │                            │
  ▼                            ▼
Document deleted           Controller
  │                             │
  ▼                        HTTP 404
Controller               LEAD_NOT_FOUND
  │
  │  HTTP 200
  │  { username, deleted: true }
  ▼
Frontend
```

LinkedIn is never contacted.

---

## Flow 8 — Stats

`GET /api/leads/stats`

```
Frontend
  │
  │  GET /api/leads/stats
  ▼
Controller
  ▼
Lead Service
  │
  │  MongoDB:
  │    totalLeads    = db.leads.countDocuments()
  │    lastImported  = db.leads.findOne({}, sort: { createdAt: -1 }).createdAt
  │    totalRefreshed = db.leads.countDocuments({ refreshCount: { $gte: 1 } })
  ▼
Controller
  │
  │  HTTP 200
  │  { totalLeads, lastImportedAt, totalRefreshed }
  ▼
Frontend
```

LinkedIn is never contacted.

---

## LinkedIn Call Decision Matrix

| Endpoint                          | LinkedIn Called?                         |
|-----------------------------------|------------------------------------------|
| POST /api/leads                   | Only if username NOT in MongoDB          |
| GET /api/leads                    | Never                                    |
| GET /api/leads/search             | Never                                    |
| GET /api/leads/:username          | Never                                    |
| POST /api/leads/:username/refresh | Always (lead must exist first)           |
| DELETE /api/leads/:username       | Never                                    |
| POST /api/leads/import            | Only for usernames NOT in MongoDB        |
| GET /api/leads/stats              | Never                                    |

---

## Error Propagation

LinkedIn Client errors are typed exceptions that propagate up through
Lead Service → Controller → HTTP response using the standard error envelope.

```
LinkedIn Client throws:
  LinkedInAuthError        → LINKEDIN_AUTH_ERROR        → HTTP 502
  LinkedInForbiddenError   → LINKEDIN_FORBIDDEN         → HTTP 502
  LinkedInRateLimitError   → LINKEDIN_RATE_LIMITED      → HTTP 429
  LinkedInNotFoundError    → LINKEDIN_PROFILE_NOT_FOUND → HTTP 404
  LinkedInUpstreamError    → LINKEDIN_UPSTREAM_ERROR    → HTTP 502

Lead Service throws:
  LeadNotFoundError        → LEAD_NOT_FOUND             → HTTP 404

Mongoose/MongoDB errors:
  All DB errors            → DATABASE_ERROR             → HTTP 500

Validation errors:
  Username invalid         → INVALID_USERNAME           → HTTP 400
  Request malformed        → INVALID_REQUEST            → HTTP 400
  Excel invalid            → INVALID_EXCEL              → HTTP 400
```

During Excel import, per-row LinkedIn errors are caught internally,
recorded in the result as `"status": "failed"`, and do NOT propagate
to the top-level HTTP response.
