#!/usr/bin/env node
/**
 * JobStrider Interview Preparation Assistant
 * Prepares stage-specific interview dossiers, STAR behavioral stories,
 * technical Q&A, and honest skill-gap bridges for tracked applications.
 *
 * Usage:
 *   node interview-prep.mjs --job-id=<id>
 *   node interview-prep.mjs --latest
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConfig,
  loadCVWithCache,
  loadApplications,
  upsertApplication,
  safeOutputStem,
  getDataFilePath,
} from "./config-utils.mjs";
import {
  generateInterviewPrep,
  renderInterviewPrepMarkdown,
} from "./src/services/interviewPrepService.mjs";
import { logger } from "./logger.mjs";

async function main() {
  console.clear();
  console.log("============================================================");
  console.log("          JobStrider Interview Preparation Copilot");
  console.log("   Tailored STAR Stories, Technical Prep & Gap Bridges");
  console.log("============================================================\n");

  const args = process.argv.slice(2);
  const jobIdArg = args.find((a) => a.startsWith("--job-id="))?.split("=")[1];
  const isLatest = args.includes("--latest");

  const config = loadConfig();
  const cvText = loadCVWithCache();
  const applications = loadApplications();

  if (applications.length === 0) {
    console.error("[ERROR] No evaluated applications found in tracker. Run `node scan-evaluate.mjs` first.");
    process.exit(1);
  }

  let targetJob = null;
  if (jobIdArg) {
    targetJob = applications.find((a) => a.id === jobIdArg);
    if (!targetJob) {
      console.error(`[ERROR] Job with ID "${jobIdArg}" not found in applications.`);
      process.exit(1);
    }
  } else if (isLatest) {
    targetJob = applications[applications.length - 1];
  } else {
    // Pick the most recent top-graded job or latest application
    const gradeAorB = applications.filter((a) => a.grade === "A" || a.grade === "B");
    targetJob = gradeAorB.length > 0 ? gradeAorB[gradeAorB.length - 1] : applications[applications.length - 1];
  }

  console.log(`🎯 Target Job: ${targetJob.company} — ${targetJob.role}`);
  console.log(`📍 Location: ${targetJob.location || "India"}`);
  console.log(`📊 Grade: ${targetJob.grade || "N/A"} (Fit Score: ${targetJob.score || "N/A"})\n`);
  console.log("Generating grounded interview prep dossier via Gemini... (10-20 seconds)\n");

  try {
    const prepData = await generateInterviewPrep(targetJob, cvText, { config });
    const markdown = renderInterviewPrepMarkdown(prepData, targetJob, config.name || "Candidate");

    const reportsDir = path.resolve(process.cwd(), "reports/interview-prep");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const safeStem = safeOutputStem(`${targetJob.company}_${targetJob.role}_prep`, "prep");
    const filePath = path.join(reportsDir, `${safeStem}.md`);
    fs.writeFileSync(filePath, markdown, "utf8");

    // Update application in tracker
    upsertApplication({
      ...targetJob,
      interview_prep_file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    });

    console.log(`[OK] Interview Prep Dossier Saved: ${filePath}\n`);
    console.log("-".repeat(60));
    console.log("BRIEFING HIGHLIGHTS:");
    console.log(`Company Mission: ${prepData.company_overview || "Ready"}`);
    console.log(`Role Mission: ${prepData.role_mission || "Ready"}`);
    console.log(`\nGenerated ${prepData.behavioral_questions?.length || 0} STAR Stories & ${prepData.technical_questions?.length || 0} Technical Questions.`);
    console.log(`Generated ${prepData.gap_bridges?.length || 0} Honest Gap Bridges.`);
    console.log("-".repeat(60));
    console.log(`\nTo view full pack, open: ${filePath}\n`);
  } catch (error) {
    console.error(`[ERROR] Failed to generate interview prep: ${error.message}`);
    process.exit(1);
  }
}

export { main };

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
