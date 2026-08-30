# API Specification

## LinkedIn Lead Extractor — REST API Contract v1

Base URL: `/api`

All requests and responses use `Content-Type: application/json`
unless the endpoint is a file upload (`multipart/form-data`).

---

## Standard Response Envelopes

### Single lead response

```json
{
  "success": true,
  "data": { /* Lead document */ }
}
```

### Create / fetch response (includes source)

```json
{
  "success": true,
  "source": "linkedin" | "database",
  "data": { /* Lead document */ }
}
```

### Paginated list response

```json
{
  "success": true,
  "data": [ /* Lead documents */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error response

```json
{
  "success": false,
  "error": {
    "code": "LEAD_NOT_FOUND",
    "message": "Lead not found"
  }
}
```

---

## Error Codes

| Code                          | HTTP Status | Meaning                                                   |
|-------------------------------|-------------|-----------------------------------------------------------|
| `INVALID_USERNAME`            | 400         | Username is empty, too long, or contains illegal chars    |
| `INVALID_REQUEST`             | 400         | Malformed request body or missing required field          |
| `LEAD_NOT_FOUND`              | 404         | No lead with this username exists in the database         |
| `LINKEDIN_AUTH_ERROR`         | 502         | LinkedIn returned 401 — session credentials are invalid   |
| `LINKEDIN_FORBIDDEN`          | 502         | LinkedIn returned 403 — access denied or CSRF error       |
| `LINKEDIN_RATE_LIMITED`       | 429         | LinkedIn returned 429 — rate limit hit, do not retry now  |
| `LINKEDIN_PROFILE_NOT_FOUND`  | 404         | LinkedIn returned no profile for this username            |
| `LINKEDIN_UPSTREAM_ERROR`     | 502         | LinkedIn returned an unexpected status or malformed body  |
| `INVALID_EXCEL`               | 400         | Uploaded file is not a valid Excel/CSV or has no data     |
| `DATABASE_ERROR`              | 500         | MongoDB operation failed                                  |
| `IMPORT_ERROR`                | 500         | Import process itself failed (batch-level, not per-row)   |

---

## Endpoints

---

### POST /api/leads

**Purpose:** Create a new lead from a LinkedIn username, or return the existing stored lead.

**LinkedIn called:** Only if the username does not already exist in MongoDB.

**MongoDB called:** Always.

#### Request

```
POST /api/leads
Content-Type: application/json
```

```json
{
  "username": "vanshika-goel-sde"
}
```

| Field      | Type   | Required | Validation                                        |
|------------|--------|----------|---------------------------------------------------|
| `username` | string | yes      | Non-empty, lowercase, max 100 chars, no spaces    |

The backend normalizes `username` to lowercase before lookup and storage.

#### Success Response — lead already in database

```json
{
  "success": true,
  "source": "database",
  "data": { /* Lead document */ }
}
```

HTTP 200

#### Success Response — lead fetched from LinkedIn

```json
{
  "success": true,
  "source": "linkedin",
  "data": { /* Lead document */ }
}
```

HTTP 201

#### Error Responses

| Condition                     | Code                         | HTTP |
|-------------------------------|------------------------------|------|
| `username` missing or blank   | `INVALID_USERNAME`           | 400  |
| LinkedIn 401                  | `LINKEDIN_AUTH_ERROR`        | 502  |
| LinkedIn 403                  | `LINKEDIN_FORBIDDEN`         | 502  |
| LinkedIn 429                  | `LINKEDIN_RATE_LIMITED`      | 429  |
| Profile not found on LinkedIn | `LINKEDIN_PROFILE_NOT_FOUND` | 404  |
| Other LinkedIn error          | `LINKEDIN_UPSTREAM_ERROR`    | 502  |
| MongoDB write failed          | `DATABASE_ERROR`             | 500  |

---

### GET /api/leads

**Purpose:** List stored leads, newest first.

**LinkedIn called:** Never.

**MongoDB called:** Yes.

#### Request

```
GET /api/leads?page=1&limit=10
```

| Query Param | Type    | Default | Constraints              |
|-------------|---------|---------|--------------------------|
| `page`      | integer | 1       | ≥ 1                      |
| `limit`     | integer | 10      | 1–10 (hard cap at 10)    |

#### Success Response

HTTP 200

```json
{
  "success": true,
  "data": [ /* Lead documents */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Sorted by `lastSeenAt` descending.

#### Error Responses

| Condition            | Code             | HTTP |
|----------------------|------------------|------|
| MongoDB query failed | `DATABASE_ERROR` | 500  |

---

### GET /api/leads/search

**Purpose:** Search stored leads by text.

**LinkedIn called:** Never.

**MongoDB called:** Yes.

**IMPORTANT:** This route must be registered BEFORE `GET /api/leads/:username`
to prevent Express matching `search` as a username parameter.

#### Request

```
GET /api/leads/search?q=software&page=1&limit=10
```

| Query Param | Type    | Default | Constraints              |
|-------------|---------|---------|--------------------------|
| `q`         | string  | —       | Required, min 1 char     |
| `page`      | integer | 1       | ≥ 1                      |
| `limit`     | integer | 10      | 1–10                     |

Searched fields (case-insensitive regex):
- `username`
- `profile.firstName`
- `profile.lastName`
- `profile.headline`

#### Success Response

HTTP 200 — same pagination envelope as GET /api/leads

#### Error Responses

| Condition       | Code              | HTTP |
|-----------------|-------------------|------|
| `q` missing     | `INVALID_REQUEST` | 400  |
| MongoDB failed  | `DATABASE_ERROR`  | 500  |

---

### GET /api/leads/:username

**Purpose:** Fetch a single stored lead by username.

**LinkedIn called:** Never.

**MongoDB called:** Yes. Updates `lastSeenAt` to now.

#### Request

```
GET /api/leads/vanshika-goel-sde
```

| Path Param  | Type   | Description                         |
|-------------|--------|-------------------------------------|
| `username`  | string | The lead's public LinkedIn username |

#### Success Response

HTTP 200

```json
{
  "success": true,
  "data": { /* Lead document */ }
}
```

#### Error Responses

| Condition        | Code             | HTTP |
|------------------|------------------|------|
| Lead not found   | `LEAD_NOT_FOUND` | 404  |
| MongoDB failed   | `DATABASE_ERROR` | 500  |

---

### POST /api/leads/:username/refresh

**Purpose:** Re-fetch a lead's profile from LinkedIn and update the stored document.

**LinkedIn called:** Always.

**MongoDB called:** Yes — reads existing lead, writes updated profile.

**Precondition:** Lead must already exist in the database. If not, returns 404.
This endpoint does NOT create new leads.

#### Request

```
POST /api/leads/vanshika-goel-sde/refresh
```

No request body.

#### Success Response

HTTP 200

```json
{
  "success": true,
  "data": { /* Updated Lead document */ }
}
```

#### Error Responses

| Condition                     | Code                         | HTTP |
|-------------------------------|------------------------------|------|
| Lead not found in database    | `LEAD_NOT_FOUND`             | 404  |
| LinkedIn 401                  | `LINKEDIN_AUTH_ERROR`        | 502  |
| LinkedIn 403                  | `LINKEDIN_FORBIDDEN`         | 502  |
| LinkedIn 429                  | `LINKEDIN_RATE_LIMITED`      | 429  |
| Profile not found on LinkedIn | `LINKEDIN_PROFILE_NOT_FOUND` | 404  |
| Other LinkedIn error          | `LINKEDIN_UPSTREAM_ERROR`    | 502  |
| MongoDB write failed          | `DATABASE_ERROR`             | 500  |

**Behavior on LinkedIn failure:**
The stored profile data is NOT modified. Only after a successful LinkedIn
fetch and parse does the document get updated. This prevents partial writes.

---

### DELETE /api/leads/:username

**Purpose:** Remove a stored lead from the database.

**LinkedIn called:** Never.

**MongoDB called:** Yes.

#### Request

```
DELETE /api/leads/vanshika-goel-sde
```

No request body.

#### Success Response

HTTP 200

```json
{
  "success": true,
  "data": {
    "username": "vanshika-goel-sde",
    "deleted": true
  }
}
```

#### Error Responses

| Condition       | Code             | HTTP |
|-----------------|------------------|------|
| Lead not found  | `LEAD_NOT_FOUND` | 404  |
| MongoDB failed  | `DATABASE_ERROR` | 500  |

---

### POST /api/leads/import

**Purpose:** Import multiple leads from an uploaded Excel or CSV file.

**LinkedIn called:** Only for usernames not already in the database.

**MongoDB called:** Yes.

**IMPORTANT:** This route must be registered BEFORE `POST /api/leads/:username/refresh`
or any wildcard pattern that could match `import`.

#### Request

```
POST /api/leads/import
Content-Type: multipart/form-data
```

| Field  | Type | Description                                  |
|--------|------|----------------------------------------------|
| `file` | file | `.xlsx`, `.xls`, or `.csv` file              |

**Expected file structure:**

The file must contain a column named exactly `username` (case-insensitive).
Other columns are ignored.

```
| username          |
|-------------------|
| vanshika-goel-sde |
| ritikjoshi        |
| abc               |
```

**Constraints:**
- Accepted formats: `.xlsx`, `.xls`, `.csv`
- Maximum rows: 500 per import (v1 limit)
- Empty rows are skipped
- Duplicate usernames within the file are deduplicated before processing
- Existing leads in MongoDB are skipped (not re-fetched from LinkedIn)
- Concurrency: controlled by `BATCH_CONCURRENCY` env var (default 5)
- Import continues even if individual usernames fail

#### Success Response

HTTP 200

```json
{
  "success": true,
  "summary": {
    "totalRows": 10,
    "uniqueUsernames": 9,
    "alreadyExists": 3,
    "created": 5,
    "failed": 1
  },
  "results": [
    {
      "username": "vanshika-goel-sde",
      "status": "created",
      "leadId": "64abc..."
    },
    {
      "username": "ritikjoshi",
      "status": "exists",
      "leadId": "64def..."
    },
    {
      "username": "bad-user-404",
      "status": "failed",
      "error": "LINKEDIN_PROFILE_NOT_FOUND"
    }
  ]
}
```

`status` values:
- `"created"` — fetched from LinkedIn and stored
- `"exists"` — already in database, not re-fetched
- `"failed"` — LinkedIn error or parse error; `error` field contains the error code

#### Error Responses

| Condition                      | Code              | HTTP |
|--------------------------------|-------------------|------|
| No file in request             | `INVALID_REQUEST` | 400  |
| Unsupported file format        | `INVALID_EXCEL`   | 400  |
| No `username` column found     | `INVALID_EXCEL`   | 400  |
| File has no data rows          | `INVALID_EXCEL`   | 400  |
| File exceeds 500 row limit     | `INVALID_EXCEL`   | 400  |
| Batch process crashed entirely | `IMPORT_ERROR`    | 500  |

---

### GET /api/leads/stats

**Purpose:** Return aggregate statistics about stored leads.

**LinkedIn called:** Never.

**MongoDB called:** Yes.

#### Request

```
GET /api/leads/stats
```

No parameters.

#### Success Response

HTTP 200

```json
{
  "success": true,
  "data": {
    "totalLeads": 142,
    "lastImportedAt": "2026-08-30T10:00:00.000Z",
    "totalRefreshed": 38
  }
}
```

| Field            | Type           | Description                                        |
|------------------|----------------|----------------------------------------------------|
| `totalLeads`     | integer        | Count of all Lead documents in the collection      |
| `lastImportedAt` | ISO 8601 / null| `createdAt` of the most recently created Lead      |
| `totalRefreshed` | integer        | Count of leads where `refreshCount` ≥ 1            |

#### Error Responses

| Condition      | Code             | HTTP |
|----------------|------------------|------|
| MongoDB failed | `DATABASE_ERROR` | 500  |

---

## Route Registration Order

To prevent Express from matching `search`, `import`, and `stats` as `:username`
path parameters, routes must be registered in this order:

```
POST   /api/leads/import          ← before /:username
GET    /api/leads/search          ← before /:username
GET    /api/leads/stats           ← before /:username
POST   /api/leads                 ← create
GET    /api/leads                 ← list
GET    /api/leads/:username       ← single
POST   /api/leads/:username/refresh
DELETE /api/leads/:username
```

---

## Username Validation Rules

- Type: string
- Required: yes
- Trim whitespace before validation
- Normalize to lowercase
- Allowed characters: `a-z`, `0-9`, `-`, `_`, `.`
- Minimum length: 1 character
- Maximum length: 100 characters
- Must not be empty after trimming
- Must not equal reserved words: `search`, `import`, `stats`

The backend is the single source of truth for username normalization.
The frontend sends the raw extracted username; the backend lowercases it.

---

## Frontend / Backend Contract Summary

The frontend MUST NOT:
- Send full LinkedIn URLs to the API
- Depend on LinkedIn entityUrns or Voyager internal structure
- Access or store LinkedIn session cookies
- Construct LinkedIn API requests

The frontend MUST:
- Extract the public username from the LinkedIn URL before sending
- Use the normalized Lead document returned by the backend
- Handle all documented error codes gracefully
