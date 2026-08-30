/**
 * src/types.ts
 *
 * Shared TypeScript types for the LinkedIn Lead Extractor backend.
 * These mirror the canonical data structures defined in docs/data-model.md.
 */

// ---------------------------------------------------------------------------
// LinkedIn graph primitive types
// ---------------------------------------------------------------------------

export interface DatePart {
  year:  number | null;
  month: number | null;
  day:   number | null;
}

export interface ImageUrls {
  urn:             string | null;
  rootUrl:         string | null;
  urls:            Record<number, string>;
  largeUrl:        string | null;
  smallUrl:        string | null;
  displayImageUrn?: string | null;
  frameType?:      string | null;
}

// ---------------------------------------------------------------------------
// Normalized profile sub-objects
// ---------------------------------------------------------------------------

export interface ProfileIdentity {
  entityUrn:        string | null;
  objectUrn:        string | null;
  publicIdentifier: string;
  fsdProfileId:     string | null;
  memberId:         string | null;
  profileUrl:       string;
}

export interface ProfileLocation {
  locationName: string | null;
  city:         string | null;
  country:      string | null;
  countryCode:  string | null;
  geoUrn:       string | null;
}

export interface ProfileIndustry {
  industryUrn:  string | null;
  industryName: string | null;
}

export interface ProfileMedia {
  profileImage:    ImageUrls | null;
  backgroundImage: ImageUrls | null;
}

export interface ProfileStatus {
  openToWork:   boolean | null;
  hiring:       boolean | null;
  premium:      boolean | null;
  premiumBadge: boolean | null;
  creator:      boolean | null;
  influencer:   boolean | null;
}

export interface ProfileRelationship {
  connectionDegree: number | null;
  memberDistance:   string | null;
  followerCount:    number | null;
  connectionCount:  number | null;
}

