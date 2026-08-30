# LinkedIn Lead Extractor

A full-stack app that accepts a LinkedIn public username, fetches the profile via LinkedIn's internal Voyager API, stores it as a Lead in MongoDB, and serves it through a REST API consumed by a React frontend.

```
monorepo/
├── server/   ← Express + TypeScript REST API
└── client/   ← React + Vite + Tailwind frontend
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)
- Active LinkedIn browser session (for cookies)

---

## 1. Server Setup

```bash
cd server
cp .env.example .env
npm install
```

Fill in `server/.env`:

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/linkedin-leads
LINKEDIN_LI_AT=<your li_at cookie>
LINKEDIN_JSESSIONID=ajax:<your jsessionid>
LINKEDIN_USER_AGENT="Mozilla/5.0 ..."
BATCH_CONCURRENCY=5
CORS_ORIGIN=http://localhost:5173
```

> **How to get LinkedIn cookies:** Log into LinkedIn in your browser → DevTools → Application → Cookies → copy `li_at` and `JSESSIONID`.
>
> **Important:** The server must run from the **same IP** where those cookies were created, or LinkedIn returns status 999.

```bash
npm run dev        # development with hot-reload
npm run build      # compile TypeScript → dist/
npm start          # run compiled output
```

Server runs at `http://localhost:3000`

---

## 2. Client Setup

```bash
cd client
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

For development without a backend:
```bash
npm run dev:mock   # uses in-memory fixtures
```

---

## 3. API Reference

Full spec: [`server/docs/api-spec.md`](server/docs/api-spec.md)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/leads` | Create lead or return cached |
| `GET` | `/api/leads` | List leads (paginated) |
| `GET` | `/api/leads/search?q=` | Search stored leads |
| `GET` | `/api/leads/stats` | Database statistics |
| `GET` | `/api/leads/:username` | Get single lead |
| `POST` | `/api/leads/:username/refresh` | Re-fetch from LinkedIn |
| `DELETE` | `/api/leads/:username` | Delete lead |
| `POST` | `/api/leads/import` | Bulk import from Excel/CSV |

All responses use:
```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## 4. How It Works

```
Frontend (username input)
        ↓
POST /api/leads { "username": "vanshika-goel-sde" }
        ↓
Lead Service → MongoDB lookup
        ↓ (if not found)
LinkedIn Voyager API (one request)
        ↓
Parser → normalized Lead document
        ↓
MongoDB → return to frontend
```

- Existing leads are **never re-fetched** unless you call `/refresh`
- See full flow diagrams: [`server/docs/flow.md`](server/docs/flow.md)
- See architecture: [`server/docs/architecture.md`](server/docs/architecture.md)
- See data model: [`server/docs/data-model.md`](server/docs/data-model.md)

---

## 5. Deploy Server to Vercel

```bash
cd server
npx vercel
```

Add these environment variables in the Vercel dashboard (Settings → Environment Variables):

- `MONGODB_URI`
- `LINKEDIN_LI_AT`
- `LINKEDIN_JSESSIONID`
- `LINKEDIN_USER_AGENT`
- `BATCH_CONCURRENCY` → `5`
- `CORS_ORIGIN` → your frontend URL

---

## 6. Excel Import Format

Upload a `.xlsx`, `.xls`, or `.csv` file with a `username` column:

```
| username          |
|-------------------|
| vanshika-goel-sde |
| ritikjoshi        |
```

Max 500 rows per import. Existing leads are skipped.

---

## 7. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| LinkedIn status 999 | Server IP ≠ IP where cookies were created | Run server on same machine as your browser, or refresh cookies from the server IP |
| 401 Unauthorized | Cookies expired | Log into LinkedIn again and copy fresh `li_at` + `JSESSIONID` |
| MongoDB connection failed | URI wrong or IP not whitelisted | Check Atlas Network Access → add server IP |
| 429 Rate Limited | Too many LinkedIn requests | Wait before retrying — the server will not retry automatically |
