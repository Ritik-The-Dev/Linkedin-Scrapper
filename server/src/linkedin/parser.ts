/**
 * src/linkedin/parser.ts
 *
 * LinkedIn Voyager entity graph → normalized profile object.
 * Pure function — no I/O, no side effects, no credentials.
 */

import type {
  ParsedLinkedInProfile,
  NormalizedProfile,
  ProfileIdentity,
  ProfileLocation,
  ProfileIndustry,
  ProfileMedia,
  ProfileStatus,
  ProfileRelationship,
  ExperienceEntry,
  EducationEntry,
  SkillEntry,
  ProjectEntry,
  CertificationEntry,
  LanguageEntry,
  CourseEntry,
  PublicationEntry,
  HonorEntry,
  VolunteerEntry,
  PatentEntry,
  OrganizationEntry,
  CompanyObject,
  ProfileMetadata,
  ImageUrls,
  DatePart,
} from '../types.js';

// ---------------------------------------------------------------------------
// Internal graph types
// ---------------------------------------------------------------------------

type Entity = Record<string, unknown>;
type VoyagerJson = Record<string, unknown>;

interface EntityIndex {
  byUrn:  Map<string, Entity>;
  byType: Map<string, Entity[]>;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function textOf(val: unknown): string | null {
  if (val == null)                return null;
  if (typeof val === 'string')    return val || null;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj['text'] === 'string') return obj['text'] || null;
    const first = Object.values(obj)[0];
    if (typeof first === 'string') return first || null;
  }
  return null;
}

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur ?? null;
}

function normalizeDate(d: unknown): DatePart {
  if (!d || typeof d !== 'object') return { year: null, month: null, day: null };
  const obj = d as Record<string, unknown>;
  return {
    year:  typeof obj['year']  === 'number' ? obj['year']  : null,
    month: typeof obj['month'] === 'number' ? obj['month'] : null,
    day:   typeof obj['day']   === 'number' ? obj['day']   : null,
  };
}

function numericId(urn: string | null | undefined): string | null {
  if (!urn) return null;
  const m = urn.match(/:(\d+)$/);
  return m ? m[1]! : null;
}

function fsdProfileId(urn: string | null | undefined): string | null {
  if (!urn) return null;
  const m = urn.match(/fsd_profile:([^,)]+)/);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------------------
// Entity index
// ---------------------------------------------------------------------------

function buildIndex(included: unknown[]): EntityIndex {
  const byUrn  = new Map<string, Entity>();
  const byType = new Map<string, Entity[]>();

  for (const e of included) {
    if (!e || typeof e !== 'object') continue;
    const entity = e as Entity;
    const urn    = entity['entityUrn'];
    if (typeof urn === 'string') byUrn.set(urn, entity);
    const t = typeof entity['$type'] === 'string' ? entity['$type'] as string : '';
    if (t) {
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(entity);
    }
  }

  return { byUrn, byType };
}

function ent(urn: unknown, idx: EntityIndex): Entity | null {
  if (!urn || typeof urn !== 'string') return null;
  return idx.byUrn.get(urn) ?? null;
}

function collectionElements(refUrn: unknown, idx: EntityIndex): string[] {
  if (!refUrn || typeof refUrn !== 'string') return [];
  const col = idx.byUrn.get(refUrn);
  if (!col) return [];
  const els = col['*elements'];
  return Array.isArray(els) ? els.filter((x): x is string => typeof x === 'string') : [];
}

// ---------------------------------------------------------------------------
// Profile finder
// ---------------------------------------------------------------------------

