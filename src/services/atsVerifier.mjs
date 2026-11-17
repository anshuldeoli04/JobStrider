/**
 * JobStriver ATS Verifier
 * Audits compiled PDF resumes for ATS readability, extractable text layer,
 * contact detail integrity, clean glyph encoding, keyword match, and page budgeting.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Extracts plain text and page metadata from a PDF file using pdf-parse.
 * @param {string|Buffer} pdfInput - Absolute path to PDF file or Buffer
 * @returns {Promise<{ text: string, numPages: number, info: object }>}
 */
export async function extractPdfTextAndMetadata(pdfInput) {
  let buffer;
  if (typeof pdfInput === "string") {
    const fullPath = path.resolve(process.cwd(), pdfInput);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`PDF file not found: ${fullPath}`);
    }
    buffer = fs.readFileSync(fullPath);
  } else if (Buffer.isBuffer(pdfInput)) {
    buffer = pdfInput;
  } else {
    throw new Error("Invalid PDF input: expected file path or Buffer.");
  }

  let mod;
  try {
    mod = await import("pdf-parse");
  } catch {
    throw new Error("pdf-parse library not installed.");
  }

  const PDFParseClass = mod.PDFParse || mod.default?.PDFParse || (typeof mod.default === "function" ? mod.default : null);

  if (typeof PDFParseClass === "function" && PDFParseClass.prototype?.getText) {
    const parser = new PDFParseClass({ data: buffer });
    try {
      const data = await parser.getText();
      const text = (data?.text || "").trim();
      const numPages = data?.total || (text.split("\f").length) || 1;
      return { text, numPages, info: data?.info || {} };
    } finally {
      await parser.destroy?.();
    }
  } else if (typeof PDFParseClass === "function") {
    const data = await PDFParseClass(buffer);
    const text = (data?.text || "").trim();
    const numPages = data?.numpages || (text.split("\f").length) || 1;
    return { text, numPages, info: data?.info || {} };
  }

  throw new Error("Could not initialize parser from pdf-parse module.");
}

/**
 * Common technical keywords to extract from job descriptions.
 */
const COMMON_TECH_TERMS = [
  "javascript", "typescript", "python", "java", "c++", "c#", "golang", "rust", "php", "ruby", "sql",
  "react", "angular", "vue", "next.js", "node.js", "express", "fastapi", "django", "flask", "spring",
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
  "docker", "kubernetes", "aws", "gcp", "azure", "ci/cd", "git", "linux", "rest", "graphql", "microservices",
  "tailwind", "html", "css", "kafka", "rabbitmq"
];

/**
 * Extracts tech keywords present in a text string.
 */
export function extractKeywords(text = "") {
  const lower = String(text).toLowerCase();
  const found = new Set();
  for (const term of COMMON_TECH_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-z0-9#+])${escaped}(?:$|[^a-z0-9#+])`, "i");
    if (regex.test(lower)) {
      found.add(term);
    }
  }
  return Array.from(found);
}

/**
 * Audits a PDF's extractable plain text for ATS parseability and content quality.
 * @param {string|Buffer} pdfInput - Path to PDF file or Buffer
 * @param {object} [options]
 * @param {string} [options.jobDescription] - Job description text to compare keyword density against
 * @param {string} [options.candidateName] - Candidate's expected name
 * @returns {Promise<{
 *   atsScore: number,
 *   isSinglePage: boolean,
 *   pageCount: number,
 *   breakdown: {
 *     contactsScore: number,
 *     sectionsScore: number,
 *     glyphScore: number,
 *     keywordScore: number
 *   },
 *   detectedContacts: {
 *     hasEmail: boolean,
 *     email: string|null,
 *     hasPhone: boolean,
 *     phone: string|null,
 *     hasLinkedIn: boolean,
 *     hasGitHub: boolean
 *   },
 *   missingSections: string[],
 *   matchedKeywords: string[],
 *   missingKeywords: string[],
 *   flags: string[],
 *   recommendations: string[]
 * }>}
 */
