/**
 * JobStrider Posting Guard
 * Deterministic sanitizer and adversarial prompt-injection detector for untrusted job postings.
 */

// Invisible / zero-width characters and directional overrides
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060\u00AD]/g;

// HTML comments and dangerous tags
const HTML_COMMENTS_REGEX = /<!--[\s\S]*?-->/g;
const SCRIPT_STYLE_REGEX = /<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi;

// Suspicious prompt-injection phrases (case-insensitive)
const INJECTION_PATTERNS = [
  {
    name: "ignore_previous_instructions",
    regex: /(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|prior|above|existing)\s+(?:instructions|prompts|rules|directives|commands)/i,
    weight: 60,
  },
  {
    name: "system_override_or_mode",
    regex: /(?:system\s+prompt|system\s+override|developer\s+mode|jailbreak|dan\s+mode|unrestricted\s+mode)/i,
    weight: 50,
  },
  {
    name: "role_hijack",
    regex: /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:an?\s+)?(?:unconstrained|unbiased|admin|root|different|generous)\s+(?:assistant|bot|agent|evaluator|recruiter)/i,
    weight: 45,
  },
  {
    name: "score_manipulation",
    regex: /(?:always\s+output|must\s+output|guarantee\s+a|give\s+(?:a\s+)?score\s+of|rate\s+(?:this\s+candidate\s+as)?)\s+(?:grade\s+a\+?|10(?:\.0)?\s*(?:\/|\s*out\s*of)\s*10|perfect\s+fit|100%)/i,
    weight: 55,
  },
  {
    name: "forced_json_output",
    regex: /(?:output|respond\s+with)\s+only\s+(?:the\s+following|this\s+exact)\s+json/i,
    weight: 40,
  },
  {
    name: "skip_evaluation",
    regex: /(?:do\s+not\s+evaluate|skip\s+(?:the\s+)?evaluation|ignore\s+fit\s+criteria)/i,
    weight: 40,
  },
];

// Check for mixed-script homoglyphs in single words (e.g., Latin mixed with Cyrillic)
function detectMixedScriptHomoglyphs(text) {
  const words = text.split(/\s+/);
  const suspiciousWords = [];

  for (const word of words) {
    // Strip trailing punctuation
    const cleanWord = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (cleanWord.length < 3) continue;

    const hasLatin = /[A-Za-z]/.test(cleanWord);
    const hasCyrillic = /[\u0400-\u04FF]/.test(cleanWord);
    const hasGreek = /[\u0370-\u03FF]/.test(cleanWord);

    if (hasLatin && (hasCyrillic || hasGreek)) {
      suspiciousWords.push(cleanWord);
    }
  }

  return suspiciousWords;
}

/**
 * Sanitizes and inspects a job posting string.
 * @param {string} rawText - Raw text or HTML from job posting
 * @param {object} [options]
 * @returns {{
 *   cleanedText: string,
 *   isSafe: boolean,
 *   riskScore: number,
 *   flags: string[],
 *   details: object
 * }}
 */
export function sanitizePosting(rawText, options = {}) {
  if (!rawText || typeof rawText !== "string") {
    return {
      cleanedText: "",
      isSafe: true,
      riskScore: 0,
      flags: [],
      details: {},
    };
  }

  const flags = [];
  let riskScore = 0;
  const details = {};

  // 1. Check for invisible / zero-width characters
  const invisibleMatches = rawText.match(INVISIBLE_CHARS_REGEX);
  if (invisibleMatches && invisibleMatches.length > 0) {
    flags.push(`invisible_characters:${invisibleMatches.length}`);
    riskScore += Math.min(30, invisibleMatches.length * 5);
    details.invisibleCharCount = invisibleMatches.length;
  }

  // 2. Check for hidden HTML comments
  const commentMatches = rawText.match(HTML_COMMENTS_REGEX);
  if (commentMatches && commentMatches.length > 0) {
    flags.push(`html_comments:${commentMatches.length}`);
    riskScore += Math.min(25, commentMatches.length * 10);
    details.htmlCommentCount = commentMatches.length;
  }

  // 3. Check for mixed-script homoglyphs
  const homoglyphs = detectMixedScriptHomoglyphs(rawText);
  if (homoglyphs.length > 0) {
    flags.push(`mixed_script_homoglyphs:${homoglyphs.length}`);
    riskScore += Math.min(35, homoglyphs.length * 15);
    details.homoglyphs = homoglyphs.slice(0, 5);
  }

  // 4. Clean text: remove invisible chars, comments, scripts, styles
  let cleanedText = rawText
    .replace(SCRIPT_STYLE_REGEX, " ")
    .replace(HTML_COMMENTS_REGEX, " ")
    .replace(INVISIBLE_CHARS_REGEX, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r?\n\s*\r?\n/g, "\n\n")
    .trim();

  // 5. Scan cleaned text for prompt injection signatures
  const matchedInjections = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(cleanedText)) {
      matchedInjections.push(pattern.name);
      flags.push(`injection_detected:${pattern.name}`);
      riskScore += pattern.weight;
    }
  }

  if (matchedInjections.length > 0) {
    details.matchedInjections = matchedInjections;
  }

  // Cap risk score between 0 and 100
  riskScore = Math.min(100, Math.max(0, riskScore));
  const isSafe = riskScore < 50;

  return {
    cleanedText,
    isSafe,
    riskScore,
    flags,
    details,
  };
}

export default {
  sanitizePosting,
};
