/**
 * Fixtures for mock mode (VITE_USE_MOCK_API=true).
 *
 * Shapes follow docs/data-model.md exactly — no invented fields, no renamed
 * keys — so switching to the real backend changes nothing in the UI.
 *
 * Avatars are inline SVG data URLs rather than media.licdn.com links so mock
 * mode renders correctly with no network access.
 */

import type { Education, Experience, Lead, LinkedInDate, Skill } from '../../types/lead.ts';

function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function d(year: number | null, month: number | null = null): LinkedInDate {
  return { year, month, day: null };
}

/** Deterministic SVG avatar so mock mode looks right offline. */
function avatarUrl(initials: string, hue: number, size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},72%,58%)"/><stop offset="1" stop-color="hsl(${hue + 26},68%,38%)"/>
</linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/>
<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Helvetica,Arial,sans-serif" font-size="38" font-weight="600" fill="rgba(255,255,255,0.95)">${initials}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function bannerUrl(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="350" viewBox="0 0 1400 350">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},58%,42%)"/><stop offset="0.55" stop-color="hsl(${hue + 18},52%,28%)"/><stop offset="1" stop-color="hsl(${hue + 34},46%,20%)"/>
</linearGradient></defs>
<rect width="1400" height="350" fill="url(#b)"/>
<g fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1">
${Array.from({ length: 14 }, (_, i) => `<circle cx="${120 + i * 95}" cy="${175 + (i % 3) * 40}" r="${60 + (i % 4) * 22}"/>`).join('')}
</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function profileImage(initials: string, hue: number, openToWork: boolean) {
  return {
    urn: null,
    rootUrl: null,
    urls: {
      '100': avatarUrl(initials, hue, 100),
      '200': avatarUrl(initials, hue, 200),
      '400': avatarUrl(initials, hue, 400),
      '800': avatarUrl(initials, hue, 800),
    },
    largeUrl: avatarUrl(initials, hue, 800),
    smallUrl: avatarUrl(initials, hue, 100),
    displayImageUrn: 'urn:li:digitalmediaAsset:mock',
    frameType: openToWork ? 'OPEN_TO_WORK' : null,
  };
}

function skills(names: string[]): Skill[] {
  return names.map((name, i) => ({ entityUrn: `urn:li:fsd_skill:mock-${i}`, name }));
}

interface SeedOptions {
  username: string;
  firstName: string;
  lastName: string;
  headline: string;
  city: string;
  country: string;
  industry: string;
  hue: number;
  summary?: string | null;
  openToWork?: boolean | null;
  premium?: boolean | null;
  creator?: boolean | null;
  experience: Experience[];
  education?: Education[];
  skillNames?: string[];
  lastSeenMinutesAgo: number;
  refreshCount?: number;
  followerCount?: number | null;
}

