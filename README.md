# LinkedIn Lead Extractor

## Overview

📺 [Watch the Overview Video](./overview.mkv)

Extract, store and browse LinkedIn profiles through a clean REST API and React frontend — without using any third-party LinkedIn SDK.

```
monorepo/
├── server/   ← Express + TypeScript REST API + MongoDB
└── client/   ← React + Vite + Tailwind CSS
```

---

## How It Works

1. You give it a LinkedIn username (e.g. `vanshika-goel-sde`)
2. The server checks MongoDB first — if the profile is already stored it returns it instantly without touching LinkedIn
3. If it's new, the server makes **one** HTTP request to LinkedIn's internal Voyager API using your browser session cookies
4. The raw response is parsed into a clean normalized document and stored in MongoDB
5. Every future request for that username is served from the database — LinkedIn is not contacted again unless you explicitly refresh

```
You  →  POST /api/leads { username }
             ↓
         MongoDB? → YES → return stored profile
             ↓ NO
         LinkedIn Voyager API (1 request)
             ↓
         Parser → normalized Lead
             ↓
         MongoDB → return to you
```

---

## Approach

- **No SDK or scraping library.** Uses native Node.js `fetch` directly against LinkedIn's undocumented Voyager REST endpoint (`/voyager/api/identity/dash/profiles`).
- **Session cookie auth.** Requires `li_at` and `JSESSIONID` from an active LinkedIn browser session. The server uses them exactly as a browser would.
- **Database-first.** Every profile is cached in MongoDB. LinkedIn is only contacted for new profiles or explicit refreshes. This keeps requests minimal.
- **Request throttling.** A minimum 5-second gap is enforced between every LinkedIn request at the server level, regardless of which endpoint triggered it. This is the single most effective protection against bot detection.
- **TypeScript throughout.** Both server and client are fully typed.

---

## Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas (or local MongoDB)
- A LinkedIn account logged in on your browser

### 1 — Get your LinkedIn cookies

1. Open LinkedIn in your browser and log in
2. Open DevTools → Application → Cookies → `https://www.linkedin.com`
3. Copy the value of `li_at`
4. Copy the value of `JSESSIONID`

> **Critical:** The server must run from the **same IP address** where these cookies were created. If your server is on a different IP (e.g. a VPS or cloud function), LinkedIn will return status 999 and block the request.

### 2 — Server

```bash
cd server
cp .env.example .env
# edit .env with your values
npm install
npm run dev
```

**`server/.env`:**

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/linkedin-leads

LINKEDIN_LI_AT=<paste li_at cookie here>
LINKEDIN_JSESSIONID=ajax:<paste jsessionid here>
LINKEDIN_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."

# Throttling — minimum milliseconds between LinkedIn requests (default 5000)
LINKEDIN_MIN_GAP_MS=5000

# Excel import — max parallel LinkedIn requests (default 5)
BATCH_CONCURRENCY=5

CORS_ORIGIN=http://localhost:5173
```

Server runs at `http://localhost:3000`. Health check: `GET /health`

### 3 — Client

```bash
cd client
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

Run without a backend (uses mock data):
```bash
npm run dev:mock
```

---

## API

Full spec: [`server/docs/api-spec.md`](server/docs/api-spec.md)

| Method | Endpoint | LinkedIn called? | Description |
|--------|----------|-----------------|-------------|
| `POST` | `/api/leads` | Only if new | Create lead or return cached |
| `GET` | `/api/leads` | Never | List all leads (paginated) |
| `GET` | `/api/leads/search?q=` | Never | Search stored leads |
| `GET` | `/api/leads/stats` | Never | Database statistics |
| `GET` | `/api/leads/:username` | Never | Get single stored lead |
| `POST` | `/api/leads/:username/refresh` | Always | Re-fetch from LinkedIn |
| `DELETE` | `/api/leads/:username` | Never | Remove lead |
| `POST` | `/api/leads/import` | Only for new | Bulk import from Excel/CSV |

**Response format:**
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "LEAD_NOT_FOUND", "message": "..." } }
```

---

## Rate Limiting & Throttling

LinkedIn flags accounts that make requests too quickly. The server has two layers of protection:

