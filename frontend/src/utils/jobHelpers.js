export function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
}

export function getGradeLabel(grade) {
  switch (String(grade || '').toUpperCase()) {
    case 'A':
      return 'Great Match';
    case 'B':
      return 'Good Match';
    case 'C':
      return 'Partial Match';
    case 'D':
      return 'Stretch Role';
    case 'F':
      return 'Low Match';
    default:
      return 'Evaluated';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'evaluated':
    case 'discovered':
    case 'new':
      return 'To Apply';
    case 'applied':
      return 'Applied';
    case 'interview':
      return 'Interviewing';
    case 'offer':
      return 'Offer';
    case 'skipped':
      return 'Skipped';
    default:
      return status || 'To Apply';
  }
}

export const STATUS_OPTIONS = [
  { value: 'evaluated', label: 'To Apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'skipped', label: 'Skipped' }
];

export const PRESET_ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Analyst',
  'Python Developer',
  'Java Developer',
  'QA Engineer',
  'Product Intern'
];

export const PRESET_LOCATIONS = [
  'Remote',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Delhi NCR',
  'Mumbai',
  'Chennai',
  'India'
];

export const JOB_BOARDS = [
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    group: 'fast',
    description: 'Startups & product companies'
  },
  {
    id: 'lever',
    label: 'Lever',
    group: 'fast',
    description: 'Tech & SaaS teams'
  },
  {
    id: 'ashby',
    label: 'Ashby',
    group: 'fast',
    description: 'Modern fast-growing startups'
  },
  {
    id: 'freehire',
    label: 'FreeHire Remote',
    group: 'fast',
    description: 'Global remote tech roles'
  },
  {
    id: 'reach_linkedin',
    label: 'LinkedIn (via Agent Reach)',
    group: 'reach',
    description: 'Direct LinkedIn listings without browser or login'
  },
  {
    id: 'careers_page',
    label: 'Company Career Pages',
    group: 'fast',
    description: 'Direct engineering portals'
  },
  {
    id: 'internshala',
    label: 'Internshala',
    group: 'browser',
    description: 'India internships & fresher roles'
  },
  {
    id: 'naukri',
    label: 'Naukri',
    group: 'browser',
    description: 'Indian tech openings'
  },
  {
    id: 'foundit',
    label: 'Foundit (Monster India)',
    group: 'reach',
    description: 'Mid-to-large Indian tech firms'
  },
  {
    id: 'indeed',
    label: 'Indeed India',
    group: 'reach',
    description: 'Wide coverage across Indian tech hubs'
  },
  {
    id: 'wellfound',
    label: 'Wellfound',
    group: 'browser',
    description: 'Startup ecosystem roles'
  }
];