/** Builds a document with every field present, using null where LinkedIn gave nothing. */
export function seedLead(options: SeedOptions): Lead {
  const initials = `${options.firstName.charAt(0)}${options.lastName.charAt(0)}`.toUpperCase();
  const current = options.experience.find((role) => role.current === true) ?? null;
  const openToWork = options.openToWork ?? false;

  return {
    _id: `64mock${options.username.replace(/[^a-z0-9]/g, '').slice(0, 14)}`,
    username: options.username,
    profile: {
      identity: {
        entityUrn: `urn:li:fsd_profile:MOCK${initials}`,
        objectUrn: `urn:li:member:${800000000 + options.username.length * 137}`,
        publicIdentifier: options.username,
        fsdProfileId: `MOCK${initials}`,
        memberId: String(800000000 + options.username.length * 137),
        profileUrl: `https://www.linkedin.com/in/${options.username}/`,
      },
      firstName: options.firstName,
      lastName: options.lastName,
      fullName: `${options.firstName} ${options.lastName}`,
      pronouns: null,
      headline: options.headline,
      summary: options.summary ?? null,
      occupation: null,
      location: {
        locationName: `${options.city}, ${options.country}`,
        city: options.city,
        country: options.country,
        countryCode: options.country === 'India' ? 'IN' : 'US',
        geoUrn: 'urn:li:fsd_geo:106052723',
      },
      industry: {
        industryUrn: 'urn:li:fsd_industry:4',
        industryName: options.industry,
      },
      media: {
        profileImage: profileImage(initials, options.hue, openToWork === true),
        backgroundImage: {
          urn: null,
          rootUrl: null,
          urls: { '800': bannerUrl(options.hue), '1400': bannerUrl(options.hue) },
          largeUrl: bannerUrl(options.hue),
          smallUrl: bannerUrl(options.hue),
          displayImageUrn: 'urn:li:digitalmediaAsset:mockbg',
        },
      },
      profileStatus: {
        openToWork: options.openToWork ?? false,
        // Contract note: `hiring` is always null in v1 — never rendered as "No".
        hiring: null,
        premium: options.premium ?? false,
        premiumBadge: options.premium ?? false,
        creator: options.creator ?? false,
        influencer: false,
      },
      relationship: {
        connectionDegree: 3,
        memberDistance: 'DISTANCE_3',
        followerCount: options.followerCount ?? null,
        connectionCount: null,
      },
    },
    experience: options.experience,
    education: options.education ?? [],
    skills: skills(options.skillNames ?? []),
    projects: [],
    certifications: [],
    languages: [],
    courses: [],
    publications: [],
    honors: [],
    volunteerExperience: [],
    patents: [],
    organizations: [],
    metadata: {
      publicIdentifier: options.username,
      profileUrn: `urn:li:fsd_profile:MOCK${initials}`,
      objectUrn: `urn:li:member:${800000000 + options.username.length * 137}`,
      memberId: String(800000000 + options.username.length * 137),
      trackingId: 'mock+trackingId==',
      versionTag: '2377123808',
      currentCompany: current
        ? {
            companyId: current.companyId ?? null,
            companyUrn: current.companyUrn ?? null,
            companySlug: current.companySlug ?? null,
            companyName: current.companyName ?? null,
            companyUrl: current.companyUrl ?? null,
            website: null,
            description: null,
            tagline: null,
            industry: current.companyIndustry ?? null,
            industries: current.companyIndustry ? [current.companyIndustry] : [],
            foundedYear: null,
            headquarter: null,
            specialties: [],
            employeeCount: null,
            employeeCountRange: { start: 5001, end: 10000 },
            followerCount: null,
            logo: null,
          }
        : null,
    },
    firstSeenAt: isoAgo(options.lastSeenMinutesAgo + 4000),
    lastSeenAt: isoAgo(options.lastSeenMinutesAgo),
    lastRefreshedAt: isoAgo(options.lastSeenMinutesAgo + 1200),
    refreshCount: options.refreshCount ?? 0,
    createdAt: isoAgo(options.lastSeenMinutesAgo + 4000),
    updatedAt: isoAgo(options.lastSeenMinutesAgo),
  };
}

function role(partial: Partial<Experience>): Experience {
  return {
    entityUrn: `urn:li:fsd_profilePosition:mock-${Math.random().toString(36).slice(2, 8)}`,
    positionUrn: null,
    title: null,
    companyName: null,
    companyId: null,
    companyUrn: null,
    companySlug: null,
    companyUrl: null,
    companyLogoUrl: null,
    companyIndustry: null,
    employmentType: null,
    employmentTypeUrn: null,
    location: null,
    startDate: d(null),
    endDate: d(null),
    current: false,
    description: null,
    shouldShowSourceOfHireBadge: false,
    ...partial,
  };
}

/* ------------------------------------------------------------------ *
 * The flagship fixture: every optional section populated, so each
 * section component can be seen rendering real content.
 * ------------------------------------------------------------------ */

