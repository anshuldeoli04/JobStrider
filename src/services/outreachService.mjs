/**
 * JobStriver Outreach & Follow-Up Copilot
 * Identifies quiet/stale applications and drafts professional, non-generic
 * follow-up emails, LinkedIn recruiter connection notes, and cover notes.
 */

/**
 * Finds applications that have gone quiet without a status change.
 * @param {Array<object>} applications - List of application objects
 * @param {number} [daysThreshold=10] - Days without update to be considered stale
 * @returns {Array<object>} Applications needing follow-up
 */
export function findStaleApplications(applications = [], daysThreshold = 10) {
  const now = Date.now();
  const msThreshold = daysThreshold * 24 * 60 * 60 * 1000;

  return applications.filter((app) => {
    // Only track open applications
    const status = (app.status || "applied").toLowerCase();
    const isOpen = ["applied", "submitted", "screening", "pending"].includes(status);
    if (!isOpen) return false;

    // Check application date
    const dateStr = app.applied_at || app.date_applied || app.created_at || app.updated_at;
    if (!dateStr) return false;

    const appliedTime = new Date(dateStr).getTime();
    if (Number.isNaN(appliedTime)) return false;

    return now - appliedTime >= msThreshold;
  });
}

/**
 * Generates a concise, high-conversion follow-up email draft.
 * @param {object} params
 * @param {string} params.candidateName
 * @param {string} params.company
 * @param {string} params.role
 * @param {string} [params.submissionDate]
 * @param {string} [params.keyStrength]
 * @returns {{ subject: string, body: string }}
 */
export function generateFollowUpEmail({
  candidateName = "Candidate",
  company = "Company",
  role = "Software Engineer",
  submissionDate = "earlier this month",
  keyStrength = "",
}) {
  const subject = `Following up: ${role} Application — ${candidateName}`;
  const strengthLine = keyStrength
    ? ` I remain particularly excited about how my hands-on background in ${keyStrength} can contribute to your engineering goals.`
    : " I remain very enthusiastic about the opportunity to contribute to your engineering team.";

  const body = `Hi ${company} Hiring Team,

I hope you are having a productive week.

I am following up on my application for the ${role} position submitted ${submissionDate}.${strengthLine}

I would welcome the opportunity to connect for a brief conversation regarding how my technical skills and project experience align with your team's current roadmap.

Thank you very much for your time and consideration.

Warm regards,
${candidateName}`;

  return { subject, body };
}

/**
 * Generates a LinkedIn invitation message strictly constrained to LinkedIn's 300-char limit.
 * @param {object} params
 * @returns {string} Text message under 300 characters
 */
export function generateLinkedInNote({
  candidateName = "Candidate",
  company = "Company",
  role = "Software Engineer",
}) {
  const note = `Hi! I recently applied for the ${role} role at ${company}. I'm passionate about your engineering mission and would love to connect with your team. Best, ${candidateName}`;
  // Ensure strict <= 300 chars
  return note.slice(0, 300);
}

/**
 * Generates a clean 3-paragraph tailored cover note.
 */
export function generateCoverNote({
  candidateName = "Candidate",
  company = "Company",
  role = "Software Engineer",
  skills = [],
  fitSummary = "",
}) {
  const skillList = skills.slice(0, 4).join(", ") || "full-stack development";

  return `Dear ${company} Hiring Team,

I am writing to express my strong enthusiasm for the ${role} opening at ${company}. With a practical foundation in ${skillList}, I build reliable, high-performance software and am eager to bring this rigor to your engineering team.

${fitSummary ? fitSummary + " " : ""}Throughout my projects and technical work, I have focused on building clean, well-tested APIs, scalable architectures, and maintainable user experiences. I thrive in collaborative environments where performance, engineering ownership, and rapid iteration are prioritized.

I would love to discuss how my skill set and problem-solving approach can support ${company}'s upcoming milestones. Thank you for your time and review.

Sincerely,
${candidateName}`;
}

export default {
  findStaleApplications,
  generateFollowUpEmail,
  generateLinkedInNote,
  generateCoverNote,
};