export interface NormalizedProfile {
  identity:      ProfileIdentity;
  firstName:     string | null;
  lastName:      string | null;
  fullName:      string | null;
  pronouns:      string | null;
  headline:      string | null;
  summary:       string | null;
  occupation:    string | null;
  location:      ProfileLocation;
  industry:      ProfileIndustry;
  media:         ProfileMedia;
  profileStatus: ProfileStatus;
  relationship:  ProfileRelationship;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export interface ExperienceEntry {
  entityUrn:      string | null;
  positionUrn:    string | null;
  title:          string | null;
  companyName:    string | null;
  companyId:      string | null;
  companyUrn:     string | null;
  companySlug:    string | null;
  companyUrl:     string | null;
  companyLogoUrl: string | null;
  companyIndustry:string | null;
  employmentType: string | null;
  employmentTypeUrn: string | null;
  location:       string | null;
  startDate:      DatePart;
  endDate:        DatePart;
  current:        boolean;
  description:    string | null;
  shouldShowSourceOfHireBadge: boolean | null;
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export interface EducationEntry {
  entityUrn:    string | null;
  schoolName:   string | null;
  schoolId:     string | null;
  schoolUrn:    string | null;
  schoolSlug:   string | null;
  schoolUrl:    string | null;
  schoolLogo:   ImageUrls | null;
  degree:       string | null;
  degreeUrn:    string | null;
  fieldOfStudy: string | null;
  standardizedFieldOfStudyUrn: string | null;
  grade:        string | null;
  activities:   string | null;
  description:  string | null;
  startDate:    DatePart;
  endDate:      DatePart;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface SkillEntry {
  entityUrn: string | null;
  name:      string;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectEntry {
  entityUrn:    string | null;
  title:        string | null;
  description:  string | null;
  url:          string | null;
  startDate:    DatePart;
  endDate:      DatePart;
  contributors: string[];
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

export interface CertificationEntry {
  entityUrn:      string | null;
  name:           string | null;
  authority:      string | null;
  licenseNumber:  string | null;
  url:            string | null;
  issueDate:      DatePart;
  expirationDate: DatePart;
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export interface LanguageEntry {
  entityUrn:   string | null;
  name:        string | null;
  proficiency: string | null;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export interface CourseEntry {
  entityUrn: string | null;
  name:      string | null;
  number:    string | null;
}

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------

export interface PublicationEntry {
  entityUrn:   string | null;
  name:        string | null;
  publisher:   string | null;
  description: string | null;
  url:         string | null;
  date:        DatePart;
}

// ---------------------------------------------------------------------------
// Honors
// ---------------------------------------------------------------------------

export interface HonorEntry {
  entityUrn:   string | null;
  title:       string | null;
  issuer:      string | null;
  description: string | null;
  issueDate:   DatePart;
}

// ---------------------------------------------------------------------------
// Volunteer Experience
// ---------------------------------------------------------------------------

export interface VolunteerEntry {
  entityUrn:    string | null;
  role:         string | null;
  organization: string | null;
  cause:        string | null;
  description:  string | null;
  startDate:    DatePart;
  endDate:      DatePart;
}

// ---------------------------------------------------------------------------
// Patents
// ---------------------------------------------------------------------------

export interface PatentEntry {
  entityUrn:   string | null;
  title:       string | null;
  issuer:      string | null;
  number:      string | null;
  description: string | null;
  url:         string | null;
  date:        DatePart;
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export interface OrganizationEntry {
  entityUrn:   string | null;
  name:        string | null;
  position:    string | null;
  description: string | null;
  startDate:   DatePart;
  endDate:     DatePart;
}

// ---------------------------------------------------------------------------
// Company (metadata.currentCompany)
// ---------------------------------------------------------------------------

export interface CompanyObject {
  companyId:          string | null;
  companyUrn:         string | null;
  companySlug:        string | null;
  companyName:        string | null;
  companyUrl:         string | null;
  website:            string | null;
  description:        string | null;
  tagline:            string | null;
  industry:           string | null;
  industries:         string[];
  foundedYear:        number | null;
  headquarter:        { city: string | null; country: string | null; line1: string | null } | null;
  specialties:        string[];
  employeeCount:      number | null;
  employeeCountRange: { start: number | null; end: number | null } | null;
  followerCount:      number | null;
  logo:               ImageUrls | null;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export interface ProfileMetadata {
  publicIdentifier: string;
  profileUrn:       string | null;
  objectUrn:        string | null;
  memberId:         string | null;
  trackingId:       string | null;
  versionTag:       string | null;
  currentCompany:   CompanyObject | null;
}

// ---------------------------------------------------------------------------
// Full parsed profile (output of parser.ts)
// ---------------------------------------------------------------------------

export interface ParsedLinkedInProfile {
  profile:             NormalizedProfile;
  experience:          ExperienceEntry[];
  education:           EducationEntry[];
  skills:              SkillEntry[];
  projects:            ProjectEntry[];
  certifications:      CertificationEntry[];
  languages:           LanguageEntry[];
  courses:             CourseEntry[];
  publications:        PublicationEntry[];
  honors:              HonorEntry[];
  volunteerExperience: VolunteerEntry[];
  patents:             PatentEntry[];
  organizations:       OrganizationEntry[];
  metadata:            ProfileMetadata;
}

// ---------------------------------------------------------------------------
// API response envelopes
// ---------------------------------------------------------------------------

export interface SuccessResponse<T = unknown> {
  success: true;
  data:    T;
}

export interface SourcedResponse<T = unknown> {
  success: true;
  source:  'linkedin' | 'database';
  data:    T;
}

export interface PaginationMeta {
  page:           number;
  limit:          number;
  total:          number;
  totalPages:     number;
  hasNextPage:    boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T = unknown> {
  success:    true;
  data:       T[];
  pagination: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code:    string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Import result types
// ---------------------------------------------------------------------------

export type ImportStatus = 'created' | 'exists' | 'failed';

export interface ImportResult {
  username: string;
  status:   ImportStatus;
  leadId?:  string;
  error?:   string;
}

export interface ImportSummary {
  totalRows:       number;
  uniqueUsernames: number;
  alreadyExists:   number;
  created:         number;
  failed:          number;
}

export interface ImportResponse {
  success:  true;
  summary:  ImportSummary;
  results:  ImportResult[];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface StatsData {
  totalLeads:     number;
  lastImportedAt: Date | null;
  totalRefreshed: number;
}
