import { spawnSync } from "node:child_process";
import { BaseScraper } from "./base.mjs";
import { isJobTitleValid, isJobUrlValid } from "../../jobIdentity.mjs";
import { isLocationFit } from "../services/locationService.mjs";
import { pushIfExperienceFit, stripHtml } from "../services/jobFilterService.mjs";
import { sanitizePosting } from "../security/postingGuard.mjs";
import { passesAutoQuickFilter } from "../../scan-evaluate.mjs";
import { HEALTH } from "../../health.mjs";
import logger from "../../logger.mjs";

/**
 * Checks if the agent-reach CLI is installed and runnable on the system.
 * @returns {boolean}
 */
export function isAgentReachAvailable() {
  try {
    const res = spawnSync("agent-reach", ["--help"], {
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
      timeout: 8000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Parses company, role, and location from agent-reach LinkedIn item.
 * @param {object} item - Single item from agent-reach JSON
 * @returns {{ company: string, role: string, location: string }}
 */
export function parseLinkedInJobMetadata(item = {}) {
  const rawTitle = String(item.title || "").trim();
  const rawText = String(item.text || "").trim();

  let company = "Tech Company";
  let role = "Software Engineer";
  let location = "Remote";

  // Try parsing from title: "<Company> hiring <Role> in <Location> | LinkedIn"
  const hiringMatch = rawTitle.match(/^(.*?)\s+hiring\s+(.*?)(?:\s+in\s+([^|]+))?(?:\s*\|\s*LinkedIn)?$/i);
  if (hiringMatch) {
    company = hiringMatch[1].trim();
    role = hiringMatch[2].trim();
    if (hiringMatch[3]) location = hiringMatch[3].trim();
  } else {
    // Try parsing from title: "<Role> at <Company> in <Location>"
    const atMatch = rawTitle.match(/^(.*?)\s+at\s+([^|]+?)(?:\s+in\s+([^|]+))?(?:\s*\|\s*LinkedIn)?$/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
      if (atMatch[3]) location = atMatch[3].trim();
    }
  }

  // Fallback to text parsing if title parsing was partial
  if (rawText.startsWith("#")) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const headerRole = lines[0]?.replace(/^#+\s*/, "").trim();
    if (headerRole && (role === "Software Engineer" || role.length > headerRole.length)) {
      role = headerRole;
    }
    if (lines[1] && company === "Tech Company") {
      const parts = lines[1].split(/\s{2,}|\s+in\s+/);
      if (parts[0]) company = parts[0].trim();
      if (parts[1]) location = parts[1].trim();
    }
  }

  return { company, role, location };
}

/**
 * Parses company, role, and location from agent-reach Foundit (Monster India) item.
 * @param {object} item - Single item from agent-reach JSON
 * @returns {{ company: string, role: string, location: string }}
 */
export function parseFounditJobMetadata(item = {}) {
  const rawTitle = String(item.title || "").trim();
  const rawText = String(item.text || "").trim();

  let company = "Tech Company";
  let role = "Software Engineer";
  let location = "India";

  const atIdx = rawTitle.toLowerCase().lastIndexOf(" at ");
  const inIdx = rawTitle.toLowerCase().lastIndexOf(" in ");
  if (atIdx > 0) {
    let rolePart = rawTitle.slice(0, atIdx).trim();
    rolePart = rolePart.replace(/\s+with\s+[\d\s\-–+]+years?\s+(?:of\s+)?experience/i, "").trim();
    if (rolePart) role = rolePart;
    if (inIdx > atIdx) {
      company = rawTitle.slice(atIdx + 4, inIdx).trim();
      location = rawTitle.slice(inIdx + 4).trim();
    } else {
      company = rawTitle.slice(atIdx + 4).trim();
    }
  } else {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines[0]?.startsWith("#")) role = lines[0].replace(/^#+\s*/, "").trim();
    if (lines[1]) company = lines[1].trim();
    if (lines[2]) location = lines[2].trim();
  }

  return { company, role, location };
}

/**
 * Parses company, role, and location from agent-reach Indeed India item.
 * @param {object} item - Single item from agent-reach JSON
 * @returns {{ company: string, role: string, location: string }}
 */
export function parseIndeedJobMetadata(item = {}) {
  const rawTitle = String(item.title || "").trim();
  const rawText = String(item.text || "").trim();

  let company = "Tech Company";
  let role = "Software Engineer";
  let location = "India";

  const cleanTitle = rawTitle.replace(/\s*-\s*Indeed\.com$/i, "").trim();
  const parts = cleanTitle.split(/\s*-\s*/);
  if (parts.length >= 2) {
    role = parts[0].trim();
    location = parts[parts.length - 1].trim();
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hashIdx = lines.findIndex((l) => l.startsWith("#"));
  if (hashIdx >= 0 && lines[hashIdx + 1] && !lines[hashIdx + 1].startsWith("#")) {
    company = lines[hashIdx + 1].trim();
    if (lines[hashIdx + 2] && !lines[hashIdx + 2].startsWith("#") && !lines[hashIdx + 2].includes("₹")) {
      location = lines[hashIdx + 2].trim();
    }
  }

  return { company, role, location };
}

export class AgentReachScraper extends BaseScraper {
  constructor(platform = "linkedin") {
    const nameMap = {
      linkedin: "AgentReach_LinkedIn",
      foundit: "AgentReach_Foundit",
      indeed: "AgentReach_Indeed",
    };
    super(nameMap[platform] || `AgentReach_${platform}`);
    this.platform = platform;
  }

  /**
   * Executes the agent-reach CLI safely and parses JSON output.
   * @param {Array<string>} args - CLI arguments
   * @returns {object|null}
   */
  runCli(args = []) {
    try {
      const result = spawnSync("agent-reach", args, {
        stdio: "pipe",
        encoding: "utf8",
        shell: false,
        timeout: 30000,
      });

      if (result.status !== 0 || !result.stdout) {
        logger.warn(`agent-reach CLI exited with status ${result.status}: ${result.stderr?.slice(0, 150)}`);
        return null;
      }

      return JSON.parse(result.stdout.trim());
    } catch (err) {
      logger.warn(`Failed to execute agent-reach CLI: ${err.message}`);
      return null;
    }
  }

  /**
   * Scans LinkedIn for matching positions using agent-reach CLI.
   * @param {Array<string>} keywords - Target keywords
   * @param {object} config - User config
   * @param {object} experienceProfile - Candidate experience profile
   * @returns {Promise<Array<object>>} Normalized job listings
   */
  async scan(keywords = [], config = {}, experienceProfile = { years: 0, level: "fresher" }) {
    const results = [];
    const stats = {
      total: 0,
      success: 0,
      matched: 0,
      noBoard: 0,
      blocked: 0,
      rateLimited: 0,
      errors: 0,
      rawCount: 0,
    };

    const platformLabel =
      this.platform === "foundit"
        ? "Foundit (Monster India)"
        : this.platform === "indeed"
        ? "Indeed India"
        : "LinkedIn";

    logger.info(`\nAgent Reach — ${platformLabel} Discovery`);

    const isAvail = typeof this.isAvailable === "function" ? this.isAvailable() : isAgentReachAvailable();
    if (!isAvail) {
      logger.info(`   ℹ agent-reach CLI not found on system path. Skipping Agent Reach ${platformLabel} discovery.`);
      results.rawCount = 0;
      results.healthStatus = HEALTH.SKIPPED;
      return results;
    }

    const queryKeywords = keywords.length > 0 ? keywords.slice(0, 3) : ["Software Engineer"];
    const targetLocations = config.target_locations || ["Remote", "India"];
    const primaryLocation = targetLocations.find((l) => /remote/i.test(l)) || targetLocations[0] || "Remote";
    const limitPerQuery = Math.max(2, Math.min(10, Math.floor(15 / queryKeywords.length)));

    stats.total = queryKeywords.length;

    for (const kw of queryKeywords) {
      try {
        logger.info(`   Querying ${platformLabel} for "${kw}" (${primaryLocation})...`);
        let args = [];
        if (this.platform === "foundit") {
          args = ["web", "search", `site:foundit.in ${kw} ${primaryLocation}`, "--limit", String(limitPerQuery)];
        } else if (this.platform === "indeed") {
          args = ["web", "search", `site:in.indeed.com/viewjob ${kw} ${primaryLocation}`, "--limit", String(limitPerQuery)];
        } else {
          args = ["linkedin", "jobs", kw, "--location", primaryLocation, "--limit", String(limitPerQuery)];
        }
        const data = this.runCli(args);

        if (!data || !data.ok) {
          if (data?.error?.code === "RATE_LIMITED") stats.rateLimited += 1;
          else if (data?.error?.code === "PLATFORM_BLOCKED") stats.blocked += 1;
          else stats.errors += 1;
          continue;
        }

        stats.success += 1;
        const items = Array.isArray(data.items) ? data.items : [];
        stats.rawCount += items.length;

        for (const item of items) {
          const { company, role, location } =
            this.platform === "foundit"
              ? parseFounditJobMetadata(item)
              : this.platform === "indeed"
              ? parseIndeedJobMetadata(item)
              : parseLinkedInJobMetadata(item);
          const url = item.url || item.raw?.source?.url || "";
          const rawContent = item.text || "";
          const sanitized = sanitizePosting(stripHtml(rawContent)).cleanedText;

          if (!role || !url || !isJobTitleValid(role) || !isJobUrlValid(url)) {
            continue;
          }

          if (!isLocationFit(location, config)) {
            continue;
          }

          const candidateJob = {
            source: this.platform === "foundit" ? "foundit" : this.platform === "indeed" ? "indeed" : "reach_linkedin",
            company,
            role,
            url,
            location,
            salary: null,
            experience: "0-2 years",
            content: sanitized.slice(0, 1200),
            status: "pending",
            discovered_at: new Date().toISOString(),
          };

          if (!passesAutoQuickFilter(candidateJob, config)) {
            continue;
          }

          pushIfExperienceFit(results, candidateJob, experienceProfile, config);
        }
      } catch (err) {
        stats.errors += 1;
        logger.warn(`   skip (${kw}: ${err.message})`);
      }
    }

    stats.matched = results.length;
    logger.info(`   ✔ Matched ${results.length} ${platformLabel} jobs out of ${stats.rawCount} retrieved items.`);

    results.rawCount = stats.rawCount;
    results.healthStatus = this.summarize(stats);
    return results;
  }
}

export default AgentReachScraper;
