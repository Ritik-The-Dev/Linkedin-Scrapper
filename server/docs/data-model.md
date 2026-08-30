# Data Model

## LinkedIn Lead Extractor — MongoDB Lead Document

---

## Collection

Collection name: `leads`

---

## Canonical Document Structure

```json
{
  "_id": "ObjectId",
  "username": "vanshika-goel-sde",

  "profile": {
    "identity": {
      "entityUrn": "urn:li:fsd_profile:ACoAADO39x0B...",
      "objectUrn": "urn:li:member:867694365",
      "publicIdentifier": "vanshika-goel-sde",
      "fsdProfileId": "ACoAADO39x0B...",
      "memberId": "867694365",
      "profileUrl": "https://www.linkedin.com/in/vanshika-goel-sde/"
    },
    "firstName": "Vanshika",
    "lastName": "Goel",
    "fullName": "Vanshika Goel",
    "pronouns": "SHE_HER",
    "headline": "Software Engineer 2 at Akamai Technologies",
    "summary": "...",
    "occupation": null,
    "location": {
      "locationName": "Delhi, India",
      "city": "Delhi",
      "country": "India",
      "countryCode": "IN",
      "geoUrn": "urn:li:fsd_geo:106052723"
    },
    "industry": {
      "industryUrn": "urn:li:fsd_industry:4",
      "industryName": "Computer Software"
    },
    "media": {
      "profileImage": {
        "urn": null,
        "rootUrl": "https://media.licdn.com/...",
        "urls": {
          "100": "https://...",
          "200": "https://...",
          "400": "https://...",
          "800": "https://..."
        },
        "largeUrl": "https://...",
        "smallUrl": "https://...",
        "displayImageUrn": "urn:li:digitalmediaAsset:...",
        "frameType": "OPEN_TO_WORK"
      },
      "backgroundImage": {
        "urn": null,
        "rootUrl": "https://media.licdn.com/...",
        "urls": {
          "800": "https://...",
          "1400": "https://..."
        },
        "largeUrl": "https://...",
        "smallUrl": "https://...",
        "displayImageUrn": "urn:li:digitalmediaAsset:..."
      }
    },
    "profileStatus": {
      "openToWork": true,
      "hiring": null,
      "premium": false,
      "premiumBadge": false,
      "creator": false,
      "influencer": false
    },
    "relationship": {
      "connectionDegree": 3,
      "memberDistance": "DISTANCE_3",
      "followerCount": null,
      "connectionCount": null
    }
  },

  "experience": [
    {
      "entityUrn": "urn:li:fsd_profilePosition:...",
      "positionUrn": "urn:li:fsd_profilePosition:...",
      "title": "Software Engineer 2",
      "companyName": "Akamai Technologies",
      "companyId": "3925",
      "companyUrn": "urn:li:fsd_company:3925",
      "companySlug": "akamai-technologies",
      "companyUrl": "https://www.linkedin.com/company/akamai-technologies/",
      "companyLogoUrl": "https://media.licdn.com/...",
      "companyIndustry": "Computer Software",
      "employmentType": "Full-time",
      "employmentTypeUrn": "urn:li:fsd_employmentType:12",
      "location": "Bengaluru",
      "startDate": { "year": 2026, "month": 8, "day": null },
      "endDate":   { "year": null, "month": null, "day": null },
      "current": true,
      "description": null,
      "shouldShowSourceOfHireBadge": false
    }
  ],

  "education": [
    {
      "entityUrn": "urn:li:fsd_profileEducation:...",
      "schoolName": "Guru Tegh Bahadur Institute Of Technology",
      "schoolId": "40706",
      "schoolUrn": "urn:li:fsd_school:40706",
      "schoolSlug": null,
      "schoolUrl": "https://www.linkedin.com/school/...",
      "schoolLogo": {
        "urn": "urn:li:digitalmediaAsset:...",
        "rootUrl": null,
        "urls": { "100": "https://..." },
        "largeUrl": "https://...",
        "smallUrl": "https://..."
      },
      "degree": "Bachelor of Technology - BTech",
      "degreeUrn": "urn:li:fsd_degree:250",
      "fieldOfStudy": "Information Technology",
      "standardizedFieldOfStudyUrn": "urn:li:fsd_fieldOfStudy:100176",
      "grade": "9.2",
      "activities": null,
      "description": null,
      "startDate": { "year": 2020, "month": null, "day": null },
      "endDate":   { "year": 2024, "month": null, "day": null }
    }
  ],

  "skills": [
    {
      "entityUrn": "urn:li:fsd_skill:...",
      "name": "Python (Programming Language)"
    }
  ],

  "projects": [
    {
      "entityUrn": "urn:li:fsd_profileProject:...",
      "title": "Autonomous Curriculum Agent",
      "description": "...",
      "url": null,
      "startDate": { "year": null, "month": null, "day": null },
      "endDate":   { "year": null, "month": null, "day": null },
      "contributors": [ "urn:li:fsd_profile:..." ]
    }
  ],

  "certifications": [],

  "languages": [],

  "courses": [],

  "publications": [],

  "honors": [],

  "volunteerExperience": [],

  "patents": [],

  "organizations": [],

  "metadata": {
    "publicIdentifier": "vanshika-goel-sde",
    "profileUrn": "urn:li:fsd_profile:...",
    "objectUrn": "urn:li:member:867694365",
    "memberId": "867694365",
    "trackingId": "e7+jWUziSd2bgiyiHbZPXw==",
    "versionTag": "2377123808",
    "currentCompany": {
      "companyId": "3925",
      "companyUrn": "urn:li:fsd_company:3925",
      "companySlug": "akamai-technologies",
      "companyName": "Akamai Technologies",
      "companyUrl": "https://www.linkedin.com/company/akamai-technologies/",
      "website": null,
      "description": null,
      "tagline": null,
      "industry": "Computer Software",
      "industries": ["Computer Software"],
      "foundedYear": null,
      "headquarter": null,
      "specialties": [],
      "employeeCount": null,
      "employeeCountRange": { "start": 5001, "end": 10000 },
      "followerCount": null,
      "logo": {
        "urn": null,
        "rootUrl": "https://media.licdn.com/...",
        "urls": { "100": "...", "200": "...", "400": "..." },
        "largeUrl": "https://...",
        "smallUrl": "https://..."
      }
    }
  },

  "firstSeenAt":    "2026-08-30T10:00:00.000Z",
  "lastSeenAt":     "2026-08-30T12:00:00.000Z",
  "lastRefreshedAt": "2026-08-30T10:00:00.000Z",
  "refreshCount":   0,

  "createdAt": "2026-08-30T10:00:00.000Z",
  "updatedAt": "2026-08-30T12:00:00.000Z"
}
```

