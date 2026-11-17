/**
 * JobStrider Deep Job Reader (via Agent Reach)
 * Fetches and extracts full job descriptions from arbitrary web links
 * (including protected or client-rendered portals) via the agent-reach CLI.
 */

import { spawnSync } from "node:child_process";
import { isAgentReachAvailable } from "../scrapers/agentReach.mjs";
import { sanitizePosting } from "../security/postingGuard.mjs";
import { validateSafeUrl } from "../utils/urlValidator.mjs";
import logger from "../../logger.mjs";

/**
 * Reads a job posting URL using agent-reach's deep reader.
 * @param {string} url - Target job posting URL
 * @returns {Promise<{ ok: boolean, title?: string, content?: string, raw?: object, error?: string }>}
 */
export async function readJobWithAgentReach(url) {
  if (!url || typeof url !== "string") {
    return { ok: false, error: "Invalid URL provided." };
  }

  // SSRF guard: Ensure URL is public and does not point to internal/loopback/cloud metadata IPs
  const safeCheck = await validateSafeUrl(url);
  if (!safeCheck.safe) {
    return { ok: false, error: `URL blocked by security guardrail: ${safeCheck.reason}` };
  }

  if (!isAgentReachAvailable()) {
    return { ok: false, error: "agent-reach CLI is not available on this machine." };
  }

  try {
    const result = spawnSync("agent-reach", ["read", url], {
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
      timeout: 20000,
    });

    if (result.status !== 0 || !result.stdout) {
      return {
        ok: false,
        error: `agent-reach read failed (exit ${result.status}): ${result.stderr?.slice(0, 150) || "Empty output"}`,
      };
    }

    const data = JSON.parse(result.stdout.trim());
    if (!data.ok) {
      return {
        ok: false,
        error: data.error?.message || `agent-reach reported error: ${data.error?.code || "UNKNOWN"}`,
      };
    }

    const item = Array.isArray(data.items) ? data.items[0] : data;
    const rawText = item?.text || data.text || "";
    const sanitized = sanitizePosting(rawText);

    return {
      ok: true,
      title: item?.title || data.title || "Job Posting",
      content: sanitized.cleanedText,
      isClean: sanitized.isSafe,
      flags: sanitized.flags,
      url,
    };
  } catch (err) {
    logger.warn(`readJobWithAgentReach error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

export default {
  readJobWithAgentReach,
};
