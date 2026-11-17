/**
 * JobStrider Interview Preparation Engine
 * Generates role-specific prep packs, STAR behavioral stories, technical deep dives,
 * and skill gap bridge answers grounded in the candidate's verified CV.
 */

import { callLLM } from "../../llm/llmClient.mjs";
import { getCompactCVProfile } from "../../llm/evalPrompt.mjs";
import { sanitizePosting } from "../security/postingGuard.mjs";

/**
 * Builds the LLM prompt for generating structured interview prep data.
 */
export function buildInterviewPrepPrompt(job, cvText) {
  const sanitizedContent = job.content ? sanitizePosting(String(job.content).slice(0, 1200)).cleanedText : "Not specified";
  const gapsText = (job.gaps || []).join(", ") || "None specified";
  const strengthsText = (job.strengths || []).join(", ") || "Technical foundation";

  return `You are an elite tech interview coach for software engineering candidates in India.

Prepare a comprehensive, stage-ready INTERVIEW PREPARATION DOSSIER for the candidate.

CANDIDATE CV PROFILE:
${cvText}

TARGET JOB DETAILS:
Company: ${job.company || "Target Company"}
Role: ${job.role || "Software Engineer"}
Location: ${job.location || "India"}
Job Description Details: ${sanitizedContent}
Identified Strengths: ${strengthsText}
Identified Gaps: ${gapsText}

CRITICAL RULES:
1. Every STAR story MUST be grounded in the candidate's actual projects, technologies, and achievements from the CV. DO NOT invent previous employers, degrees, or fake metrics.
2. For "gapBridges", provide honest, authentic bridge answers that connect the candidate's real experience to the missing requirement without lying.
3. Keep technical questions practical, modern, and aligned with the role's stack.

Respond ONLY with valid JSON (no markdown fences, no extra text):
{
  "company_overview": "1-2 sentences on company culture and what this engineering team values",
  "role_mission": "1-2 sentences describing the core mission of this role",
  "behavioral_questions": [
    {
      "question": "Behavioral question prompt",
      "target_competency": "Ownership / Problem-solving / Teamwork",
      "star_story": {
        "situation": "Specific project context from CV",
        "task": "The concrete challenge or goal",
        "action": "Actionable technical steps taken by the candidate",
        "result": "Measurable outcome or key impact"
      }
    }
  ],
  "technical_questions": [
    {
      "topic": "Technology or concept (e.g. PostgreSQL indexing)",
      "question": "Realistic technical question",
      "key_talking_points": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "gap_bridges": [
    {
      "missing_skill": "Skill from JD",
      "suggested_bridge": "Honest answer connecting existing knowledge to this skill"
    }
  ],
  "questions_for_interviewer": [
    "Thoughtful question 1 to ask the engineering manager",
    "Thoughtful question 2 about architecture or roadmap"
  ]
}`;
}

/**
 * Generates an interview prep dossier for a given job and CV.
 * @param {object} job - Target job record
 * @param {string} cvText - Candidate's markdown CV
 * @param {object} [options]
 * @param {object} [options.config] - Global config object
 * @returns {Promise<object>} Parsed interview prep data
 */
export async function generateInterviewPrep(job, cvText, options = {}) {
  const compactCV = getCompactCVProfile(cvText) || cvText;
  const prompt = buildInterviewPrepPrompt(job, compactCV);

  const raw = await callLLM("interview_prep", [{ role: "user", content: prompt }], {
    config: options.config,
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseFormat: { type: "json_object" },
    allowGroqFallback: true,
  });

  const rawText = raw?.text || String(raw);
  const cleanJson = rawText.replace(/```json\n?|```\n?/g, "").trim();
  const data = JSON.parse(cleanJson);

  return {
    ...data,
    generatedAt: new Date().toISOString(),
    jobId: job.id || null,
    company: job.company,
    role: job.role,
  };
}

/**
 * Renders structured interview prep data into a clean, printable Markdown document.
 */
export function renderInterviewPrepMarkdown(prepData, job = {}, candidateName = "Candidate") {
  const company = prepData.company || job.company || "Target Company";
  const role = prepData.role || job.role || "Software Role";

  let md = `# Interview Preparation Pack: ${company} — ${role}\n`;
  md += `**Candidate:** ${candidateName} | **Date:** ${new Date().toLocaleDateString()}\n\n`;

  md += `## 🏢 Company & Role Overview\n`;
  md += `- **Company Context:** ${prepData.company_overview || "High-growth tech team."}\n`;
  md += `- **Role Mission:** ${prepData.role_mission || "Drive scalable software deliverables."}\n\n`;

  md += `## 🌟 Behavioral Q&A (STAR Stories)\n`;
  (prepData.behavioral_questions || []).forEach((bq, i) => {
    md += `### ${i + 1}. "${bq.question}"\n`;
    md += `*Target Competency: ${bq.target_competency || "Engineering Rigor"}*\n\n`;
    if (bq.star_story) {
      md += `- **Situation:** ${bq.star_story.situation}\n`;
      md += `- **Task:** ${bq.star_story.task}\n`;
      md += `- **Action:** ${bq.star_story.action}\n`;
      md += `- **Result:** ${bq.star_story.result}\n\n`;
    }
  });

  md += `## 💻 Core Technical Deep Dives\n`;
  (prepData.technical_questions || []).forEach((tq, i) => {
    md += `### ${i + 1}. [${tq.topic}] ${tq.question}\n`;
    (tq.key_talking_points || []).forEach((pt) => {
      md += `- ${pt}\n`;
    });
    md += `\n`;
  });

  if (prepData.gap_bridges && prepData.gap_bridges.length > 0) {
    md += `## 🌉 Skill Gap Bridges (Honest Responses)\n`;
    prepData.gap_bridges.forEach((gb) => {
      md += `### Q: "Do you have experience with ${gb.missing_skill}?"\n`;
      md += `> "${gb.suggested_bridge}"\n\n`;
    });
  }

  if (prepData.questions_for_interviewer && prepData.questions_for_interviewer.length > 0) {
    md += `## ❓ Strategic Questions to Ask the Interviewer\n`;
    prepData.questions_for_interviewer.forEach((q) => {
      md += `- ${q}\n`;
    });
    md += `\n`;
  }

  return md;
}

export default {
  buildInterviewPrepPrompt,
  generateInterviewPrep,
  renderInterviewPrepMarkdown,
};