const ritikSde: Lead = seedLead({
  username: 'ritik-sde',
  firstName: 'Ritik',
  lastName: 'Joshi',
  headline: 'Software Engineer 2 at Akamai Technologies',
  city: 'Delhi',
  country: 'India',
  industry: 'Computer Software',
  hue: 214,
  openToWork: true,
  premium: false,
  creator: true,
  followerCount: 3184,
  summary:
    'Backend engineer working on edge delivery and content routing at Akamai. I like problems where latency, cache correctness and cost pull in different directions.\n\nCurrently spending most of my time on request-coalescing at the edge, plus a long-running side interest in agent tooling for curriculum generation.',
  lastSeenMinutesAgo: 6,
  refreshCount: 2,
  experience: [
    role({
      title: 'Software Engineer 2',
      companyName: 'Akamai Technologies',
      companyId: '3925',
      companyUrn: 'urn:li:fsd_company:3925',
      companySlug: 'akamai-technologies',
      companyUrl: 'https://www.linkedin.com/company/akamai-technologies/',
      companyIndustry: 'Computer Software',
      employmentType: 'Full-time',
      location: 'Bengaluru, Karnataka, India',
      startDate: d(2025, 8),
      current: true,
      description:
        'Edge delivery platform. Cut origin egress by 23% by adding request coalescing to the cache-fill path, and rewrote the purge fan-out so a global invalidation completes in under four seconds instead of ninety.',
    }),
    role({
      title: 'Software Engineer',
      companyName: 'Akamai Technologies',
      companyId: '3925',
      companySlug: 'akamai-technologies',
      companyUrl: 'https://www.linkedin.com/company/akamai-technologies/',
      employmentType: 'Full-time',
      location: 'Bengaluru, Karnataka, India',
      startDate: d(2024, 7),
      endDate: d(2025, 7),
      current: false,
      description: 'Owned the metadata configuration service. Added schema validation that caught 400+ bad deploys in the first quarter.',
    }),
    role({
      title: 'Software Engineering Intern',
      companyName: 'Zomato',
      companySlug: 'zomato',
      companyUrl: 'https://www.linkedin.com/company/zomato/',
      employmentType: 'Internship',
      location: 'Gurugram, India',
      startDate: d(2023, 5),
      endDate: d(2023, 8),
      current: false,
      description: 'Built the internal tooling that reconciles restaurant menu imports against the live catalogue.',
    }),
  ],
  education: [
    {
      entityUrn: 'urn:li:fsd_profileEducation:mock-1',
      schoolName: 'Guru Tegh Bahadur Institute Of Technology',
      schoolId: '40706',
      schoolUrn: 'urn:li:fsd_school:40706',
      schoolSlug: null,
      schoolUrl: 'https://www.linkedin.com/school/gtbit/',
      schoolLogo: null,
      degree: 'Bachelor of Technology - BTech',
      degreeUrn: 'urn:li:fsd_degree:250',
      fieldOfStudy: 'Information Technology',
      standardizedFieldOfStudyUrn: 'urn:li:fsd_fieldOfStudy:100176',
      grade: '9.2',
      activities: 'ACM student chapter, competitive programming team',
      description: null,
      startDate: d(2020),
      endDate: d(2024),
    },
  ],
  skillNames: [
    'Python (Programming Language)',
    'Go',
    'Distributed Systems',
    'Kubernetes',
    'gRPC',
    'PostgreSQL',
    'Redis',
    'Observability',
    'System Design',
    'CDN Architecture',
    'Terraform',
    'CI/CD',
  ],
});

ritikSde.projects = [
  {
    entityUrn: 'urn:li:fsd_profileProject:mock-1',
    title: 'Autonomous Curriculum Agent',
    description:
      'An agent that reads a syllabus PDF and produces a week-by-week study plan with generated practice sets. Runs locally against an open-weights model.',
    url: 'https://github.com/example/curriculum-agent',
    startDate: d(2025, 2),
    endDate: d(2025, 6),
    contributors: ['urn:li:fsd_profile:MOCKRJ'],
  },
  {
    entityUrn: 'urn:li:fsd_profileProject:mock-2',
    title: 'edge-trace',
    description: 'A tiny distributed tracing shim for edge workers, under 4 kB gzipped.',
    url: null,
    startDate: d(2024, 11),
    endDate: d(null),
    contributors: [],
  },
];

ritikSde.certifications = [
  {
    entityUrn: 'urn:li:fsd_profileCertification:mock-1',
    name: 'Certified Kubernetes Application Developer (CKAD)',
    authority: 'The Linux Foundation',
    licenseNumber: 'LF-CKAD-2451',
    url: 'https://training.linuxfoundation.org/',
    startDate: d(2025, 3),
    endDate: d(2028, 3),
  },
  {
    entityUrn: 'urn:li:fsd_profileCertification:mock-2',
    name: 'AWS Certified Solutions Architect – Associate',
    authority: 'Amazon Web Services',
    licenseNumber: null,
    url: null,
    startDate: d(2024, 9),
    endDate: null,
  },
];

ritikSde.languages = [
  { entityUrn: 'urn:li:fsd_profileLanguage:1', name: 'English', proficiency: 'Full professional' },
  { entityUrn: 'urn:li:fsd_profileLanguage:2', name: 'Hindi', proficiency: 'Native or bilingual' },
  { entityUrn: 'urn:li:fsd_profileLanguage:3', name: 'German', proficiency: 'Elementary' },
];

ritikSde.courses = [
  { entityUrn: 'urn:li:fsd_profileCourse:1', name: 'Distributed Systems', number: 'CS-6.824' },
  { entityUrn: 'urn:li:fsd_profileCourse:2', name: 'Compiler Design', number: 'IT-402' },
];

