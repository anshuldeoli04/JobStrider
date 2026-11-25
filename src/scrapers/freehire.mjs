import { BaseScraper } from "./base.mjs";
import { isJobTitleValid, isJobUrlValid } from "../../jobIdentity.mjs";
import { isLocationFit } from "../services/locationService.mjs";
import { pushIfExperienceFit, stripHtml } from "../services/jobFilterService.mjs";
import { sanitizePosting } from "../security/postingGuard.mjs";
import { passesAutoQuickFilter } from "../../scan-evaluate.mjs";
import logger from "../../logger.mjs";

export class FreeHireScraper extends BaseScraper {
  constructor() {
    super("FreeHire");
  }

  /**
   * Scans FreeHire's open remote tech job aggregator API.
   * @param {Array<string>} keywords - Target job titles/keywords
   * @param {object} config - User config
   * @param {object} experienceProfile - Candidate experience profile
   * @returns {Promise<Array<object>>} Filtered job listings
   */
  async scan(keywords = [], config = {}, experienceProfile = { years: 0, level: "fresher" }) {
    const results = [];
    const stats = {
      total: 1,
      success: 0,
      matched: 0,
      noBoard: 0,
      blocked: 0,
      rateLimited: 0,
      errors: 0,
      rawCount: 0,
    };

    logger.info("\nFreeHire Remote Tech API");

    const endpoint = process.env.FREEHIRE_API_URL || "https://freehire.me/api/jobs";

    try {
      logger.info(`   Fetching remote listings from ${endpoint}...`);
      const data = await this.fetchJson(endpoint);
      const jobs = Array.isArray(data) ? data : data?.jobs || data?.results || [];

      stats.success = 1;
      stats.rawCount = jobs.length;

      for (const item of jobs) {
        const title = item.title || item.role || item.position || "";
        const company = item.company || item.company_name || "Tech Startup";
        const url = item.url || item.apply_url || item.link || "";
        const location = item.location || (item.remote ? "Remote" : "Global / Remote");
        const rawContent = item.description || item.snippet || "";
        const sanitized = sanitizePosting(stripHtml(rawContent)).cleanedText;

        if (!title || !url || !isJobTitleValid(title) || !isJobUrlValid(url)) {
          continue;
        }

        // Location fit check
        if (!isLocationFit(location, config)) {
          continue;
        }

        // Quick filter match against candidate target roles / keywords
        const candidateJob = {
          source: "freehire",
          company,
          role: title,
          url,
          location,
          salary: item.salary || null,
          experience: item.experience || "0-2 years",
          content: sanitized.slice(0, 1000),
          status: "pending",
          discovered_at: new Date().toISOString(),
        };

        if (!passesAutoQuickFilter(candidateJob, config)) {
          continue;
        }

        pushIfExperienceFit(results, candidateJob, experienceProfile, config);
      }

      stats.matched = results.length;
      logger.info(`   ✔ Matched ${results.length} remote positions out of ${stats.rawCount} listings.`);
    } catch (error) {
      this.recordFailure(stats, error);
      logger.warn(`   skip (FreeHire API unreachable or timed out: ${error.message})`);
    }

    results.rawCount = stats.rawCount;
    results.healthStatus = this.summarize(stats);
    return results;
  }
}

export default FreeHireScraper;
