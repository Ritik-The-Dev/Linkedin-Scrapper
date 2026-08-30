import type { Lead } from '../../types/lead.ts';
import { AboutSection } from './AboutSection.tsx';
import { CertificationsSection } from './CertificationsSection.tsx';
import { CoursesSection } from './CoursesSection.tsx';
import { CurrentCompanyCard } from './CurrentCompanyCard.tsx';
import { EducationSection } from './EducationSection.tsx';
import { ExperienceTimeline } from './ExperienceTimeline.tsx';
import { HonorsSection } from './HonorsSection.tsx';
import { LanguagesSection } from './LanguagesSection.tsx';
import { OrganizationsSection } from './OrganizationsSection.tsx';
import { PatentsSection } from './PatentsSection.tsx';
import { ProjectsSection } from './ProjectsSection.tsx';
import { PublicationsSection } from './PublicationsSection.tsx';
import { SkillsGrid } from './SkillsGrid.tsx';
import { VolunteerSection } from './VolunteerSection.tsx';

/**
 * Every profile section, in reading order.
 *
 * Each component returns null when its slice of the document is empty, so a
 * sparse profile renders a short page rather than a column of "No data" cards.
 */
export function LeadSections({ lead }: { lead: Lead }) {
  return (
    <>
      <AboutSection lead={lead} />
      <ExperienceTimeline lead={lead} />
      <CurrentCompanyCard lead={lead} />
      <EducationSection lead={lead} />
      <SkillsGrid lead={lead} />
      <ProjectsSection lead={lead} />
      <CertificationsSection lead={lead} />
      <PublicationsSection lead={lead} />
      <PatentsSection lead={lead} />
      <HonorsSection lead={lead} />
      <CoursesSection lead={lead} />
      <LanguagesSection lead={lead} />
      <VolunteerSection lead={lead} />
      <OrganizationsSection lead={lead} />
    </>
  );
}