**1. Request throttling (built-in)**
A 5-second minimum gap is enforced between every LinkedIn request at the module level. If two requests arrive at the same time, the second one waits in queue. Configure with:
```env
LINKEDIN_MIN_GAP_MS=5000   # 5 seconds (default)
LINKEDIN_MIN_GAP_MS=8000   # more conservative
```

**2. Import concurrency cap**
During Excel imports, LinkedIn requests run in parallel up to a maximum. Lower this if you see 999 errors:
```env
BATCH_CONCURRENCY=5   # default — up to 5 parallel requests
BATCH_CONCURRENCY=2   # safer for large imports
BATCH_CONCURRENCY=1   # sequential — slowest but safest
```

**What the server never does:**
- Automatically retry a failed LinkedIn request
- Make more than one LinkedIn request per profile per API call
- Contact LinkedIn for profiles already in the database

---

## Excel Import

Upload a `.xlsx`, `.xls`, or `.csv` file with a `username` column:

```
| username          |
|-------------------|
| vanshika-goel-sde |
| ritikjoshi        |
```

- Max **500 rows** per import
- Duplicate usernames in the file are deduplicated automatically
- Profiles already in MongoDB are **skipped** — LinkedIn is not contacted for them
- Individual failures don't abort the import; results are returned per-row

---

## Deploy Server to Vercel

```bash
cd server
npx vercel
```

Set these in Vercel → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | your Atlas connection string |
| `LINKEDIN_LI_AT` | your li_at cookie |
| `LINKEDIN_JSESSIONID` | your JSESSIONID |
| `LINKEDIN_USER_AGENT` | your browser UA string |
| `LINKEDIN_MIN_GAP_MS` | `5000` |
| `BATCH_CONCURRENCY` | `3` (lower is safer on serverless) |
| `CORS_ORIGIN` | your frontend URL |

---

## Known Limitations

| Limitation | Detail |
|-----------|--------|
| **IP must match cookie origin** | LinkedIn ties session cookies to the IP they were created on. If your server runs on a different IP, requests return status 999 (bot detection). The fix is to either run the server on the same machine as your browser, or log into LinkedIn from the server's IP to generate fresh cookies. |
| **Session cookies expire** | `li_at` typically lasts a few weeks. When it expires all LinkedIn requests fail with 401. Re-login to LinkedIn and update your `.env`. |
| **Skills are paginated by LinkedIn** | LinkedIn only returns the first 20 skills in a single Voyager request. The remaining skills (if any) require additional requests which this app does not make. |
| **Throttle is in-process only** | The 5-second gap is tracked in memory. On serverless deployments where each invocation is a fresh process (e.g. Vercel cold starts), the gap counter resets. Consider increasing `LINKEDIN_MIN_GAP_MS` if deploying to serverless. |
| **No authentication** | The API has no user accounts or access control. Anyone who can reach the server can read, add or delete leads. Add a reverse proxy or auth middleware before exposing this publicly. |
| **500-row import limit** | Excel imports are capped at 500 rows per request to avoid timeouts on serverless functions. |
| **LinkedIn API is undocumented** | The Voyager endpoint is internal and can change without notice. If requests suddenly fail with 410 or unexpected formats, the decoration ID or endpoint path may need updating. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Status 999 | Server IP ≠ IP where cookies were created | Run server on your own machine, or regenerate cookies from the server IP |
| 401 Unauthorized | Cookies expired | Log into LinkedIn, copy fresh `li_at` and `JSESSIONID` |
| 403 Forbidden | CSRF mismatch | Make sure `LINKEDIN_JSESSIONID` matches the `ajax:...` value exactly |
| 429 Rate Limited | Too many requests too fast | The server stops automatically. Wait a few minutes before retrying |
| MongoDB connection failed | URI wrong or IP not whitelisted | Check Atlas → Network Access → add your server IP |
| Import times out | Too many rows or concurrency too high | Lower `BATCH_CONCURRENCY` or split the file into smaller batches |

---

## Docs

| File | Contents |
|------|----------|
| [`server/docs/api-spec.md`](server/docs/api-spec.md) | Full endpoint contract, request/response shapes, error codes |
| [`server/docs/architecture.md`](server/docs/architecture.md) | Layer diagram, module responsibilities |
| [`server/docs/data-model.md`](server/docs/data-model.md) | MongoDB Lead schema, field reference, indexes |
| [`server/docs/flow.md`](server/docs/flow.md) | Request flow diagrams for all 8 operations |