ritikSde.publications = [
  {
    entityUrn: 'urn:li:fsd_profilePublication:1',
    name: 'Request Coalescing at the Edge: A Practical Retrospective',
    publisher: 'ACM Queue',
    description:
      'What broke when we coalesced cache-fill requests across 340 edge regions, and the three invariants that made it safe.',
    url: 'https://queue.acm.org/',
    date: d(2026, 4),
  },
];

ritikSde.honors = [
  {
    entityUrn: 'urn:li:fsd_profileHonor:1',
    title: 'Akamai Spotlight Award',
    issuer: 'Akamai Technologies',
    description: 'For the purge fan-out rewrite.',
    issueDate: d(2026, 2),
  },
  {
    entityUrn: 'urn:li:fsd_profileHonor:2',
    title: 'Smart India Hackathon — National Finalist',
    issuer: 'Government of India',
    description: null,
    issueDate: d(2023, 8),
  },
];

ritikSde.volunteerExperience = [
  {
    entityUrn: 'urn:li:fsd_profileVolunteer:1',
    role: 'Mentor',
    companyName: 'Girls Who Code',
    cause: 'Science and Technology',
    description: 'Weekly mentoring for a cohort of twelve first-year undergraduates.',
    startDate: d(2024, 1),
    endDate: d(null),
  },
];

ritikSde.patents = [
  {
    entityUrn: 'urn:li:fsd_profilePatent:1',
    title: 'Method for coalescing concurrent cache-fill requests in a distributed edge network',
    number: 'US 12,345,678',
    description: null,
    url: null,
    issueDate: d(2026, 5),
  },
];

ritikSde.organizations = [
  {
    entityUrn: 'urn:li:fsd_profileOrganization:1',
    name: 'ACM',
    position: 'Student chapter secretary',
    description: null,
    startDate: d(2022, 8),
    endDate: d(2024, 5),
  },
];

const ritikJoshi: Lead = seedLead({
  username: 'ritikjoshi',
  firstName: 'Ritik',
  lastName: 'Joshi',
  headline: 'Founding Engineer at Loopwork · ex-Razorpay',
  city: 'Bengaluru',
  country: 'India',
  industry: 'Internet',
  hue: 188,
  openToWork: false,
  premium: true,
  followerCount: 1120,
  summary:
    'Third engineer at Loopwork. I mostly build payment plumbing and the boring reliability work that keeps it upright.',
  lastSeenMinutesAgo: 52,
  refreshCount: 1,
  experience: [
    role({
      title: 'Founding Engineer',
      companyName: 'Loopwork',
      companySlug: 'loopwork',
      companyUrl: 'https://www.linkedin.com/company/loopwork/',
      companyIndustry: 'Internet',
      employmentType: 'Full-time',
      location: 'Bengaluru, India',
      startDate: d(2025, 1),
      current: true,
      description: 'Payments, ledgers, and the reconciliation pipeline. Took settlement mismatches from 1.4% to under 0.05%.',
    }),
    role({
      title: 'Senior Software Engineer',
      companyName: 'Razorpay',
      companySlug: 'razorpay',
      companyUrl: 'https://www.linkedin.com/company/razorpay/',
      employmentType: 'Full-time',
      location: 'Bengaluru, India',
      startDate: d(2021, 6),
      endDate: d(2024, 12),
      current: false,
      description: 'Subscriptions and recurring mandates. On-call for the billing path.',
    }),
  ],
  education: [
    {
      entityUrn: 'urn:li:fsd_profileEducation:mock-2',
      schoolName: 'Delhi Technological University',
      schoolId: '15464',
      schoolUrn: null,
      schoolSlug: null,
      schoolUrl: null,
      schoolLogo: null,
      degree: 'B.E.',
      degreeUrn: null,
      fieldOfStudy: 'Computer Engineering',
      standardizedFieldOfStudyUrn: null,
      grade: null,
      activities: null,
      description: null,
      startDate: d(2017),
      endDate: d(2021),
    },
  ],
  skillNames: ['Java', 'Kotlin', 'Payments', 'MySQL', 'Kafka', 'Spring Boot', 'Ledger Design'],
});

