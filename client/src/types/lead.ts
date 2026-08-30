/**
 * Lead document types, mirroring docs/data-model.md.
 *
 * Two rules drive the shape of everything here:
 *  1. Scalars LinkedIn did not return are `null`, never `undefined` — but the
 *     frontend still treats every field as possibly absent, because a stored
 *     document may predate a parser change.
 *  2. `null` means "unknown", not "false". See ProfileStatus.
 */

export interface LinkedInDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

/** A LinkedIn media asset. `urls` is keyed by pixel width, e.g. "100" … "800". */
export interface ImageAsset {
  urn?: string | null;
  rootUrl?: string | null;
  urls?: Record<string, string | null> | null;
  largeUrl?: string | null;
  smallUrl?: string | null;
  displayImageUrn?: string | null;
  /** e.g. "OPEN_TO_WORK" — the source of profileStatus.openToWork. */
  frameType?: string | null;
}

export interface ProfileIdentity {
  entityUrn?: string | null;
  objectUrn?: string | null;
  publicIdentifier?: string | null;
  fsdProfileId?: string | null;
  memberId?: string | null;
  profileUrl?: string | null;
}

export interface ProfileLocation {
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  geoUrn?: string | null;
}

export interface ProfileIndustry {
  industryUrn?: string | null;
  industryName?: string | null;
}

export interface ProfileMedia {
  profileImage?: ImageAsset | null;
  backgroundImage?: ImageAsset | null;
}

/**
 * Every field is tri-state. `null` means LinkedIn did not say.
 * The UI only ever renders a positive badge for an explicit `true`.
 */
export interface ProfileStatus {
  openToWork?: boolean | null;
  hiring?: boolean | null;
  premium?: boolean | null;
  premiumBadge?: boolean | null;
  creator?: boolean | null;
  influencer?: boolean | null;
}

export interface ProfileRelationship {
  connectionDegree?: number | null;
  memberDistance?: string | null;
  followerCount?: number | null;
  connectionCount?: number | null;
}

export interface LeadProfile {
  identity?: ProfileIdentity | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  pronouns?: string | null;
  headline?: string | null;
  summary?: string | null;
  occupation?: string | null;
  location?: ProfileLocation | null;
  industry?: ProfileIndustry | null;
  media?: ProfileMedia | null;
  profileStatus?: ProfileStatus | null;
  relationship?: ProfileRelationship | null;
}

export interface Experience {
  entityUrn?: string | null;
  positionUrn?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  companyUrn?: string | null;
  companySlug?: string | null;
  companyUrl?: string | null;
  companyLogoUrl?: string | null;
  companyIndustry?: string | null;
  employmentType?: string | null;
  employmentTypeUrn?: string | null;
  location?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
  current?: boolean | null;
  description?: string | null;
  shouldShowSourceOfHireBadge?: boolean | null;
}

export interface Education {
  entityUrn?: string | null;
  schoolName?: string | null;
  schoolId?: string | null;
  schoolUrn?: string | null;
  schoolSlug?: string | null;
  schoolUrl?: string | null;
  schoolLogo?: ImageAsset | null;
  degree?: string | null;
  degreeUrn?: string | null;
  fieldOfStudy?: string | null;
  standardizedFieldOfStudyUrn?: string | null;
  grade?: string | null;
  activities?: string | null;
  description?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
}

export interface Skill {
  entityUrn?: string | null;
  name?: string | null;
}

export interface Project {
  entityUrn?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
  contributors?: string[] | null;
}

/**
 * docs/data-model.md documents these arrays as "resolved entities" without
 * pinning their field names (they arrive empty in the v1 sample). The declared
 * fields below are the ones the UI reads; the index signature keeps unexpected
 * keys type-safe, and every renderer falls back across likely aliases rather
 * than assuming one name. See README "Backend contract assumptions".
 */
export interface Certification {
  entityUrn?: string | null;
  name?: string | null;
  authority?: string | null;
  licenseNumber?: string | null;
  url?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface Language {
  entityUrn?: string | null;
  name?: string | null;
  proficiency?: string | null;
  [key: string]: unknown;
}

export interface Course {
  entityUrn?: string | null;
  name?: string | null;
  number?: string | null;
  [key: string]: unknown;
}

export interface Publication {
  entityUrn?: string | null;
  name?: string | null;
  publisher?: string | null;
  description?: string | null;
  url?: string | null;
  date?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface Honor {
  entityUrn?: string | null;
  title?: string | null;
  issuer?: string | null;
  description?: string | null;
  issueDate?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface VolunteerExperience {
  entityUrn?: string | null;
  role?: string | null;
  companyName?: string | null;
  cause?: string | null;
  description?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface Patent {
  entityUrn?: string | null;
  title?: string | null;
  number?: string | null;
  description?: string | null;
  url?: string | null;
  issueDate?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface Organization {
  entityUrn?: string | null;
  name?: string | null;
  position?: string | null;
  description?: string | null;
  startDate?: LinkedInDate | null;
  endDate?: LinkedInDate | null;
  [key: string]: unknown;
}

export interface EmployeeCountRange {
  start?: number | null;
  end?: number | null;
}

export interface CurrentCompany {
  companyId?: string | null;
  companyUrn?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  companyUrl?: string | null;
  website?: string | null;
  description?: string | null;
  tagline?: string | null;
  industry?: string | null;
  industries?: string[] | null;
  foundedYear?: number | null;
  headquarter?: string | null;
  specialties?: string[] | null;
  employeeCount?: number | null;
  employeeCountRange?: EmployeeCountRange | null;
  followerCount?: number | null;
  logo?: ImageAsset | null;
}

export interface LeadMetadata {
  publicIdentifier?: string | null;
  profileUrn?: string | null;
  objectUrn?: string | null;
  memberId?: string | null;
  trackingId?: string | null;
  versionTag?: string | null;
  currentCompany?: CurrentCompany | null;
}

export interface Lead {
  _id: string;
  username: string;
  profile?: LeadProfile | null;
  experience?: Experience[] | null;
  education?: Education[] | null;
  skills?: Skill[] | null;
  projects?: Project[] | null;
  certifications?: Certification[] | null;
  languages?: Language[] | null;
  courses?: Course[] | null;
  publications?: Publication[] | null;
  honors?: Honor[] | null;
  volunteerExperience?: VolunteerExperience[] | null;
  patents?: Patent[] | null;
  organizations?: Organization[] | null;
  metadata?: LeadMetadata | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  lastRefreshedAt?: string | null;
  refreshCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
