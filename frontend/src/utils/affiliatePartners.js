/**
 * Skill-Gap Affiliate Recommendations & Partner Resource Engine
 * Maps candidate gap keywords to high-value learning courses and mock interviews.
 */

export const AFFILIATE_CATALOG = [
  {
    keywords: ['docker', 'kubernetes', 'k8s', 'container', 'devops'],
    title: 'Docker & Kubernetes Real-World Bootcamp',
    provider: 'Coursera / Partner',
    url: 'https://www.coursera.org/search?query=docker%20kubernetes',
    tag: 'DevOps & Containers',
    badge: 'Popular'
  },
  {
    keywords: ['aws', 'cloud', 'gcp', 'azure', 'serverless'],
    title: 'Cloud Engineering & AWS Practitioner Track',
    provider: 'Coursera / Partner',
    url: 'https://www.coursera.org/search?query=aws%20cloud',
    tag: 'Cloud Infrastructure',
    badge: 'High Demand'
  },
  {
    keywords: ['system design', 'distributed', 'microservices', 'architecture', 'scalab'],
    title: 'Complete System Design for SDE Interviews',
    provider: 'GeeksforGeeks / Partner',
    url: 'https://www.geeksforgeeks.org/courses/system-design-live',
    tag: 'Architecture & Scale',
    badge: 'Interview Critical'
  },
  {
    keywords: ['dsa', 'data structure', 'algorithm', 'leetcode', 'problem solving'],
    title: 'DSA Self-Paced Master Course',
    provider: 'GeeksforGeeks / Partner',
    url: 'https://www.geeksforgeeks.org/courses/dsa-self-paced',
    tag: 'Core DSA',
    badge: 'Top Pick'
  },
  {
    keywords: ['react', 'frontend', 'nextjs', 'next.js', 'typescript', 'javascript', 'vue'],
    title: 'Advanced React, TypeScript & Next.js Track',
    provider: 'Coursera / Partner',
    url: 'https://www.coursera.org/search?query=react%20typescript',
    tag: 'Modern Frontend',
    badge: 'Career Path'
  },
  {
    keywords: ['sql', 'database', 'postgres', 'postgresql', 'mongodb', 'redis'],
    title: 'Database Design & High-Performance SQL',
    provider: 'Coursera / Partner',
    url: 'https://www.coursera.org/search?query=sql%20database',
    tag: 'Database Engineering',
    badge: 'Practical'
  },
  {
    keywords: ['python', 'backend', 'django', 'fastapi', 'node', 'express'],
    title: 'Scalable Backend Development with Node & Python',
    provider: 'Coursera / Partner',
    url: 'https://www.coursera.org/search?query=backend%20development',
    tag: 'Backend Architecture',
    badge: 'Recommended'
  }
];

export function findMatchingAffiliateTracks(gaps = []) {
  if (!Array.isArray(gaps) || gaps.length === 0) return [];
  const text = gaps.join(' ').toLowerCase();
  const matched = [];
  for (const item of AFFILIATE_CATALOG) {
    if (item.keywords.some((kw) => text.includes(kw))) {
      matched.push(item);
    }
  }
  // Return at most 2 targeted cards so it never overwhelms the user
  return matched.slice(0, 2);
}

export const MOCK_INTERVIEW_PARTNER = {
  title: 'Book a 1-on-1 Mock Technical Interview with a Senior SDE',
  provider: 'Topmate Mentorship Network',
  url: 'https://topmate.io',
  tag: 'STAR Behavioral & Live Coding',
  description: 'Practice real technical questions, get instant feedback, and optimize your talking points before the actual interview.'
};
