/**
 * src/models/Lead.ts
 * Mongoose schema + model for the leads collection.
 */

import mongoose, { type Document, type Model } from 'mongoose';
import type { ParsedLinkedInProfile } from '../types.js';

const { Schema } = mongoose;

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface ILead extends ParsedLinkedInProfile, Document {
  username:        string;
  firstSeenAt:     Date;
  lastSeenAt:      Date;
  lastRefreshedAt: Date;
  refreshCount:    number;
  createdAt:       Date;
  updatedAt:       Date;
}

// ---------------------------------------------------------------------------
// Reusable sub-schemas
// ---------------------------------------------------------------------------

const DatePartSchema = new Schema(
  { year: { type: Number, default: null }, month: { type: Number, default: null }, day: { type: Number, default: null } },
  { _id: false }
);

const ExperienceSchema = new Schema({
  entityUrn:      { type: String, default: null },
  positionUrn:    { type: String, default: null },
  title:          { type: String, default: null },
  companyName:    { type: String, default: null },
  companyId:      { type: String, default: null },
  companyUrn:     { type: String, default: null },
  companySlug:    { type: String, default: null },
  companyUrl:     { type: String, default: null },
  companyLogoUrl: { type: String, default: null },
  companyIndustry:{ type: String, default: null },
  employmentType: { type: String, default: null },
  employmentTypeUrn: { type: String, default: null },
  location:       { type: String, default: null },
  startDate:      { type: DatePartSchema, default: () => ({}) },
  endDate:        { type: DatePartSchema, default: () => ({}) },
  current:        { type: Boolean, default: false },
  description:    { type: String, default: null },
  shouldShowSourceOfHireBadge: { type: Boolean, default: null },
}, { _id: false });

const EducationSchema = new Schema({
  entityUrn:    { type: String, default: null },
  schoolName:   { type: String, default: null },
  schoolId:     { type: String, default: null },
  schoolUrn:    { type: String, default: null },
  schoolSlug:   { type: String, default: null },
  schoolUrl:    { type: String, default: null },
  schoolLogo:   { type: Schema.Types.Mixed, default: null },
  degree:       { type: String, default: null },
  degreeUrn:    { type: String, default: null },
  fieldOfStudy: { type: String, default: null },
  standardizedFieldOfStudyUrn: { type: String, default: null },
  grade:        { type: String, default: null },
  activities:   { type: String, default: null },
  description:  { type: String, default: null },
  startDate:    { type: DatePartSchema, default: () => ({}) },
  endDate:      { type: DatePartSchema, default: () => ({}) },
}, { _id: false });

const SkillSchema         = new Schema({ entityUrn: { type: String, default: null }, name: { type: String, default: null } }, { _id: false });
const ProjectSchema       = new Schema({ entityUrn: { type: String, default: null }, title: String, description: String, url: String, startDate: DatePartSchema, endDate: DatePartSchema, contributors: [String] }, { _id: false });
const CertificationSchema = new Schema({ entityUrn: String, name: String, authority: String, licenseNumber: String, url: String, issueDate: DatePartSchema, expirationDate: DatePartSchema }, { _id: false });
const LanguageSchema      = new Schema({ entityUrn: String, name: String, proficiency: String }, { _id: false });
const CourseSchema        = new Schema({ entityUrn: String, name: String, number: String }, { _id: false });
const PublicationSchema   = new Schema({ entityUrn: String, name: String, publisher: String, description: String, url: String, date: DatePartSchema }, { _id: false });
const HonorSchema         = new Schema({ entityUrn: String, title: String, issuer: String, description: String, issueDate: DatePartSchema }, { _id: false });
const VolunteerSchema     = new Schema({ entityUrn: String, role: String, organization: String, cause: String, description: String, startDate: DatePartSchema, endDate: DatePartSchema }, { _id: false });
const PatentSchema        = new Schema({ entityUrn: String, title: String, issuer: String, number: String, description: String, url: String, date: DatePartSchema }, { _id: false });
const OrganizationSchema  = new Schema({ entityUrn: String, name: String, position: String, description: String, startDate: DatePartSchema, endDate: DatePartSchema }, { _id: false });

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

const LeadSchema = new Schema<ILead>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },

    profile: {
      identity: {
        entityUrn: String, objectUrn: String, publicIdentifier: String,
        fsdProfileId: String, memberId: String, profileUrl: String,
      },
      firstName: String,  lastName: String,  fullName: String,
      pronouns: String,   headline: String,  summary: String,  occupation: String,
      location: {
        locationName: String, city: String, country: String, countryCode: String, geoUrn: String,
      },
      industry: { industryUrn: String, industryName: String },
      media: {
        profileImage:    { type: Schema.Types.Mixed, default: null },
        backgroundImage: { type: Schema.Types.Mixed, default: null },
      },
      profileStatus: {
        openToWork: { type: Boolean, default: null },
        hiring:     { type: Boolean, default: null },
        premium:    { type: Boolean, default: null },
        premiumBadge: { type: Boolean, default: null },
        creator:    { type: Boolean, default: null },
        influencer: { type: Boolean, default: null },
      },
      relationship: {
        connectionDegree: Number, memberDistance: String, followerCount: Number, connectionCount: Number,
      },
    },

    experience:          { type: [ExperienceSchema],    default: [] },
    education:           { type: [EducationSchema],     default: [] },
    skills:              { type: [SkillSchema],          default: [] },
    projects:            { type: [ProjectSchema],        default: [] },
    certifications:      { type: [CertificationSchema],  default: [] },
    languages:           { type: [LanguageSchema],       default: [] },
    courses:             { type: [CourseSchema],         default: [] },
    publications:        { type: [PublicationSchema],    default: [] },
    honors:              { type: [HonorSchema],          default: [] },
    volunteerExperience: { type: [VolunteerSchema],      default: [] },
    patents:             { type: [PatentSchema],         default: [] },
    organizations:       { type: [OrganizationSchema],  default: [] },

    metadata: { type: Schema.Types.Mixed, default: {} },

    firstSeenAt:     { type: Date, default: null },
    lastSeenAt:      { type: Date, default: null },
    lastRefreshedAt: { type: Date, default: null },
    refreshCount:    { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'leads' }
);

LeadSchema.index({ lastSeenAt: -1 });
LeadSchema.index(
  { username: 'text', 'profile.firstName': 'text', 'profile.lastName': 'text', 'profile.headline': 'text' },
  { name: 'lead_text_search' }
);

const Lead: Model<ILead> = mongoose.model<ILead>('Lead', LeadSchema);
export default Lead;