export async function verifyPdfAts(pdfInput, options = {}) {
  const { text, numPages } = await extractPdfTextAndMetadata(pdfInput);
  const flags = [];
  const recommendations = [];

  // 1. Contact Info Verification (Max 25 pts)
  let contactsScore = 0;
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+91[-\s]?)?[6-9]\d{9}|\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  const hasLinkedIn = /linkedin\.com\/in\/|linkedin/i.test(text);
  const hasGitHub = /github\.com\/|github/i.test(text);

  if (emailMatch) contactsScore += 10;
  else {
    flags.push("missing_email");
    recommendations.push("Email address was not extractable in plain text from the PDF header.");
  }

  if (phoneMatch) contactsScore += 8;
  else {
    flags.push("missing_phone");
    recommendations.push("Phone number was not extractable in plain text from the PDF header.");
  }

  if (hasLinkedIn || hasGitHub) contactsScore += 7;
  else {
    recommendations.push("Add LinkedIn or GitHub profile link in header for recruiter verification.");
  }

  const detectedContacts = {
    hasEmail: Boolean(emailMatch),
    email: emailMatch ? emailMatch[0] : null,
    hasPhone: Boolean(phoneMatch),
    phone: phoneMatch ? phoneMatch[0] : null,
    hasLinkedIn,
    hasGitHub,
  };

  // 2. Section Headings Verification (Max 25 pts)
  let sectionsScore = 0;
  const expectedSections = [
    { name: "Summary", regex: /\b(summary|profile|about)\b/i, pts: 5 },
    { name: "Skills", regex: /\b(skills|technical skills|technologies)\b/i, pts: 8 },
    { name: "Projects", regex: /\b(projects|technical projects)\b/i, pts: 6 },
    { name: "Experience", regex: /\b(experience|work experience|employment|internships)\b/i, pts: 3 },
    { name: "Education", regex: /\b(education|academic background)\b/i, pts: 3 },
  ];

  const missingSections = [];
  for (const sec of expectedSections) {
    if (sec.regex.test(text)) {
      sectionsScore += sec.pts;
    } else {
      missingSections.push(sec.name);
    }
  }

  if (missingSections.length > 0) {
    flags.push(`missing_sections:${missingSections.join(",")}`);
    recommendations.push(`Standard ATS section header(s) not clearly found: ${missingSections.join(", ")}`);
  }

  // 3. Clean Glyph & Text Layer Quality (Max 20 pts)
  let glyphScore = 20;
  if (text.includes("\uFFFD")) {
    glyphScore -= 12;
    flags.push("corrupted_glyphs_detected");
    recommendations.push("PDF text layer contains corrupted Unicode glyphs (\\uFFFD). Check custom font icons.");
  }

  if (text.length < 350) {
    glyphScore -= 8;
    flags.push("sparse_text_layer");
    recommendations.push("Extracted text is very brief (< 350 characters); ensure resume content is sufficiently detailed.");
  }

  // 4. Keyword Match & Relevance (Max 30 pts)
  let keywordScore = 0;
  let matchedKeywords = [];
  let missingKeywords = [];

  const resumeKeywords = extractKeywords(text);

  if (options.jobDescription) {
    const jdKeywords = extractKeywords(options.jobDescription);
    if (jdKeywords.length > 0) {
      matchedKeywords = jdKeywords.filter((kw) => resumeKeywords.includes(kw));
      missingKeywords = jdKeywords.filter((kw) => !resumeKeywords.includes(kw));

      const matchRatio = matchedKeywords.length / jdKeywords.length;
      keywordScore = Math.round(matchRatio * 30);

      if (matchRatio < 0.4) {
        flags.push("low_jd_keyword_coverage");
        recommendations.push(`Low keyword match against job description (${Math.round(matchRatio * 100)}%). Key missing tools: ${missingKeywords.slice(0, 5).join(", ")}`);
      }
    } else {
      // No specific JD keywords identified; score by general tech breadth
      keywordScore = Math.min(30, resumeKeywords.length * 4);
      matchedKeywords = resumeKeywords;
    }
  } else {
    // Score based on detected technical keyword variety
    keywordScore = Math.min(30, resumeKeywords.length * 4);
    matchedKeywords = resumeKeywords;
  }

  // 5. Page Budget Analysis
  const isSinglePage = numPages === 1;
  const pages = text.split("\f");
  if (numPages === 2) {
    const page2Text = (pages[1] || "").trim();
    if (page2Text.length > 0 && page2Text.length < 300) {
      flags.push("orphan_page_spill");
      recommendations.push("Resume has an orphan spill onto page 2 (< 300 chars on second page). Consider trimming 1 bullet to fit on a single page.");
    }
  } else if (numPages > 2) {
    flags.push("excessive_page_count");
    recommendations.push(`Resume exceeds standard length (${numPages} pages). Compress to 1 or 2 pages max.`);
  }

  const atsScore = Math.min(100, Math.max(0, contactsScore + sectionsScore + glyphScore + keywordScore));

  return {
    atsScore,
    isSinglePage,
    pageCount: numPages,
    breakdown: {
      contactsScore,
      sectionsScore,
      glyphScore,
      keywordScore,
    },
    detectedContacts,
    missingSections,
    matchedKeywords,
    missingKeywords,
    flags,
    recommendations,
  };
}

export default {
  verifyPdfAts,
  extractPdfTextAndMetadata,
  extractKeywords,
};
