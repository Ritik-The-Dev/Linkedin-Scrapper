/**
 * test-linkedin-profile.js
 *
 * LinkedIn Voyager API — Production-Quality Profile Parser
 * ---------------------------------------------------------
 * Makes EXACTLY ONE HTTP request, resolves the complete normalized entity
 * graph, and emits a lossless normalized profile object.
 *
 * Usage:
 *   node test-linkedin-profile.js <public-username>
 *   node test-linkedin-profile.js https://www.linkedin.com/in/vanshika-goel-sde/
 *
 * Env vars:
 *   LINKEDIN_LI_AT          (required)
 *   LINKEDIN_JSESSIONID     (required)
 *   LINKEDIN_USER_AGENT     (required)
 *   DEBUG_LINKEDIN=true     (optional) — print section counts to stderr
 *   DEBUG_SAVE_RAW=true     (optional) — write raw-linkedin-response.json
 */

// ---------------------------------------------------------------------------
// .env loader — no third-party packages
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve as resolvePath }                  from 'path';

const envPath = resolvePath(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const raw = trimmed.slice(eqIdx + 1).trim();
    const val = raw.replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Credentials — never printed
// ---------------------------------------------------------------------------
const LI_AT      = process.env.LINKEDIN_LI_AT      || '';
const JSESSIONID = process.env.LINKEDIN_JSESSIONID || '';
const USER_AGENT = process.env.LINKEDIN_USER_AGENT || '';
const CSRF_TOKEN = JSESSIONID.replace(/^"(.*)"$/, '$1');

const DEBUG      = process.env.DEBUG_LINKEDIN === 'true';
const SAVE_RAW   = process.env.DEBUG_SAVE_RAW === 'true';

if (!LI_AT)      { console.error('ERROR: LINKEDIN_LI_AT is not set.');     process.exit(1); }
if (!JSESSIONID) { console.error('ERROR: LINKEDIN_JSESSIONID is not set.'); process.exit(1); }
if (!USER_AGENT) { console.error('ERROR: LINKEDIN_USER_AGENT is not set.'); process.exit(1); }

// ---------------------------------------------------------------------------
// Debug logger — writes to stderr only, never pollutes stdout JSON
// ---------------------------------------------------------------------------
function dbg(msg) {
  if (DEBUG) process.stderr.write(`[debug] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Parse a LinkedIn URL or bare username → public identifier */
function extractPublicIdentifier(input) {
  const m = input.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (m) return m[1].replace(/\/+$/, '');
  return input.trim().replace(/\/+$/, '');
}

/**
 * Extract human-readable text from any LinkedIn text field.
 * Handles: plain string | { text } | { en_US: "..." } | multiLocale maps
 */
function textOf(val) {
  if (val == null)                     return null;
  if (typeof val === 'string')         return val || null;
  if (typeof val.text === 'string')    return val.text || null;
  if (typeof val === 'object') {
    // multiLocale map e.g. { en_US: "foo" }
    const first = Object.values(val)[0];
    if (typeof first === 'string')     return first || null;
  }
  return null;
}

/** Null-safe nested access — returns null, never undefined */
function dig(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[k];
  }
  return cur ?? null;
}

/**
 * Normalize a LinkedIn date object { year?, month?, day? }.
 * Only includes keys that are actually non-null in the source.
 */
function normalizeDate(d) {
  if (!d || typeof d !== 'object') return { year: null, month: null, day: null };
  return {
    year:  d.year  ?? null,
    month: d.month ?? null,
    day:   d.day   ?? null,
  };
}

/** Extract numeric ID from a URN like urn:li:company:12345 */
function numericId(urn) {
  if (!urn) return null;
  const m = urn.match(/:(\d+)$/);
  return m ? m[1] : null;
}

/** Extract fsd_profile alphanumeric ID from urn:li:fsd_profile:ACoXXX */
function fsdProfileId(urn) {
  if (!urn) return null;
  const m = urn.match(/fsd_profile:([^,)]+)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Entity graph index
// ---------------------------------------------------------------------------

/**
 * Build two O(1) lookup maps from included[]:
 *   byUrn  — entityUrn → entity
 *   byType — $type     → entity[]
 */
function buildIndex(included) {
  const byUrn  = new Map();
  const byType = new Map();

  for (const e of included) {
    if (e.entityUrn) byUrn.set(e.entityUrn, e);
    const t = e.$type || '';
    if (t) {
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(e);
    }
  }
  return { byUrn, byType };
}

/** Resolve a URN string to its entity, or null */
function ent(urn, idx) {
  if (!urn || typeof urn !== 'string') return null;
  return idx.byUrn.get(urn) ?? null;
}

/**
 * Resolve a collection reference URN → CollectionResponse entity,
 * then return its *elements array (each element is itself a URN).
 */
function collectionElements(refUrn, idx) {
  if (!refUrn) return [];
  const col = ent(refUrn, idx);
  if (!col) return [];
  // Voyager uses *elements (star-prefixed) for URN arrays
  return Array.isArray(col['*elements']) ? col['*elements'] : [];
}

// ---------------------------------------------------------------------------
// Profile finder
// ---------------------------------------------------------------------------

/**
 * The top-level data object contains a CollectionResponse whose *elements[0]
 * is the profile URN we were querying for.
 */
function findProfile(json, idx) {
  const data = json?.data;
  if (!data) return null;

  // Pattern 1: data.*elements[0]
  if (Array.isArray(data['*elements']) && data['*elements'].length) {
    return ent(data['*elements'][0], idx);
  }

  // Pattern 2: data.<key>.*elements[0]
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val && typeof val === 'object' && Array.isArray(val['*elements']) && val['*elements'].length) {
      return ent(val['*elements'][0], idx);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Image builder — returns { rootUrl, urls: {}, urn }
// ---------------------------------------------------------------------------

/**
 * Build a structured image object from a LinkedIn VectorImage.
 * Returns all available sizes rather than hardcoding the largest.
 *
 * Output:
 *   { urn, rootUrl, urls: { 100: "...", 200: "...", 400: "...", 800: "..." } }
 */
function buildImageUrls(vectorImage) {
  if (!vectorImage) return null;

  const rootUrl   = vectorImage.rootUrl || '';   // may be "" for some logos
  const artifacts = Array.isArray(vectorImage.artifacts) ? vectorImage.artifacts : [];
  const urn       = vectorImage.entityUrn ?? vectorImage.digitalmediaAsset ?? null;

  if (!rootUrl && !artifacts.length) return null;

  const urls = {};
  for (const a of artifacts) {
    const seg = a.fileIdentifyingUrlPathSegment;
    if (!seg) continue;
    const w = a.width ?? a.height;
    if (!w) continue;

    // Two cases LinkedIn uses:
    //   1. rootUrl + relative segment  →  "https://media.licdn.com/.../profile-displayphoto-" + "scale_100_100/..."
    //   2. rootUrl is ""  and segment  is already a full absolute URL
    const isAbsolute = seg.startsWith('http://') || seg.startsWith('https://');
    urls[w] = isAbsolute ? seg : `${rootUrl}${seg}`;
  }

  const sizes    = Object.keys(urls).map(Number).sort((a, b) => b - a);
  const largeUrl = sizes.length ? urls[sizes[0]]                : (rootUrl || null);
  const smallUrl = sizes.length ? urls[sizes[sizes.length - 1]] : null;

  return { urn, rootUrl: rootUrl || null, urls, largeUrl, smallUrl };
}

/**
 * Resolve profile picture from the Profile entity.
 * LinkedIn stores it under profilePicture with two vectorImage paths:
 *   .displayImageReference.vectorImage  — plain square crop
 *   .displayImageWithFrameReferenceUnion.vectorImage  — with frame (e.g. Open To Work ring)
 */
function resolveProfileImage(profile) {
  const pic = profile.profilePicture || profile.picture || null;
  if (!pic) return null;

  // Prefer the plain display image; fall back to the framed version
  const vector =
    dig(pic, 'displayImageReference', 'vectorImage') ||
    dig(pic, 'displayImageWithFrameReferenceUnion', 'vectorImage') ||
    null;

  const result = buildImageUrls(vector);
  if (result) {
    // Also expose the displayImageUrn (digitalmediaAsset URN)
    result.displayImageUrn = pic.displayImageUrn ?? null;
    result.frameType       = pic.frameType       ?? null;  // e.g. "OPEN_TO_WORK"
  }
  return result;
}

/** Resolve background image from the Profile entity */
function resolveBackgroundImage(profile) {
  const bg = profile.backgroundPicture || null;
  if (!bg) return null;

  const vector = dig(bg, 'displayImageReference', 'vectorImage') || null;
  const result = buildImageUrls(vector);
  if (result) result.displayImageUrn = bg.displayImageUrn ?? null;
  return result;
}

// ---------------------------------------------------------------------------
// Location resolver
// ---------------------------------------------------------------------------

/**
 * Profile.geoLocation.*geo → Geo.defaultLocalizedName
 * Also expose country from profile.location.countryCode and
 * the country name from the country Geo entity.
 */
function resolveLocation(profile, idx) {
  const geoUrn =
    dig(profile, 'geoLocation', '*geo') ||
    dig(profile, 'geoLocation', 'geoUrn') ||
    profile['*geo'] ||
    null;

  const geo = ent(geoUrn, idx);

  const locationName =
    textOf(geo?.defaultLocalizedName) ||
    textOf(profile.geoLocationName)   ||
    textOf(profile.locationName)      ||
    null;

  const countryUrn = geo?.countryUrn || null;
  const countryGeo = ent(countryUrn, idx);
  const country    = textOf(countryGeo?.defaultLocalizedName) || null;
  const countryCode = dig(profile, 'location', 'countryCode') || null;

  const withoutCountry = textOf(geo?.defaultLocalizedNameWithoutCountryName) || null;

  return {
    locationName,        // e.g. "Delhi, India"
    city: withoutCountry,// e.g. "Delhi"
    country,             // e.g. "India"
    countryCode,         // e.g. "IN"
    geoUrn,
  };
}

// ---------------------------------------------------------------------------
// Profile status flags
// ---------------------------------------------------------------------------

/**
 * Map actual fields from the Profile entity to our profileStatus object.
 * ONLY expose values that the API actually provides.
 * - premium, influencer, creator: boolean fields directly on profile
 * - openToWork: inferred from profilePicture.frameType === "OPEN_TO_WORK"
 *   (the API does NOT return a standalone isOpenToWork boolean at this level)
 * - hiring: no explicit field found in this response — return null
 */
function resolveProfileStatus(profile) {
  // Direct boolean fields on the Profile entity
  const premium   = typeof profile.premium    === 'boolean' ? profile.premium    : null;
  const influencer = typeof profile.influencer === 'boolean' ? profile.influencer : null;
  const creator   = typeof profile.creator    === 'boolean' ? profile.creator    : null;

  // showPremiumSubscriberBadge is a display hint, not the same as premium
  const premiumBadge = typeof profile.showPremiumSubscriberBadge === 'boolean'
    ? profile.showPremiumSubscriberBadge : null;

  // Open To Work: LinkedIn encodes this via the profile picture frame type
  const frameType = dig(profile, 'profilePicture', 'frameType');
  const openToWork = frameType === 'OPEN_TO_WORK' ? true
    : (frameType != null ? false : null);

  // Hiring: no structured field in this response
  const hiring = null;

  return { openToWork, hiring, premium, premiumBadge, creator, influencer };
}

// ---------------------------------------------------------------------------
// Member ID extractor
// ---------------------------------------------------------------------------

/**
 * The numeric LinkedIn member ID is available in:
 *   profile.objectUrn  →  "urn:li:member:867694365"
 * (NOT inside fsd_profile URN, which is alphanumeric)
 */
function resolveMemberId(profile) {
  if (profile.memberId) return `${profile.memberId}`;

  const objectUrn = profile.objectUrn || null;
  if (objectUrn) {
    const m = objectUrn.match(/member:(\d+)/);
    if (m) return m[1];
  }

  // Older fallback paths
  const memberUrn = dig(profile, 'member', 'entityUrn') || dig(profile, 'miniProfile', 'entityUrn');
  if (memberUrn) {
    const m1 = memberUrn.match(/member:(\d+)/);
    if (m1) return m1[1];
    const m2 = memberUrn.match(/:(\d+)$/);
    if (m2) return m2[1];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Relationship / followers
// ---------------------------------------------------------------------------

function resolveRelationship(profile, idx) {
  const relUrn = profile['*memberRelationship'] || null;
  const rel    = ent(relUrn, idx);

  // The memberDistance value lives at:
  //   rel.memberRelationshipUnion.noConnection.memberDistance  (string e.g. "DISTANCE_3")
  // There is no .value sub-property — it is the string itself.
  const noConn = rel?.memberRelationshipUnion?.noConnection ?? null;
  const memberDistance = noConn?.memberDistance ?? null;   // e.g. "DISTANCE_3"

  // Parse degree number out of "DISTANCE_3" → 3; "DISTANCE_1" → 1 etc.
  let connectionDegree = null;
  if (typeof memberDistance === 'string') {
    const dm = memberDistance.match(/DISTANCE_(\d+)/);
    if (dm) connectionDegree = parseInt(dm[1], 10);
    else if (memberDistance === 'SELF') connectionDegree = 0;
  }

  return {
    connectionDegree,
    memberDistance,                   // raw string "DISTANCE_3"
    followerCount:   profile.followingInfo?.followerCount ?? profile.followerCount ?? null,
    connectionCount: rel?.connectionCount ?? null,
  };
}

// ---------------------------------------------------------------------------
// Company entity builder
// ---------------------------------------------------------------------------

/**
 * Build a structured company object from any Company/MiniCompany entity.
 * Field layout confirmed from raw response:
 *   entityUrn, name, universalName, url (direct LinkedIn URL)
 *   industryUrns: ["urn:li:fsd_industry:4"]   ← array of URN strings
 *   industry: { "*urn:li:fsd_industry:4": "urn:li:fsd_industry:4" }  ← star-key map
 *   employeeCountRange: { start, end }
 *   logo: { vectorImage: { rootUrl, artifacts[] } }
 */
function buildCompany(companyEntity, idx) {
  if (!companyEntity) return null;

  const slug      = companyEntity.universalName || null;
  const companyId = numericId(companyEntity.entityUrn || '');
  // Use the direct url field if present; construct fallback from slug
  const liUrl     = companyEntity.url || (slug ? `https://www.linkedin.com/company/${slug}/` : null);

  // Industries — stored in industryUrns[] (array of URN strings)
  // Resolve each URN to its Industry entity name via idx
  const industries = [];
  if (Array.isArray(companyEntity.industryUrns)) {
    for (const iUrn of companyEntity.industryUrns) {
      const indEnt = idx ? ent(iUrn, idx) : null;
      const label  = indEnt?.name || null;
      if (label) industries.push(label);
    }
  }
  // Fallback: check legacy .industries array if present
  if (industries.length === 0 && Array.isArray(companyEntity.industries)) {
    for (const ind of companyEntity.industries) {
      const label = textOf(ind?.name) || (typeof ind === 'string' ? ind : null);
      if (label) industries.push(label);
    }
  }

  const ecRange = companyEntity.employeeCountRange
    ? { start: companyEntity.employeeCountRange.start ?? null, end: companyEntity.employeeCountRange.end ?? null }
    : null;

  const hq = companyEntity.headquarter
    ? {
        city:    textOf(companyEntity.headquarter.city)    || null,
        country: textOf(companyEntity.headquarter.country) || null,
        line1:   textOf(companyEntity.headquarter.line1)   || null,
      }
    : null;

  // Logo — path is logo.vectorImage (confirmed from raw response)
  const logoVec = dig(companyEntity, 'logo', 'vectorImage');
  const logo    = logoVec ? buildImageUrls(logoVec) : null;

  return {
    companyId,
    companyUrn:  companyEntity.entityUrn || null,
    companySlug: slug,
    companyName: textOf(companyEntity.name) || null,
    companyUrl:  liUrl,
    website:     companyEntity.websiteUrl  || null,
    description: textOf(companyEntity.description) || null,
    tagline:     textOf(companyEntity.tagline)      || null,
    industry:    industries[0]    || null,
    industries,
    foundedYear: companyEntity.foundedOn?.year ?? null,
    headquarter: hq,
    specialties: Array.isArray(companyEntity.specialities)
      ? companyEntity.specialities.map(s => textOf(s) || s).filter(Boolean)
      : [],
    employeeCount:      companyEntity.staffCount ?? null,
    employeeCountRange: ecRange,
    followerCount:      companyEntity.followingInfo?.followerCount ?? null,
    logo,
  };
}

/**
 * Find any Company or MiniCompany entity in the index by numeric company ID.
 */
function findCompany(companyId, idx) {
  if (!companyId) return null;
  for (const [type, entities] of idx.byType.entries()) {
    const tl = type.toLowerCase();
    if (tl.includes('company') || tl.includes('minicompany')) {
      const found = entities.find(e => numericId(e.entityUrn || '') === companyId);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Employment type resolver
// ---------------------------------------------------------------------------

function resolveEmploymentType(pos, idx) {
  const empUrn = pos['*employmentType'] || pos.employmentTypeUrn || null;
  const empEnt = ent(empUrn, idx);
  return empEnt?.name ?? null;
}

// ---------------------------------------------------------------------------
// Experience resolver
// ---------------------------------------------------------------------------

/**
 * Walks the full position graph losslessly:
 *
 *   Profile
 *     *profilePositionGroups → CollectionResponse
 *       *elements            → [ PositionGroup URN, ... ]
 *         *profilePositionInPositionGroup → CollectionResponse
 *           *elements        → [ ProfilePosition URN, ... ]
 *
 * Collects ALL positions. Resolves per-position company entity.
 * Sorts: current (no endDate) first, then newest start date.
 */
function resolveExperience(profile, idx) {
  const posGroupsColUrn = profile['*profilePositionGroups'];
  const pgUrns = collectionElements(posGroupsColUrn, idx);

  dbg(`PositionGroup URNs found: ${pgUrns.length}`);

  const positions = [];

  for (const pgUrn of pgUrns) {
    const pg = ent(pgUrn, idx);
    if (!pg) continue;

    const posUrns = collectionElements(pg['*profilePositionInPositionGroup'], idx);

    for (const posUrn of posUrns) {
      const pos = ent(posUrn, idx);
      if (!pos) continue;

      // ── Company ─────────────────────────────────────────────────────────
      // pos.*company is the primary reference; companyUrn is a direct URN
      const companyRef = pos['*company'] || pos.companyUrn || null;
      const companyEnt = ent(companyRef, idx);
      const cId        = numericId(companyRef || '') || numericId(companyEnt?.entityUrn || '');
      const company    = companyEnt || findCompany(cId, idx);

      const companyId   = numericId(companyRef || '') || null;
      const companyUrn  = companyRef || null;
      const companySlug = company?.universalName || null;
      const companyName = pos.companyName || textOf(company?.name) || null;
      // Use the direct url field from the company entity; fall back to constructing from slug
      const companyUrl  = company?.url || (companySlug ? `https://www.linkedin.com/company/${companySlug}/` : null);

      // Company logo — path is logo.vectorImage (confirmed from raw response)
      const logoVec = dig(company, 'logo', 'vectorImage');
      const companyLogoUrl = logoVec
        ? (buildImageUrls(logoVec)?.largeUrl ?? null)
        : null;

      // Company industry — resolve from industryUrns[]
      const companyIndustryUrns = Array.isArray(company?.industryUrns) ? company.industryUrns : [];
      const companyIndustry = companyIndustryUrns.length
        ? (ent(companyIndustryUrns[0], idx)?.name ?? null)
        : null;

      // ── Dates ────────────────────────────────────────────────────────────
      const startDate = normalizeDate(pos.dateRange?.start ?? null);
      const endDate   = normalizeDate(pos.dateRange?.end   ?? null);
      const current   = !endDate.year && !endDate.month;

      // ── Location ─────────────────────────────────────────────────────────
      // Positions use *geo (not *geoLocation) based on the actual response
      const geoRef  = pos['*geo'] || pos.geoUrn || null;
      const geoEnt  = ent(geoRef, idx);
      const location =
        textOf(geoEnt?.defaultLocalizedName) ||
        pos.locationName                     ||
        pos.geoLocationName                  ||
        null;

      positions.push({
        entityUrn:    pos.entityUrn        || null,
        positionUrn:  pos.entityUrn        || null,
        title:        pos.title            || null,
        companyName,
        companyId,
        companyUrn,
        companySlug,
        companyUrl,
        companyLogoUrl,
        companyIndustry,
        employmentType:     resolveEmploymentType(pos, idx),
        employmentTypeUrn:  pos.employmentTypeUrn || null,
        location,
        startDate,
        endDate,
        current,
        description:  pos.description      || null,
        shouldShowSourceOfHireBadge: pos.shouldShowSourceOfHireBadge ?? null,
        // sort keys — stripped after sorting
        _sy: startDate.year  ?? 0,
        _sm: startDate.month ?? 0,
        _cur: current,
      });
    }
  }

  dbg(`ProfilePosition entities resolved: ${positions.length}`);

  // Sort: current first, then newest start year → month
  positions.sort((a, b) => {
    if (a._cur !== b._cur) return a._cur ? -1 : 1;
    if (b._sy  !== a._sy)  return b._sy  - a._sy;
    return b._sm - a._sm;
  });

  return positions.map(({ _sy, _sm, _cur, ...p }) => p);
}

// ---------------------------------------------------------------------------
// Education resolver
// ---------------------------------------------------------------------------

/**
 * Profile
 *   *profileEducations → CollectionResponse
 *     *elements        → [ ProfileEducation URN, ... ]
 *
 * Fields confirmed in raw response:
 *   schoolName, degreeName, degreeUrn, fieldOfStudy, standardizedFieldOfStudyUrn,
 *   grade, activities, description, dateRange, schoolUrn, companyUrn, *school, *degree
 */
function resolveEducation(profile, idx) {
  const eduUrns = collectionElements(profile['*profileEducations'], idx);
  dbg(`Education URNs found: ${eduUrns.length}`);

  const entries = [];

  for (const urn of eduUrns) {
    const edu = ent(urn, idx);
    if (!edu) continue;

    // School entity — *school points to a School entity; companyUrn to a Company entity (MiniCompany)
    const schoolRef = edu['*school'] || null;
    const schoolEnt = ent(schoolRef, idx);                   // School $type entity
    const schoolCompanyUrn = edu.companyUrn || null;
    const schoolCompanyEnt = ent(schoolCompanyUrn, idx);     // Company $type entity (MiniCompany)

    const schoolId   = numericId(schoolRef || '') || numericId(schoolCompanyUrn || '') || null;
    const schoolUrn  = schoolRef || schoolCompanyUrn || null;
    const schoolSlug = schoolEnt?.universalName || schoolCompanyEnt?.universalName || null;
    const schoolName = edu.schoolName
                    || textOf(schoolEnt?.name)
                    || textOf(schoolCompanyEnt?.name)
                    || null;

    // Use the direct url from the School entity (confirmed: fsd_school:40706 has url field)
    const schoolUrl  = schoolEnt?.url
                    || schoolCompanyEnt?.url
                    || (schoolSlug ? `https://www.linkedin.com/school/${schoolSlug}/` : null);

    // Resolve school logo from School entity or Company entity
    const schoolLogoVec = dig(schoolEnt, 'logo', 'vectorImage')
                       || dig(schoolCompanyEnt, 'logo', 'vectorImage')
                       || null;
    const schoolLogo = schoolLogoVec ? buildImageUrls(schoolLogoVec) : null;

    const startDate = normalizeDate(edu.dateRange?.start ?? null);
    const endDate   = normalizeDate(edu.dateRange?.end   ?? null);

    entries.push({
      entityUrn:    edu.entityUrn    || null,
      schoolName,
      schoolId,
      schoolUrn,
      schoolSlug,
      schoolUrl,
      schoolLogo,
      degree:       edu.degreeName   || null,
      degreeUrn:    edu.degreeUrn    || null,
      fieldOfStudy: edu.fieldOfStudy || null,
      standardizedFieldOfStudyUrn: edu.standardizedFieldOfStudyUrn || null,
      grade:        edu.grade        || null,
      activities:   edu.activities   || null,
      description:  edu.description  || null,
      startDate,
      endDate,
      _sy: startDate.year  ?? 0,
      _sm: startDate.month ?? 0,
    });
  }

  dbg(`Education entries resolved: ${entries.length}`);

  entries.sort((a, b) => {
    if (b._sy !== a._sy) return b._sy - a._sy;
    return b._sm - a._sm;
  });

  return entries.map(({ _sy, _sm, ...e }) => e);
}

// ---------------------------------------------------------------------------
// Skills resolver
// ---------------------------------------------------------------------------

/**
 * Profile.*profileSkills → CollectionResponse → fsd_skill entities
 *
 * Each Skill entity in the raw response has: entityUrn, name, multiLocaleName
 * The collection paging.total is 35 but only 20 are returned in one page.
 * We extract only what is in included[].
 */
function resolveSkills(profile, idx) {
  // Try all known keys that LinkedIn may use for skill collections
  const skillCollectionKeys = [
    '*profileSkills',
    '*profileTopSkills',
    '*profileSkillOrganizationView',
    '*skills',
  ];

  const seen  = new Set();
  const skills = [];

  for (const key of skillCollectionKeys) {
    const refUrn = profile[key];
    if (!refUrn) continue;

    const skillUrns = collectionElements(refUrn, idx);
    for (const sUrn of skillUrns) {
      if (seen.has(sUrn)) continue;
      seen.add(sUrn);

      const skillEnt = ent(sUrn, idx);
      if (!skillEnt) continue;

      const name = skillEnt.name || textOf(skillEnt.multiLocaleName) || null;
      if (!name) continue;

      skills.push({
        entityUrn: skillEnt.entityUrn || sUrn,
        name,
      });
    }
  }

  // Fallback: scan included[] for any Skill-typed entity not yet captured
  if (skills.length === 0) {
    for (const [type, entities] of idx.byType.entries()) {
      if (type.toLowerCase().includes('skill')) {
        for (const e of entities) {
          if (seen.has(e.entityUrn)) continue;
          const name = e.name || textOf(e.multiLocaleName) || null;
          if (name) skills.push({ entityUrn: e.entityUrn || null, name });
        }
      }
    }
  }

  dbg(`Skills resolved: ${skills.length}`);
  return skills;
}

// ---------------------------------------------------------------------------
// Projects resolver
// ---------------------------------------------------------------------------

/**
 * Profile.*profileProjects → CollectionResponse → Project entities
 *
 * Fields confirmed in raw response:
 *   title, description, url, dateRange, contributors[].standardizedContributor.*profile
 */
function resolveProjects(profile, idx) {
  const projUrns = collectionElements(profile['*profileProjects'], idx);
  dbg(`Project URNs found: ${projUrns.length}`);

  return projUrns.map(urn => {
    const p = ent(urn, idx);
    if (!p) return null;

    const startDate = normalizeDate(p.dateRange?.start ?? null);
    const endDate   = normalizeDate(p.dateRange?.end   ?? null);

    // Extract contributor profile URNs
    const contributors = [];
    if (Array.isArray(p.contributors)) {
      for (const c of p.contributors) {
        const pUrn = dig(c, 'standardizedContributor', '*profile')
                  || dig(c, 'standardizedContributor', 'profileUrn')
                  || null;
        if (pUrn) contributors.push(pUrn);
      }
    }

    return {
      entityUrn:    p.entityUrn    || null,
      title:        p.title        || null,
      description:  p.description  || null,
      url:          p.url          || null,
      startDate,
      endDate,
      contributors,
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Certifications resolver
// ---------------------------------------------------------------------------

function resolveCertifications(profile, idx) {
  const urns = collectionElements(profile['*profileCertifications'], idx);
  dbg(`Certification URNs found: ${urns.length}`);

  return urns.map(urn => {
    const c = ent(urn, idx);
    if (!c) return null;
    return {
      entityUrn:    c.entityUrn       || null,
      name:         c.name            || null,
      authority:    c.authority       || null,
      licenseNumber: c.licenseNumber  || null,
      url:          c.url             || null,
      issueDate:    normalizeDate(c.timePeriod?.startDate ?? null),
      expirationDate: normalizeDate(c.timePeriod?.endDate ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Languages resolver
// ---------------------------------------------------------------------------

function resolveLanguages(profile, idx) {
  const urns = collectionElements(profile['*profileLanguages'], idx);
  dbg(`Language URNs found: ${urns.length}`);

  return urns.map(urn => {
    const l = ent(urn, idx);
    if (!l) return null;
    return {
      entityUrn:   l.entityUrn   || null,
      name:        l.name        || null,
      proficiency: l.proficiency || null,
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Courses resolver
// ---------------------------------------------------------------------------

function resolveCourses(profile, idx) {
  const urns = collectionElements(profile['*profileCourses'], idx);
  dbg(`Course URNs found: ${urns.length}`);

  return urns.map(urn => {
    const c = ent(urn, idx);
    if (!c) return null;
    return {
      entityUrn: c.entityUrn || null,
      name:      c.name      || null,
      number:    c.number    || null,
      occupationUnion: c.occupationUnion || null,
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Publications resolver
// ---------------------------------------------------------------------------

function resolvePublications(profile, idx) {
  const urns = collectionElements(profile['*profilePublications'], idx);
  dbg(`Publication URNs found: ${urns.length}`);

  return urns.map(urn => {
    const p = ent(urn, idx);
    if (!p) return null;
    return {
      entityUrn:   p.entityUrn   || null,
      name:        p.name        || null,
      publisher:   p.publisher   || null,
      description: p.description || null,
      url:         p.url         || null,
      date:        normalizeDate(p.date ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Honors / Awards resolver
// ---------------------------------------------------------------------------

function resolveHonors(profile, idx) {
  const urns = collectionElements(profile['*profileHonors'], idx);
  dbg(`Honor URNs found: ${urns.length}`);

  return urns.map(urn => {
    const h = ent(urn, idx);
    if (!h) return null;
    return {
      entityUrn:   h.entityUrn   || null,
      title:       h.title       || null,
      issuer:      h.issuer      || null,
      description: h.description || null,
      issueDate:   normalizeDate(h.issueDate ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Volunteer Experience resolver
// ---------------------------------------------------------------------------

function resolveVolunteerExperience(profile, idx) {
  const urns = collectionElements(profile['*profileVolunteerExperiences'], idx);
  dbg(`Volunteer experience URNs found: ${urns.length}`);

  return urns.map(urn => {
    const v = ent(urn, idx);
    if (!v) return null;
    return {
      entityUrn:    v.entityUrn    || null,
      role:         v.role         || null,
      organization: v.companyName  || null,
      cause:        v.cause        || null,
      description:  v.description  || null,
      startDate:    normalizeDate(v.dateRange?.start ?? null),
      endDate:      normalizeDate(v.dateRange?.end   ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Patents resolver
// ---------------------------------------------------------------------------

function resolvePatents(profile, idx) {
  const urns = collectionElements(profile['*profilePatents'], idx);
  dbg(`Patent URNs found: ${urns.length}`);

  return urns.map(urn => {
    const p = ent(urn, idx);
    if (!p) return null;
    return {
      entityUrn:   p.entityUrn   || null,
      title:       p.title       || null,
      issuer:      p.issuer      || null,
      number:      p.number      || null,
      description: p.description || null,
      url:         p.url         || null,
      date:        normalizeDate(p.date ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Organizations resolver
// ---------------------------------------------------------------------------

function resolveOrganizations(profile, idx) {
  const urns = collectionElements(profile['*profileOrganizations'], idx);
  dbg(`Organization URNs found: ${urns.length}`);

  return urns.map(urn => {
    const o = ent(urn, idx);
    if (!o) return null;
    return {
      entityUrn:   o.entityUrn   || null,
      name:        o.name        || null,
      position:    o.position    || null,
      description: o.description || null,
      startDate:   normalizeDate(o.dateRange?.start ?? null),
      endDate:     normalizeDate(o.dateRange?.end   ?? null),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Industry resolver
// ---------------------------------------------------------------------------

function resolveIndustry(profile, idx) {
  const indUrn = profile['*industry'] || profile.industryUrn || null;
  const indEnt = ent(indUrn, idx);
  return {
    industryUrn:  indUrn              || null,
    industryName: indEnt?.name        || null,
  };
}

// ---------------------------------------------------------------------------
// Pronouns
// ---------------------------------------------------------------------------

function resolvePronouns(profile) {
  const p = profile.pronounUnion || null;
  if (!p) return null;
  return p.standardizedPronoun || p.customPronoun || null;
}

// ---------------------------------------------------------------------------
// Main normalizer
// ---------------------------------------------------------------------------

function normalizeProfile(json, publicIdentifier) {
  const included = Array.isArray(json.included) ? json.included : [];
  const idx      = buildIndex(included);

  dbg(`included[] entity count: ${included.length}`);

  const profile = findProfile(json, idx);
  if (!profile) {
    return { error: 'Could not resolve profile entity from response.' };
  }

  // ── Identity ─────────────────────────────────────────────────────────────
  const entityUrn       = profile.entityUrn       || null;
  const objectUrn       = profile.objectUrn       || null;
  const profileSlug     = profile.publicIdentifier || publicIdentifier;
  const profileFsdId    = fsdProfileId(entityUrn);
  const memberId        = resolveMemberId(profile);
  const profileUrl      = `https://www.linkedin.com/in/${profileSlug}/`;

  // ── Sections ─────────────────────────────────────────────────────────────
  const experience        = resolveExperience(profile, idx);
  const education         = resolveEducation(profile, idx);
  const skills            = resolveSkills(profile, idx);
  const projects          = resolveProjects(profile, idx);
  const certifications    = resolveCertifications(profile, idx);
  const languages         = resolveLanguages(profile, idx);
  const courses           = resolveCourses(profile, idx);
  const publications      = resolvePublications(profile, idx);
  const honors            = resolveHonors(profile, idx);
  const volunteerExperience = resolveVolunteerExperience(profile, idx);
  const patents           = resolvePatents(profile, idx);
  const organizations     = resolveOrganizations(profile, idx);

  dbg(`Experience  : ${experience.length}`);
  dbg(`Education   : ${education.length}`);
  dbg(`Skills      : ${skills.length}`);
  dbg(`Projects    : ${projects.length}`);
  dbg(`Certs       : ${certifications.length}`);
  dbg(`Languages   : ${languages.length}`);
  dbg(`Courses     : ${courses.length}`);
  dbg(`Publications: ${publications.length}`);
  dbg(`Honors      : ${honors.length}`);
  dbg(`Volunteer   : ${volunteerExperience.length}`);
  dbg(`Patents     : ${patents.length}`);
  dbg(`Orgs        : ${organizations.length}`);

  // ── Current company from first experience entry ───────────────────────
  const currentPos = experience[0] || null;
  const currentCompanyEnt = currentPos?.companyUrn
    ? (ent(currentPos.companyUrn, idx) || findCompany(currentPos.companyId, idx))
    : null;

  return {
    profile: {
      identity: {
        entityUrn,
        objectUrn,
        publicIdentifier: profileSlug,
        fsdProfileId:     profileFsdId,
        memberId,
        profileUrl,
      },
      firstName:   profile.firstName   || null,
      lastName:    profile.lastName    || null,
      fullName:    (profile.firstName && profile.lastName)
                    ? `${profile.firstName} ${profile.lastName}`
                    : (profile.firstName || profile.lastName || null),
      pronouns:    resolvePronouns(profile),
      headline:    profile.headline    || null,
      summary:     profile.summary     || null,
      occupation:  profile.occupation  || null,
      location:    resolveLocation(profile, idx),
      industry:    resolveIndustry(profile, idx),
      media: {
        profileImage:    resolveProfileImage(profile),
        backgroundImage: resolveBackgroundImage(profile),
      },
      profileStatus: resolveProfileStatus(profile),
      relationship:  resolveRelationship(profile, idx),
    },
    experience,
    education,
    skills,
    projects,
    certifications,
    languages,
    courses,
    publications,
    honors,
    volunteerExperience,
    patents,
    organizations,
    metadata: {
      publicIdentifier: profileSlug,
      profileUrn:       entityUrn,
      objectUrn,
      memberId,
      trackingId:       profile.trackingId     || null,
      versionTag:       profile.versionTag     || null,
      currentCompany:   buildCompany(currentCompanyEnt, idx),
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP request — auth/headers/endpoint UNCHANGED
// ---------------------------------------------------------------------------

async function fetchProfile(publicIdentifier) {
  const params = new URLSearchParams({
    q:              'memberIdentity',
    memberIdentity: publicIdentifier,
    decorationId:   'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101',
  });

  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?${params.toString()}`;

  let res;
  try {
    res = await fetch(url, {
      method:   'GET',
      redirect: 'manual',
      headers: {
        'accept':                    'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token':                CSRF_TOKEN,
        'x-restli-protocol-version': '2.0.0',
        'user-agent':                USER_AGENT,
        'cookie':                    `li_at=${LI_AT}; JSESSIONID="${JSESSIONID}"`,
      },
    });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  if (res.status === 302 || res.status === 303) {
    console.error(`ERROR: LinkedIn redirected (${res.status}). Session may be invalid.`);
    process.exit(1);
  }
  if (res.status === 401) { console.error('ERROR: 401 Unauthorized.');           process.exit(1); }
  if (res.status === 403) { console.error('ERROR: 403 Forbidden.');              process.exit(1); }
  if (res.status === 429) { console.error('ERROR: 429 Rate limited. Stop now.'); process.exit(1); }
  if (res.status !== 200) { console.error(`ERROR: HTTP ${res.status}.`);         process.exit(1); }

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    console.error('ERROR: HTTP 200 but response is not valid JSON.');
    process.exit(1);
  }

  // Only write raw file when DEBUG_SAVE_RAW=true
  if (SAVE_RAW) {
    writeFileSync('./raw-linkedin-response.json', JSON.stringify(parsed, null, 2), 'utf8');
    process.stderr.write('[debug] Raw response saved to raw-linkedin-response.json\n');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Verification report (to stderr — never pollutes stdout JSON)
// ---------------------------------------------------------------------------

function printVerification(result) {
  const p  = result.profile;
  const id = p.identity;

  process.stderr.write('\n==================================================\n');
  process.stderr.write('PARSER VERIFICATION\n');
  process.stderr.write('==================================================\n');
  process.stderr.write(`Name              : ${p.firstName} ${p.lastName}\n`);
  process.stderr.write(`Public identifier : ${id.publicIdentifier}\n`);
  process.stderr.write(`Member ID         : ${id.memberId}\n`);
  process.stderr.write(`fsd_profile ID    : ${id.fsdProfileId}\n`);
  process.stderr.write(`Headline          : ${p.headline}\n`);
  process.stderr.write(`Location          : ${p.location?.locationName}\n`);
  process.stderr.write(`Country code      : ${p.location?.countryCode}\n`);
  process.stderr.write(`Pronouns          : ${p.pronouns}\n`);
  process.stderr.write(`Industry          : ${p.industry?.industryName}\n`);
  process.stderr.write(`Profile image     : ${p.media.profileImage?.largeUrl ?? 'null'}\n`);
  process.stderr.write(`Frame type        : ${p.media.profileImage?.frameType ?? 'null'}\n`);
  process.stderr.write(`Background image  : ${p.media.backgroundImage?.largeUrl ?? 'null'}\n`);
  process.stderr.write('\nProfile Status:\n');
  process.stderr.write(`  openToWork  : ${p.profileStatus.openToWork}\n`);
  process.stderr.write(`  hiring      : ${p.profileStatus.hiring}\n`);
  process.stderr.write(`  premium     : ${p.profileStatus.premium}\n`);
  process.stderr.write(`  creator     : ${p.profileStatus.creator}\n`);
  process.stderr.write(`  influencer  : ${p.profileStatus.influencer}\n`);
  process.stderr.write('\nRelationship:\n');
  process.stderr.write(`  followerCount  : ${p.relationship.followerCount}\n`);
  process.stderr.write(`  connectionDeg  : ${p.relationship.connectionDegree}\n`);

  process.stderr.write(`\nExperience count  : ${result.experience.length}\n`);
  for (let i = 0; i < result.experience.length; i++) {
    const e = result.experience[i];
    process.stderr.write(`  ${i + 1}. ${e.title} @ ${e.companyName} [${e.employmentType ?? '?'}] ${e.current ? '(current)' : ''}\n`);
  }

  process.stderr.write(`\nEducation count   : ${result.education.length}\n`);
  for (let i = 0; i < result.education.length; i++) {
    const e = result.education[i];
    process.stderr.write(`  ${i + 1}. ${e.schoolName} — ${e.degree ?? 'no degree'} (grade: ${e.grade ?? 'n/a'})\n`);
  }

  process.stderr.write(`\nSkills count      : ${result.skills.length}\n`);
  process.stderr.write(`  ${result.skills.map(s => s.name).join(', ')}\n`);

  process.stderr.write(`\nProjects count    : ${result.projects.length}\n`);
  for (const pr of result.projects) process.stderr.write(`  - ${pr.title}\n`);

  process.stderr.write(`\nCertifications    : ${result.certifications.length}\n`);
  process.stderr.write(`Languages         : ${result.languages.length}\n`);
  process.stderr.write(`Courses           : ${result.courses.length}\n`);
  process.stderr.write(`Publications      : ${result.publications.length}\n`);
  process.stderr.write(`Honors            : ${result.honors.length}\n`);
  process.stderr.write(`Volunteer exp     : ${result.volunteerExperience.length}\n`);
  process.stderr.write(`Patents           : ${result.patents.length}\n`);
  process.stderr.write(`Organizations     : ${result.organizations.length}\n`);
  process.stderr.write('==================================================\n\n');
}

// ---------------------------------------------------------------------------
// Entry point — can also run against saved raw response (no network call)
// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node test-linkedin-profile.js <linkedin-url-or-username>');
    process.exit(1);
  }

  const publicIdentifier = extractPublicIdentifier(arg);

  // If a saved raw response exists and we are in local-test mode, use it
  const localRaw = resolvePath(process.cwd(), 'raw-linkedin-response.json');
  let json;

  if (process.env.USE_LOCAL_RAW === 'true' && existsSync(localRaw)) {
    process.stderr.write('[info] Using local raw-linkedin-response.json\n');
    json = JSON.parse(readFileSync(localRaw, 'utf8'));
  } else {
    json = await fetchProfile(publicIdentifier);
  }

  const result = normalizeProfile(json, publicIdentifier);

  // Always print verification report to stderr
  printVerification(result);

  // stdout: clean JSON only
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});