function findProfile(json: VoyagerJson, idx: EntityIndex): Entity | null {
  const data = json['data'];
  if (!data || typeof data !== 'object') return null;
  const dataObj = data as Record<string, unknown>;

  const direct = dataObj['*elements'];
  if (Array.isArray(direct) && direct.length > 0) {
    return ent(direct[0], idx);
  }

  for (const key of Object.keys(dataObj)) {
    const val = dataObj[key];
    if (val && typeof val === 'object') {
      const nested = (val as Record<string, unknown>)['*elements'];
      if (Array.isArray(nested) && nested.length > 0) {
        return ent(nested[0], idx);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Image builder
// ---------------------------------------------------------------------------

function buildImageUrls(vectorImage: Entity): ImageUrls | null {
  const rootUrl   = typeof vectorImage['rootUrl'] === 'string' ? vectorImage['rootUrl'] : '';
  const artifacts = Array.isArray(vectorImage['artifacts']) ? vectorImage['artifacts'] : [];
  const urnVal    = vectorImage['entityUrn'] ?? vectorImage['digitalmediaAsset'];
  const urnStr    = typeof urnVal === 'string' ? urnVal : null;

  if (!rootUrl && artifacts.length === 0) return null;

  const urls: Record<number, string> = {};
  for (const a of artifacts) {
    if (!a || typeof a !== 'object') continue;
    const art = a as Record<string, unknown>;
    const seg = typeof art['fileIdentifyingUrlPathSegment'] === 'string' ? art['fileIdentifyingUrlPathSegment'] : null;
    if (!seg) continue;
    const w = typeof art['width'] === 'number' ? art['width'] : (typeof art['height'] === 'number' ? art['height'] : null);
    if (!w) continue;
    const isAbsolute = seg.startsWith('http://') || seg.startsWith('https://');
    urls[w] = isAbsolute ? seg : `${rootUrl}${seg}`;
  }

  const sizes    = Object.keys(urls).map(Number).sort((a, b) => b - a);
  const largeUrl = sizes.length > 0 ? urls[sizes[0]!]!                  : (rootUrl || null);
  const smallUrl = sizes.length > 0 ? urls[sizes[sizes.length - 1]!]!   : null;

  return { urn: urnStr, rootUrl: rootUrl || null, urls, largeUrl, smallUrl };
}

function resolveProfileImage(profile: Entity): ImageUrls | null {
  const pic = profile['profilePicture'] ?? profile['picture'];
  if (!pic || typeof pic !== 'object') return null;
  const picObj = pic as Record<string, unknown>;

  const vectorRaw =
    dig(picObj, 'displayImageReference', 'vectorImage') ??
    dig(picObj, 'displayImageWithFrameReferenceUnion', 'vectorImage') ??
    null;

  const vector = vectorRaw && typeof vectorRaw === 'object' ? vectorRaw as Entity : null;
  const result = vector ? buildImageUrls(vector) : null;

  if (result) {
    result.displayImageUrn = typeof picObj['displayImageUrn'] === 'string' ? picObj['displayImageUrn'] : null;
    result.frameType       = typeof picObj['frameType']       === 'string' ? picObj['frameType']       : null;
  }
  return result;
}

function resolveBackgroundImage(profile: Entity): ImageUrls | null {
  const bg = profile['backgroundPicture'];
  if (!bg || typeof bg !== 'object') return null;
  const bgObj   = bg as Record<string, unknown>;
  const vecRaw  = dig(bgObj, 'displayImageReference', 'vectorImage');
  const vector  = vecRaw && typeof vecRaw === 'object' ? vecRaw as Entity : null;
  const result  = vector ? buildImageUrls(vector) : null;
  if (result) result.displayImageUrn = typeof bgObj['displayImageUrn'] === 'string' ? bgObj['displayImageUrn'] : null;
  return result;
}

// ---------------------------------------------------------------------------
// Sub-resolvers
// ---------------------------------------------------------------------------

function resolveLocation(profile: Entity, idx: EntityIndex): ProfileLocation {
  const geoUrn =
    (dig(profile, 'geoLocation', '*geo') as string | null) ??
    (dig(profile, 'geoLocation', 'geoUrn') as string | null) ??
    (profile['*geo'] as string | null) ??
    null;

  const geo        = ent(geoUrn, idx);
  const countryUrn = typeof geo?.['countryUrn'] === 'string' ? geo['countryUrn'] : null;
  const countryGeo = ent(countryUrn, idx);

  return {
    locationName: textOf(geo?.['defaultLocalizedName']) ?? textOf(profile['geoLocationName']) ?? textOf(profile['locationName']) ?? null,
    city:         textOf(geo?.['defaultLocalizedNameWithoutCountryName']) ?? null,
    country:      textOf(countryGeo?.['defaultLocalizedName']) ?? null,
    countryCode:  (dig(profile, 'location', 'countryCode') as string | null) ?? null,
    geoUrn,
  };
}

function resolveProfileStatus(profile: Entity): ProfileStatus {
  const premium      = typeof profile['premium']    === 'boolean' ? profile['premium']    : null;
  const influencer   = typeof profile['influencer'] === 'boolean' ? profile['influencer'] : null;
  const creator      = typeof profile['creator']    === 'boolean' ? profile['creator']    : null;
  const premiumBadge = typeof profile['showPremiumSubscriberBadge'] === 'boolean' ? profile['showPremiumSubscriberBadge'] : null;
  const frameType    = dig(profile, 'profilePicture', 'frameType');
  const openToWork   = frameType === 'OPEN_TO_WORK' ? true : (frameType != null ? false : null);
  return { openToWork, hiring: null, premium, premiumBadge, creator, influencer };
}

function resolveMemberId(profile: Entity): string | null {
  if (typeof profile['memberId'] === 'string') return profile['memberId'];
  if (typeof profile['memberId'] === 'number') return String(profile['memberId']);

  const objUrn = typeof profile['objectUrn'] === 'string' ? profile['objectUrn'] : null;
  if (objUrn) {
    const m = objUrn.match(/member:(\d+)/);
    if (m) return m[1]!;
  }

  const memberUrn = (dig(profile, 'member', 'entityUrn') as string | null)
                 ?? (dig(profile, 'miniProfile', 'entityUrn') as string | null);
  if (memberUrn) {
    const m1 = memberUrn.match(/member:(\d+)/);
    if (m1) return m1[1]!;
    const m2 = memberUrn.match(/:(\d+)$/);
    if (m2) return m2[1]!;
  }

  return null;
}

function resolveRelationship(profile: Entity, idx: EntityIndex): ProfileRelationship {
  const relUrn = typeof profile['*memberRelationship'] === 'string' ? profile['*memberRelationship'] : null;
  const rel    = ent(relUrn, idx);
  const noConn = (dig(rel, 'memberRelationshipUnion', 'noConnection') as Record<string, unknown> | null) ?? null;
  const memberDistance = typeof noConn?.['memberDistance'] === 'string' ? noConn['memberDistance'] : null;

  let connectionDegree: number | null = null;
  if (memberDistance) {
    const dm = memberDistance.match(/DISTANCE_(\d+)/);
    if (dm) connectionDegree = parseInt(dm[1]!, 10);
    else if (memberDistance === 'SELF') connectionDegree = 0;
  }

  const followerCount =
    typeof (dig(profile, 'followingInfo', 'followerCount')) === 'number'
      ? (dig(profile, 'followingInfo', 'followerCount') as number)
      : typeof profile['followerCount'] === 'number'
        ? profile['followerCount']
        : null;

  return {
    connectionDegree,
    memberDistance,
    followerCount,
    connectionCount: typeof rel?.['connectionCount'] === 'number' ? rel['connectionCount'] : null,
  };
}

function resolveIndustry(profile: Entity, idx: EntityIndex): ProfileIndustry {
  const indUrn = (profile['*industry'] as string | null) ?? (profile['industryUrn'] as string | null) ?? null;
  const indEnt = ent(indUrn, idx);
  return {
    industryUrn:  indUrn,
    industryName: typeof indEnt?.['name'] === 'string' ? indEnt['name'] : null,
  };
}

function resolvePronouns(profile: Entity): string | null {
  const p = profile['pronounUnion'];
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  return (typeof obj['standardizedPronoun'] === 'string' ? obj['standardizedPronoun'] : null)
      ?? (typeof obj['customPronoun']        === 'string' ? obj['customPronoun']        : null);
}

// ---------------------------------------------------------------------------
// Company builder
// ---------------------------------------------------------------------------

function buildCompany(companyEntity: Entity | null, idx: EntityIndex): CompanyObject | null {
  if (!companyEntity) return null;

  const slug      = typeof companyEntity['universalName'] === 'string' ? companyEntity['universalName'] : null;
  const companyId = numericId(typeof companyEntity['entityUrn'] === 'string' ? companyEntity['entityUrn'] : null);
  const liUrl     = (typeof companyEntity['url'] === 'string' ? companyEntity['url'] : null)
                 ?? (slug ? `https://www.linkedin.com/company/${slug}/` : null);

  const industries: string[] = [];
  const indUrns = companyEntity['industryUrns'];
  if (Array.isArray(indUrns)) {
    for (const iUrn of indUrns) {
      const indEnt = ent(iUrn as string, idx);
      const label  = typeof indEnt?.['name'] === 'string' ? indEnt['name'] : null;
      if (label) industries.push(label);
    }
  }

  const ecRaw   = companyEntity['employeeCountRange'];
  const ecRange = ecRaw && typeof ecRaw === 'object'
    ? { start: (ecRaw as Record<string, unknown>)['start'] as number | null ?? null, end: (ecRaw as Record<string, unknown>)['end'] as number | null ?? null }
    : null;

  const hqRaw = companyEntity['headquarter'];
  const hq = hqRaw && typeof hqRaw === 'object'
    ? {
        city:    textOf((hqRaw as Record<string, unknown>)['city'])    ?? null,
        country: textOf((hqRaw as Record<string, unknown>)['country']) ?? null,
        line1:   textOf((hqRaw as Record<string, unknown>)['line1'])   ?? null,
      }
    : null;

  const logoVecRaw = dig(companyEntity, 'logo', 'vectorImage');
  const logoVec    = logoVecRaw && typeof logoVecRaw === 'object' ? logoVecRaw as Entity : null;
  const logo       = logoVec ? buildImageUrls(logoVec) : null;

  const specRaw = companyEntity['specialities'];
  const specialties = Array.isArray(specRaw)
    ? specRaw.map(s => textOf(s) ?? (typeof s === 'string' ? s : '')).filter(Boolean)
    : [];

  const followerRaw = dig(companyEntity, 'followingInfo', 'followerCount');

  return {
    companyId,
    companyUrn:         typeof companyEntity['entityUrn']  === 'string' ? companyEntity['entityUrn']  : null,
    companySlug:        slug,
    companyName:        textOf(companyEntity['name']) ?? null,
    companyUrl:         liUrl,
    website:            typeof companyEntity['websiteUrl']  === 'string' ? companyEntity['websiteUrl']  : null,
    description:        textOf(companyEntity['description']) ?? null,
    tagline:            textOf(companyEntity['tagline'])     ?? null,
    industry:           industries[0] ?? null,
    industries,
    foundedYear:        (dig(companyEntity, 'foundedOn', 'year') as number | null) ?? null,
    headquarter:        hq,
    specialties,
    employeeCount:      typeof companyEntity['staffCount'] === 'number' ? companyEntity['staffCount'] : null,
    employeeCountRange: ecRange,
    followerCount:      typeof followerRaw === 'number' ? followerRaw : null,
    logo,
  };
}

function findCompany(companyId: string | null, idx: EntityIndex): Entity | null {
  if (!companyId) return null;
  for (const [type, entities] of idx.byType.entries()) {
    const tl = type.toLowerCase();
    if (tl.includes('company') || tl.includes('minicompany')) {
      const found = entities.find(e => numericId(typeof e['entityUrn'] === 'string' ? e['entityUrn'] : null) === companyId);
      if (found) return found;
    }
  }
  return null;
}

function resolveEmploymentType(pos: Entity, idx: EntityIndex): string | null {
  const empUrn = (pos['*employmentType'] as string | null) ?? (pos['employmentTypeUrn'] as string | null) ?? null;
  const empEnt = ent(empUrn, idx);
  return typeof empEnt?.['name'] === 'string' ? empEnt['name'] : null;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

function resolveExperience(profile: Entity, idx: EntityIndex): ExperienceEntry[] {
  const pgUrns = collectionElements(profile['*profilePositionGroups'], idx);
  const positions: (ExperienceEntry & { _sy: number; _sm: number; _cur: boolean })[] = [];

  for (const pgUrn of pgUrns) {
    const pg = ent(pgUrn, idx);
    if (!pg) continue;

    const posUrns = collectionElements(pg['*profilePositionInPositionGroup'], idx);
    for (const posUrn of posUrns) {
      const pos = ent(posUrn, idx);
      if (!pos) continue;

      const companyRef = (pos['*company'] as string | null) ?? (pos['companyUrn'] as string | null) ?? null;
      const companyEnt = ent(companyRef, idx);
      const cId        = numericId(companyRef) ?? numericId(typeof companyEnt?.['entityUrn'] === 'string' ? companyEnt['entityUrn'] : null);
      const company    = companyEnt ?? findCompany(cId, idx);

      const companyId   = numericId(companyRef);
      const companyUrn  = companyRef;
      const companySlug = typeof company?.['universalName'] === 'string' ? company['universalName'] : null;
      const companyName = (pos['companyName'] as string | null) ?? textOf(company?.['name']) ?? null;
      const companyUrl  = (typeof company?.['url'] === 'string' ? company['url'] : null)
                       ?? (companySlug ? `https://www.linkedin.com/company/${companySlug}/` : null);

      const logoVecRaw = dig(company, 'logo', 'vectorImage');
      const logoVec    = logoVecRaw && typeof logoVecRaw === 'object' ? logoVecRaw as Entity : null;
      const companyLogoUrl = logoVec ? (buildImageUrls(logoVec)?.largeUrl ?? null) : null;

      const indUrns = Array.isArray(company?.['industryUrns']) ? company!['industryUrns'] as string[] : [];
      const companyIndustry = indUrns.length > 0 ? (typeof ent(indUrns[0] ?? null, idx)?.['name'] === 'string' ? ent(indUrns[0] ?? null, idx)!['name'] as string : null) : null;

      const drRaw   = pos['dateRange'] as Record<string, unknown> | null;
      const startDate = normalizeDate(drRaw?.['start']);
      const endDate   = normalizeDate(drRaw?.['end']);
      const current   = !endDate.year && !endDate.month;

      const geoRef = (pos['*geo'] as string | null) ?? (pos['geoUrn'] as string | null) ?? null;
      const geoEnt = ent(geoRef, idx);
      const location =
        textOf(geoEnt?.['defaultLocalizedName']) ??
        (pos['locationName'] as string | null) ??
        (pos['geoLocationName'] as string | null) ??
        null;

      positions.push({
        entityUrn:   typeof pos['entityUrn'] === 'string' ? pos['entityUrn'] : null,
        positionUrn: typeof pos['entityUrn'] === 'string' ? pos['entityUrn'] : null,
        title:       typeof pos['title']       === 'string' ? pos['title']      : null,
        companyName,
        companyId,
        companyUrn,
        companySlug,
        companyUrl,
        companyLogoUrl,
        companyIndustry,
        employmentType:    resolveEmploymentType(pos, idx),
        employmentTypeUrn: typeof pos['employmentTypeUrn'] === 'string' ? pos['employmentTypeUrn'] : null,
        location,
        startDate,
        endDate,
        current,
        description: typeof pos['description'] === 'string' ? pos['description'] : null,
        shouldShowSourceOfHireBadge: typeof pos['shouldShowSourceOfHireBadge'] === 'boolean' ? pos['shouldShowSourceOfHireBadge'] : null,
        _sy:  startDate.year  ?? 0,
        _sm:  startDate.month ?? 0,
        _cur: current,
      });
    }
  }

  positions.sort((a, b) => {
    if (a._cur !== b._cur) return a._cur ? -1 : 1;
    if (b._sy  !== a._sy)  return b._sy  - a._sy;
    return b._sm - a._sm;
  });

  return positions.map(({ _sy: _s, _sm: _sm2, _cur: _c, ...p }) => p);
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

function resolveEducation(profile: Entity, idx: EntityIndex): EducationEntry[] {
  const eduUrns = collectionElements(profile['*profileEducations'], idx);
  const entries: (EducationEntry & { _sy: number; _sm: number })[] = [];

  for (const urn of eduUrns) {
    const edu = ent(urn, idx);
    if (!edu) continue;

    const schoolRef        = (edu['*school'] as string | null) ?? null;
    const schoolEnt        = ent(schoolRef, idx);
    const schoolCompanyUrn = (edu['companyUrn'] as string | null) ?? null;
    const schoolCompanyEnt = ent(schoolCompanyUrn, idx);

    const schoolId   = numericId(schoolRef) ?? numericId(schoolCompanyUrn) ?? null;
    const schoolUrn  = schoolRef ?? schoolCompanyUrn ?? null;
    const schoolSlug = (schoolEnt?.['universalName'] as string | null) ?? (schoolCompanyEnt?.['universalName'] as string | null) ?? null;
    const schoolName = (edu['schoolName'] as string | null) ?? textOf(schoolEnt?.['name']) ?? textOf(schoolCompanyEnt?.['name']) ?? null;
    const schoolUrl  = (schoolEnt?.['url'] as string | null) ?? (schoolCompanyEnt?.['url'] as string | null) ?? (schoolSlug ? `https://www.linkedin.com/school/${schoolSlug}/` : null);

    const sLogoVecRaw = dig(schoolEnt, 'logo', 'vectorImage') ?? dig(schoolCompanyEnt, 'logo', 'vectorImage');
    const sLogoVec    = sLogoVecRaw && typeof sLogoVecRaw === 'object' ? sLogoVecRaw as Entity : null;
    const schoolLogo  = sLogoVec ? buildImageUrls(sLogoVec) : null;

    const drRaw   = edu['dateRange'] as Record<string, unknown> | null;
    const startDate = normalizeDate(drRaw?.['start']);
    const endDate   = normalizeDate(drRaw?.['end']);

    entries.push({
      entityUrn:    typeof edu['entityUrn']    === 'string' ? edu['entityUrn']    : null,
      schoolName,
      schoolId,
      schoolUrn,
      schoolSlug,
      schoolUrl,
      schoolLogo,
      degree:       typeof edu['degreeName']   === 'string' ? edu['degreeName']   : null,
      degreeUrn:    typeof edu['degreeUrn']    === 'string' ? edu['degreeUrn']    : null,
      fieldOfStudy: typeof edu['fieldOfStudy'] === 'string' ? edu['fieldOfStudy'] : null,
      standardizedFieldOfStudyUrn: typeof edu['standardizedFieldOfStudyUrn'] === 'string' ? edu['standardizedFieldOfStudyUrn'] : null,
      grade:        typeof edu['grade']        === 'string' ? edu['grade']        : null,
      activities:   typeof edu['activities']   === 'string' ? edu['activities']   : null,
      description:  typeof edu['description']  === 'string' ? edu['description']  : null,
      startDate,
      endDate,
      _sy: startDate.year  ?? 0,
      _sm: startDate.month ?? 0,
    });
  }

  entries.sort((a, b) => b._sy !== a._sy ? b._sy - a._sy : b._sm - a._sm);
  return entries.map(({ _sy: _s, _sm: _sm2, ...e }) => e);
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function resolveSkills(profile: Entity, idx: EntityIndex): SkillEntry[] {
  const keys   = ['*profileSkills', '*profileTopSkills', '*profileSkillOrganizationView', '*skills'];
  const seen   = new Set<string>();
  const skills: SkillEntry[] = [];

  for (const key of keys) {
    const refUrn = profile[key];
    for (const sUrn of collectionElements(refUrn, idx)) {
      if (seen.has(sUrn)) continue;
      seen.add(sUrn);
      const se   = ent(sUrn, idx);
      if (!se) continue;
      const name = (typeof se['name'] === 'string' ? se['name'] : null) ?? textOf(se['multiLocaleName']) ?? null;
      if (name) skills.push({ entityUrn: typeof se['entityUrn'] === 'string' ? se['entityUrn'] : sUrn, name });
    }
  }

  if (skills.length === 0) {
    for (const [type, entities] of idx.byType.entries()) {
      if (type.toLowerCase().includes('skill')) {
        for (const e of entities) {
          const urn  = typeof e['entityUrn'] === 'string' ? e['entityUrn'] : null;
          if (urn && seen.has(urn)) continue;
          const name = (typeof e['name'] === 'string' ? e['name'] : null) ?? textOf(e['multiLocaleName']) ?? null;
          if (name) skills.push({ entityUrn: urn, name });
        }
      }
    }
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Simple collection resolvers
// ---------------------------------------------------------------------------

function resolveProjects(profile: Entity, idx: EntityIndex): ProjectEntry[] {
  return collectionElements(profile['*profileProjects'], idx)
    .map(urn => {
      const p = ent(urn, idx);
      if (!p) return null;
      const contributors: string[] = [];
      const contribs = p['contributors'];
      if (Array.isArray(contribs)) {
        for (const c of contribs) {
          if (!c || typeof c !== 'object') continue;
          const sc = (c as Record<string, unknown>)['standardizedContributor'];
          if (!sc || typeof sc !== 'object') continue;
          const scObj = sc as Record<string, unknown>;
          const pUrn  = (scObj['*profile'] as string | null) ?? (scObj['profileUrn'] as string | null) ?? null;
          if (pUrn) contributors.push(pUrn);
        }
      }
      const drRaw = p['dateRange'] as Record<string, unknown> | null;
      return {
        entityUrn:   typeof p['entityUrn']   === 'string' ? p['entityUrn']   : null,
        title:       typeof p['title']        === 'string' ? p['title']       : null,
        description: typeof p['description'] === 'string' ? p['description'] : null,
        url:         typeof p['url']          === 'string' ? p['url']         : null,
        startDate:   normalizeDate(drRaw?.['start']),
        endDate:     normalizeDate(drRaw?.['end']),
        contributors,
      };
    })
    .filter((x): x is ProjectEntry => x !== null);
}

function resolveCertifications(profile: Entity, idx: EntityIndex): CertificationEntry[] {
  return collectionElements(profile['*profileCertifications'], idx)
    .map(urn => {
      const c = ent(urn, idx);
      if (!c) return null;
      const tp = c['timePeriod'] as Record<string, unknown> | null;
      return {
        entityUrn:      typeof c['entityUrn']     === 'string' ? c['entityUrn']     : null,
        name:           typeof c['name']           === 'string' ? c['name']          : null,
        authority:      typeof c['authority']      === 'string' ? c['authority']     : null,
        licenseNumber:  typeof c['licenseNumber']  === 'string' ? c['licenseNumber'] : null,
        url:            typeof c['url']            === 'string' ? c['url']           : null,
        issueDate:      normalizeDate(tp?.['startDate']),
        expirationDate: normalizeDate(tp?.['endDate']),
      };
    })
    .filter((x): x is CertificationEntry => x !== null);
}

function resolveLanguages(profile: Entity, idx: EntityIndex): LanguageEntry[] {
  return collectionElements(profile['*profileLanguages'], idx)
    .map(urn => {
      const l = ent(urn, idx);
      if (!l) return null;
      return {
        entityUrn:   typeof l['entityUrn']   === 'string' ? l['entityUrn']   : null,
        name:        typeof l['name']        === 'string' ? l['name']        : null,
        proficiency: typeof l['proficiency'] === 'string' ? l['proficiency'] : null,
      };
    })
    .filter((x): x is LanguageEntry => x !== null);
}

function resolveCourses(profile: Entity, idx: EntityIndex): CourseEntry[] {
  return collectionElements(profile['*profileCourses'], idx)
    .map(urn => {
      const c = ent(urn, idx);
      if (!c) return null;
      return {
        entityUrn: typeof c['entityUrn'] === 'string' ? c['entityUrn'] : null,
        name:      typeof c['name']      === 'string' ? c['name']      : null,
        number:    typeof c['number']    === 'string' ? c['number']    : null,
      };
    })
    .filter((x): x is CourseEntry => x !== null);
}

function resolvePublications(profile: Entity, idx: EntityIndex): PublicationEntry[] {
  return collectionElements(profile['*profilePublications'], idx)
    .map(urn => {
      const p = ent(urn, idx);
      if (!p) return null;
      return {
        entityUrn:   typeof p['entityUrn']   === 'string' ? p['entityUrn']   : null,
        name:        typeof p['name']        === 'string' ? p['name']        : null,
        publisher:   typeof p['publisher']   === 'string' ? p['publisher']   : null,
        description: typeof p['description'] === 'string' ? p['description'] : null,
        url:         typeof p['url']         === 'string' ? p['url']         : null,
        date:        normalizeDate(p['date']),
      };
    })
    .filter((x): x is PublicationEntry => x !== null);
}

function resolveHonors(profile: Entity, idx: EntityIndex): HonorEntry[] {
  return collectionElements(profile['*profileHonors'], idx)
    .map(urn => {
      const h = ent(urn, idx);
      if (!h) return null;
      return {
        entityUrn:   typeof h['entityUrn']   === 'string' ? h['entityUrn']   : null,
        title:       typeof h['title']       === 'string' ? h['title']       : null,
        issuer:      typeof h['issuer']      === 'string' ? h['issuer']      : null,
        description: typeof h['description'] === 'string' ? h['description'] : null,
        issueDate:   normalizeDate(h['issueDate']),
      };
    })
    .filter((x): x is HonorEntry => x !== null);
}

function resolveVolunteerExperience(profile: Entity, idx: EntityIndex): VolunteerEntry[] {
  return collectionElements(profile['*profileVolunteerExperiences'], idx)
    .map(urn => {
      const v = ent(urn, idx);
      if (!v) return null;
      const drRaw = v['dateRange'] as Record<string, unknown> | null;
      return {
        entityUrn:    typeof v['entityUrn']   === 'string' ? v['entityUrn']   : null,
        role:         typeof v['role']        === 'string' ? v['role']        : null,
        organization: typeof v['companyName'] === 'string' ? v['companyName'] : null,
        cause:        typeof v['cause']       === 'string' ? v['cause']       : null,
        description:  typeof v['description'] === 'string' ? v['description'] : null,
        startDate:    normalizeDate(drRaw?.['start']),
        endDate:      normalizeDate(drRaw?.['end']),
      };
    })
    .filter((x): x is VolunteerEntry => x !== null);
}

function resolvePatents(profile: Entity, idx: EntityIndex): PatentEntry[] {
  return collectionElements(profile['*profilePatents'], idx)
    .map(urn => {
      const p = ent(urn, idx);
      if (!p) return null;
      return {
        entityUrn:   typeof p['entityUrn']   === 'string' ? p['entityUrn']   : null,
        title:       typeof p['title']       === 'string' ? p['title']       : null,
        issuer:      typeof p['issuer']      === 'string' ? p['issuer']      : null,
        number:      typeof p['number']      === 'string' ? p['number']      : null,
        description: typeof p['description'] === 'string' ? p['description'] : null,
        url:         typeof p['url']         === 'string' ? p['url']         : null,
        date:        normalizeDate(p['date']),
      };
    })
    .filter((x): x is PatentEntry => x !== null);
}

function resolveOrganizations(profile: Entity, idx: EntityIndex): OrganizationEntry[] {
  return collectionElements(profile['*profileOrganizations'], idx)
    .map(urn => {
      const o = ent(urn, idx);
      if (!o) return null;
      const drRaw = o['dateRange'] as Record<string, unknown> | null;
      return {
        entityUrn:   typeof o['entityUrn']   === 'string' ? o['entityUrn']   : null,
        name:        typeof o['name']        === 'string' ? o['name']        : null,
        position:    typeof o['position']    === 'string' ? o['position']    : null,
        description: typeof o['description'] === 'string' ? o['description'] : null,
        startDate:   normalizeDate(drRaw?.['start']),
        endDate:     normalizeDate(drRaw?.['end']),
      };
    })
    .filter((x): x is OrganizationEntry => x !== null);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a raw LinkedIn Voyager API response into a normalized profile object.
 * Returns null if the profile entity cannot be resolved.
 */
export function parseLinkedInProfile(
  json: Record<string, unknown>,
  publicIdentifier: string
): ParsedLinkedInProfile | null {
  const included = Array.isArray(json['included']) ? json['included'] as unknown[] : [];
  const idx      = buildIndex(included);
  const profile  = findProfile(json, idx);

  if (!profile) return null;

  const entityUrn    = typeof profile['entityUrn']        === 'string' ? profile['entityUrn']        : null;
  const objectUrn    = typeof profile['objectUrn']        === 'string' ? profile['objectUrn']        : null;
  const profileSlug  = typeof profile['publicIdentifier'] === 'string' ? profile['publicIdentifier'] : publicIdentifier;
  const profileFsdId = fsdProfileId(entityUrn);
  const memberId     = resolveMemberId(profile);

  const identity: ProfileIdentity = {
    entityUrn,
    objectUrn,
    publicIdentifier: profileSlug,
    fsdProfileId:     profileFsdId,
    memberId,
    profileUrl:       `https://www.linkedin.com/in/${profileSlug}/`,
  };

  const media: ProfileMedia = {
    profileImage:    resolveProfileImage(profile),
    backgroundImage: resolveBackgroundImage(profile),
  };

  const normalizedProfile: NormalizedProfile = {
    identity,
    firstName:     typeof profile['firstName']  === 'string' ? profile['firstName']  : null,
    lastName:      typeof profile['lastName']   === 'string' ? profile['lastName']   : null,
    fullName:      (typeof profile['firstName'] === 'string' && typeof profile['lastName'] === 'string')
                     ? `${profile['firstName']} ${profile['lastName']}`
                     : (typeof profile['firstName'] === 'string' ? profile['firstName'] : (typeof profile['lastName'] === 'string' ? profile['lastName'] : null)),
    pronouns:      resolvePronouns(profile),
    headline:      typeof profile['headline']   === 'string' ? profile['headline']   : null,
    summary:       typeof profile['summary']    === 'string' ? profile['summary']    : null,
    occupation:    typeof profile['occupation'] === 'string' ? profile['occupation'] : null,
    location:      resolveLocation(profile, idx),
    industry:      resolveIndustry(profile, idx),
    media,
    profileStatus: resolveProfileStatus(profile),
    relationship:  resolveRelationship(profile, idx),
  };

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

  const currentPos        = experience[0] ?? null;
  const currentCompanyUrn = currentPos?.companyUrn ?? null;
  const currentCompanyEnt = ent(currentCompanyUrn, idx) ?? findCompany(currentPos?.companyId ?? null, idx);

  const metadata: ProfileMetadata = {
    publicIdentifier: profileSlug,
    profileUrn:       entityUrn,
    objectUrn,
    memberId,
    trackingId:  typeof profile['trackingId']  === 'string' ? profile['trackingId']  : null,
    versionTag:  typeof profile['versionTag']  === 'string' ? profile['versionTag']  : null,
    currentCompany: buildCompany(currentCompanyEnt, idx),
  };

  return {
    profile:  normalizedProfile,
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
    metadata,
  };
}