const others: Lead[] = [
  seedLead({
    username: 'rohit-paneru',
    firstName: 'Rohit',
    lastName: 'Paneru',
    headline: 'Data Engineer at Swiggy',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Internet',
    hue: 262,
    lastSeenMinutesAgo: 140,
    followerCount: 640,
    experience: [
      role({
        title: 'Data Engineer',
        companyName: 'Swiggy',
        companySlug: 'swiggy',
        employmentType: 'Full-time',
        location: 'Bengaluru, India',
        startDate: d(2024, 3),
        current: true,
        description: 'Streaming pipelines for delivery ETA models.',
      }),
    ],
    skillNames: ['Spark', 'Airflow', 'dbt', 'Python (Programming Language)'],
  }),
  seedLead({
    username: 'aditya-krishnan',
    firstName: 'Aditya',
    lastName: 'Krishnan',
    headline: 'Frontend Engineer · React, TypeScript',
    city: 'Pune',
    country: 'India',
    industry: 'Computer Software',
    hue: 154,
    openToWork: true,
    lastSeenMinutesAgo: 320,
    experience: [
      role({
        title: 'Frontend Engineer',
        companyName: 'Postman',
        companySlug: 'postman',
        employmentType: 'Full-time',
        location: 'Bengaluru, India',
        startDate: d(2023, 9),
        current: true,
      }),
    ],
    skillNames: ['React', 'TypeScript', 'Vite', 'Accessibility'],
  }),
  seedLead({
    username: 'priya-nair-pm',
    firstName: 'Priya',
    lastName: 'Nair',
    headline: 'Group Product Manager at Freshworks',
    city: 'Chennai',
    country: 'India',
    industry: 'Computer Software',
    hue: 22,
    premium: true,
    lastSeenMinutesAgo: 1500,
    experience: [
      role({
        title: 'Group Product Manager',
        companyName: 'Freshworks',
        companySlug: 'freshworks',
        employmentType: 'Full-time',
        location: 'Chennai, India',
        startDate: d(2022, 4),
        current: true,
      }),
    ],
    skillNames: ['Product Management', 'B2B SaaS', 'Roadmapping'],
  }),
  seedLead({
    username: 'devansh-rao',
    firstName: 'Devansh',
    lastName: 'Rao',
    headline: 'SRE at Cloudflare',
    city: 'Austin',
    country: 'United States',
    industry: 'Internet',
    hue: 40,
    lastSeenMinutesAgo: 2600,
    experience: [
      role({
        title: 'Site Reliability Engineer',
        companyName: 'Cloudflare',
        companySlug: 'cloudflare',
        employmentType: 'Full-time',
        location: 'Austin, Texas',
        startDate: d(2021, 2),
        current: true,
      }),
    ],
    skillNames: ['Go', 'Prometheus', 'Incident Response'],
  }),
  seedLead({
    username: 'zoya-rahman',
    firstName: 'Zoya',
    lastName: 'Rahman',
    headline: 'Design Lead at Zepto',
    city: 'Mumbai',
    country: 'India',
    industry: 'Design',
    hue: 320,
    creator: true,
    premium: true,
    lastSeenMinutesAgo: 4300,
    experience: [
      role({
        title: 'Design Lead',
        companyName: 'Zepto',
        companySlug: 'zepto',
        employmentType: 'Full-time',
        location: 'Mumbai, India',
        startDate: d(2023, 1),
        current: true,
      }),
    ],
    skillNames: ['Product Design', 'Design Systems', 'Figma'],
  }),
  seedLead({
    username: 'karan-bhatt',
    firstName: 'Karan',
    lastName: 'Bhatt',
    headline: 'Engineering Manager at Atlassian',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Computer Software',
    hue: 200,
    lastSeenMinutesAgo: 6100,
    experience: [
      role({
        title: 'Engineering Manager',
        companyName: 'Atlassian',
        companySlug: 'atlassian',
        employmentType: 'Full-time',
        startDate: d(2022, 6),
        current: true,
      }),
    ],
    skillNames: ['Engineering Management', 'Hiring', 'Jira'],
  }),
  seedLead({
    username: 'meera-iyer',
    firstName: 'Meera',
    lastName: 'Iyer',
    headline: 'Machine Learning Engineer at Sarvam AI',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Artificial Intelligence',
    hue: 276,
    openToWork: true,
    lastSeenMinutesAgo: 8800,
    experience: [
      role({
        title: 'Machine Learning Engineer',
        companyName: 'Sarvam AI',
        companySlug: 'sarvam-ai',
        employmentType: 'Full-time',
        startDate: d(2024, 5),
        current: true,
      }),
    ],
    skillNames: ['PyTorch', 'LLM Fine-tuning', 'Speech Recognition'],
  }),
  seedLead({
    username: 'ananya.sharma',
    firstName: 'Ananya',
    lastName: 'Sharma',
    headline: 'Technical Recruiter · Hiring backend engineers',
    city: 'Gurugram',
    country: 'India',
    industry: 'Staffing and Recruiting',
    hue: 96,
    lastSeenMinutesAgo: 11000,
    experience: [
      role({
        title: 'Technical Recruiter',
        companyName: 'Groww',
        companySlug: 'groww',
        employmentType: 'Full-time',
        startDate: d(2023, 3),
        current: true,
      }),
    ],
    skillNames: ['Technical Recruiting', 'Sourcing'],
  }),
  seedLead({
    username: 'imran-sheikh',
    firstName: 'Imran',
    lastName: 'Sheikh',
    headline: 'Security Engineer at CRED',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Financial Services',
    hue: 348,
    lastSeenMinutesAgo: 14400,
    experience: [
      role({
        title: 'Security Engineer',
        companyName: 'CRED',
        companySlug: 'cred-club',
        employmentType: 'Full-time',
        startDate: d(2022, 11),
        current: true,
      }),
    ],
    skillNames: ['AppSec', 'Threat Modelling', 'Burp Suite'],
  }),
  seedLead({
    username: 'tanvi-desai',
    firstName: 'Tanvi',
    lastName: 'Desai',
    headline: 'Staff Engineer at Zerodha',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Financial Services',
    hue: 172,
    lastSeenMinutesAgo: 20000,
    refreshCount: 3,
    experience: [
      role({
        title: 'Staff Engineer',
        companyName: 'Zerodha',
        companySlug: 'zerodha',
        employmentType: 'Full-time',
        startDate: d(2020, 8),
        current: true,
      }),
    ],
    skillNames: ['Go', 'Postgres', 'Trading Systems'],
  }),
  seedLead({
    username: 'nikhil-verma-sde',
    firstName: 'Nikhil',
    lastName: 'Verma',
    headline: 'Backend Engineer at Meesho',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Internet',
    hue: 232,
    lastSeenMinutesAgo: 26000,
    experience: [
      role({
        title: 'Backend Engineer',
        companyName: 'Meesho',
        companySlug: 'meesho',
        employmentType: 'Full-time',
        startDate: d(2023, 7),
        current: true,
      }),
    ],
    skillNames: ['Java', 'Kafka', 'DynamoDB'],
  }),
];