---

## Field Reference

### Top-Level Fields

| Field             | Type     | Description                                              |
|-------------------|----------|----------------------------------------------------------|
| `_id`             | ObjectId | MongoDB document ID                                      |
| `username`        | string   | Canonical lowercase LinkedIn public identifier           |
| `profile`         | object   | Normalized profile data (see below)                      |
| `experience`      | array    | All resolved ProfilePosition entries, newest first       |
| `education`       | array    | All resolved Education entries, newest first             |
| `skills`          | array    | Resolved Skill entities from the skills collection       |
| `projects`        | array    | Resolved Project entities                                |
| `certifications`  | array    | Resolved Certification entities (empty if none)          |
| `languages`       | array    | Resolved Language entities (empty if none)               |
| `courses`         | array    | Resolved Course entities (empty if none)                 |
| `publications`    | array    | Resolved Publication entities (empty if none)            |
| `honors`          | array    | Resolved Honor/Award entities (empty if none)            |
| `volunteerExperience` | array | Resolved VolunteerExperience entities (empty if none)   |
| `patents`         | array    | Resolved Patent entities (empty if none)                 |
| `organizations`   | array    | Resolved Organization entities (empty if none)           |
| `metadata`        | object   | LinkedIn URNs and current company enrichment             |
| `firstSeenAt`     | Date     | When this lead was first created in the database         |
| `lastSeenAt`      | Date     | When this lead was last requested (GET or POST)          |
| `lastRefreshedAt` | Date     | When the profile was last re-fetched from LinkedIn       |
| `refreshCount`    | integer  | Total number of successful LinkedIn refreshes            |
| `createdAt`       | Date     | Mongoose automatic timestamp                             |
| `updatedAt`       | Date     | Mongoose automatic timestamp                             |