/** Seed collection, ordered newest-seen first — the same order the API returns. */
export const MOCK_LEADS: Lead[] = [ritikSde, ritikJoshi, ...others];

/**
 * Usernames the mock backend treats as unreachable on LinkedIn, so error paths
 * can be exercised without a real network.
 *
 * `sneha-kapoor-pm` is in the demo spreadsheet on purpose: importing that file
 * in mock mode then produces already-existing, newly-created *and* failed rows.
 */
export const MOCK_LINKEDIN_FAILURES: Record<string, string> = {
  'bad-user-404': 'LINKEDIN_PROFILE_NOT_FOUND',
  'rate-limited': 'LINKEDIN_RATE_LIMITED',
  'auth-error': 'LINKEDIN_AUTH_ERROR',
  'sneha-kapoor-pm': 'LINKEDIN_PROFILE_NOT_FOUND',
};

/** Usernames used when a mock import receives a binary .xlsx it cannot parse. */
export const MOCK_DEMO_USERNAMES = [
  'ritik-sde',
  'ritikjoshi',
  'rohit-paneru',
  'aarav-mehta-dev',
  'sneha-kapoor-pm',
];

/** Synthesises a plausible new lead for a username the fixtures do not know. */
export function synthesiseLead(username: string): Lead {
  const words = username.split(/[.\-_]+/).filter(Boolean);
  const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
  const firstName = capitalise(words[0] ?? username);
  const lastName = capitalise(words[1] ?? 'Kumar');
  const hue = (username.length * 47) % 360;

  return seedLead({
    username,
    firstName,
    lastName,
    headline: 'Software Engineer',
    city: 'Bengaluru',
    country: 'India',
    industry: 'Computer Software',
    hue,
    lastSeenMinutesAgo: 0,
    followerCount: 120 + (username.length * 13),
    summary: null,
    experience: [
      role({
        title: 'Software Engineer',
        companyName: 'Independent',
        employmentType: 'Full-time',
        location: 'Bengaluru, India',
        startDate: d(2024, 1),
        current: true,
        description: null,
      }),
    ],
    skillNames: ['JavaScript', 'Node.js', 'SQL'],
  });
}