### profile.identity

| Field             | Type          | Source                                       |
|-------------------|---------------|----------------------------------------------|
| `entityUrn`       | string / null | `urn:li:fsd_profile:...`                     |
| `objectUrn`       | string / null | `urn:li:member:<numericId>` — contains member ID |
| `publicIdentifier`| string        | Same as `username`                           |
| `fsdProfileId`    | string / null | Alphanumeric ID extracted from entityUrn     |
| `memberId`        | string / null | Numeric LinkedIn member ID from objectUrn    |
| `profileUrl`      | string        | Constructed: `https://www.linkedin.com/in/<username>/` |

### profile.profileStatus

All values reflect actual LinkedIn API fields. `null` means the API
did not provide enough data to determine the value — do NOT default to `false`.

| Field          | Type           | Source                                                    |
|----------------|----------------|-----------------------------------------------------------|
| `openToWork`   | boolean / null | Derived from `profilePicture.frameType === "OPEN_TO_WORK"` |
| `hiring`       | boolean / null | Not present in v1 API response — always null              |
| `premium`      | boolean / null | Direct boolean field on Profile entity                    |
| `premiumBadge` | boolean / null | `showPremiumSubscriberBadge` — display hint only          |
| `creator`      | boolean / null | Direct boolean field on Profile entity                    |
| `influencer`   | boolean / null | Direct boolean field on Profile entity                    |

### profile.relationship

| Field             | Type           | Source                                                   |
|-------------------|----------------|----------------------------------------------------------|
| `connectionDegree`| integer / null | Parsed from `memberDistance` string e.g. `"DISTANCE_3"` → 3 |
| `memberDistance`  | string / null  | Raw value e.g. `"DISTANCE_3"` from MemberRelationship entity |
| `followerCount`   | integer / null | `profile.followingInfo.followerCount`                    |
| `connectionCount` | integer / null | Not present in v1 API response — null                    |

---

## Timestamp Semantics

### New lead (first time username is requested)

```
firstSeenAt    = now
lastSeenAt     = now
lastRefreshedAt = now
refreshCount   = 0
```

### Existing lead (GET /api/leads/:username or POST /api/leads returning from DB)

```
lastSeenAt     = now         ← updated
firstSeenAt    = unchanged
lastRefreshedAt = unchanged
refreshCount   = unchanged
profile data   = unchanged
```

### After successful refresh (POST /api/leads/:username/refresh)

```
lastSeenAt      = now        ← updated
lastRefreshedAt = now        ← updated
refreshCount    += 1         ← incremented
profile data    = replaced with newly parsed profile
experience      = replaced
education       = replaced
skills          = replaced
... all sections replaced
```

If the LinkedIn fetch or parse fails during a refresh:
- Nothing is modified in the database
- The existing stored profile remains intact

---

## Indexes

```js
// Unique index on username — primary lookup key
{ username: 1 }  // unique: true

// Descending index for pagination sorted by lastSeenAt
{ lastSeenAt: -1 }

// Compound text index for search
// Applied to: username, profile.firstName, profile.lastName, profile.headline
{ username: 'text', 'profile.firstName': 'text', 'profile.lastName': 'text', 'profile.headline': 'text' }
```

---

## What Is NOT Stored

The Lead document explicitly does NOT contain:

- Raw LinkedIn Voyager API response JSON
- LinkedIn session cookies (`li_at`, `JSESSIONID`)
- CSRF tokens
- Request headers or authentication metadata
- LinkedIn internal `$recipeTypes` arrays
- LinkedIn `$anti_abuse_metadata` objects
- `multiLocale*` field maps (only the primary locale value is stored)

---

## Notes on Null vs Empty Array

- Arrays that LinkedIn returns as empty (e.g. certifications, languages) are stored as `[]`
- Scalar fields not returned by LinkedIn are stored as `null`
- Never store `undefined` in any field
- Never store the string `"undefined"` or `"null"`

---

## Skills — Pagination Note

The LinkedIn Voyager API returns skills with `paging.total` indicating the full
count, but only returns the first page (20 items) in a single request. The
stored `skills` array reflects what was available in the single API response.
The total declared by LinkedIn (`paging.total`) is not stored — it would be
misleading if the stored array is shorter.
