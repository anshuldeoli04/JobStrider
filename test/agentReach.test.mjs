import test from "node:test";
import assert from "node:assert/strict";
import {
  isAgentReachAvailable,
  parseLinkedInJobMetadata,
  parseFounditJobMetadata,
  parseIndeedJobMetadata,
  AgentReachScraper,
} from "../src/scrapers/agentReach.mjs";
import { readJobWithAgentReach } from "../src/services/deepJobReader.mjs";

test("Agent Reach: isAgentReachAvailable returns a boolean without throwing", () => {
  const available = isAgentReachAvailable();
  assert.equal(typeof available, "boolean");
});

test("Agent Reach: parseLinkedInJobMetadata extracts company, role, location from hiring pattern", () => {
  const item = {
    title: "Cisco hiring Senior Software Engineer (Remote) in Houston, TX | LinkedIn",
    text: "# Senior Software Engineer (Remote)\n\n Cisco Houston, TX \n\n 1 month ago\n\nRequirements...",
  };

  const parsed = parseLinkedInJobMetadata(item);
  assert.equal(parsed.company, "Cisco");
  assert.equal(parsed.role, "Senior Software Engineer (Remote)");
  assert.equal(parsed.location, "Houston, TX");
});

test("Agent Reach: parseLinkedInJobMetadata extracts company, role, location from 'at' pattern", () => {
  const item = {
    title: "Frontend Developer at Razorpay in Bengaluru | LinkedIn",
    text: "# Frontend Developer\n\n Razorpay Bengaluru \n\nRequirements...",
  };

  const parsed = parseLinkedInJobMetadata(item);
  assert.equal(parsed.company, "Razorpay");
  assert.equal(parsed.role, "Frontend Developer");
  assert.equal(parsed.location, "Bengaluru");
});

test("Agent Reach Scraper: Normalizes mocked CLI items into standard JobStrider schema", async () => {
  const scraper = new AgentReachScraper();
  scraper.isAvailable = () => true;

  // Mock runCli method to return sample agent-reach data offline
  scraper.runCli = () => ({
    ok: true,
    channel: "linkedin",
    action: "jobs",
    items: [
      {
        title: "Atlassian hiring Software Engineer in Bengaluru, KA | LinkedIn",
        url: "https://www.linkedin.com/jobs/view/12345678",
        text: "# Software Engineer\n\n Atlassian Bengaluru \n\nLooking for an engineer with React and Node.js.",
      },
      {
        title: "Senior Director of Architecture at MegaCorp | LinkedIn",
        url: "https://www.linkedin.com/jobs/view/87654321",
        text: "# Senior Director\n\n15+ years experience required.",
      },
    ],
  });

  const keywords = ["Software Engineer"];
  const config = { target_locations: ["Bengaluru", "Remote"] };
  const experienceProfile = { years: 0, level: "fresher" };

  const results = await scraper.scan(keywords, config, experienceProfile);

  assert.equal(results.length, 1);
  assert.equal(results[0].company, "Atlassian");
  assert.equal(results[0].role, "Software Engineer");
  assert.equal(results[0].source, "reach_linkedin");
  assert.equal(results[0].status, "pending");
  assert.ok(results[0].content.includes("React and Node.js"));
});

test("Agent Reach Scraper: Handles ok:false error envelopes without crashing", async () => {
  const scraper = new AgentReachScraper();
  scraper.isAvailable = () => true;

  // Mock rate limited response
  scraper.runCli = () => ({
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "LinkedIn rate limit hit",
    },
  });

  const results = await scraper.scan(["Python Developer"], {}, { years: 0, level: "fresher" });
  assert.equal(results.length, 0);
  assert.equal(results.rawCount, 0);
});

test("Agent Reach: parseFounditJobMetadata extracts company, role, location", () => {
  const item = {
    title: "Software Engineer - Trainee with 0 - 1 Years of Experience at Oasys Cybernetics Private Limited in Trichy,Chennai",
    text: "# Software Engineer - Trainee\n\nOasys Cybernetics Private Limited\n\nTrichy, Chennai\n\nFresher\n\n 2 - 5 LPA",
  };
  const parsed = parseFounditJobMetadata(item);
  assert.equal(parsed.company, "Oasys Cybernetics Private Limited");
  assert.equal(parsed.role, "Software Engineer - Trainee");
  assert.equal(parsed.location, "Trichy,Chennai");
});

test("Agent Reach: parseIndeedJobMetadata extracts company, role, location", () => {
  const item = {
    title: "SOFTWARE DEVELOPER- Fresher - Remote - Indeed.com",
    text: "Find Jobs\n\n# SOFTWARE DEVELOPER- Fresher\n\nSoranova Technologies Private Limited\n\nRemote\n\n₹3,00,000 - ₹4,50,000 a year",
  };
  const parsed = parseIndeedJobMetadata(item);
  assert.equal(parsed.company, "Soranova Technologies Private Limited");
  assert.equal(parsed.role, "SOFTWARE DEVELOPER");
  assert.equal(parsed.location, "Remote");
});

test("Deep Job Reader: Rejects empty or invalid URLs", async () => {
  const res1 = await readJobWithAgentReach("");
  assert.equal(res1.ok, false);
  assert.match(res1.error, /Invalid URL/);

  const res2 = await readJobWithAgentReach(null);
  assert.equal(res2.ok, false);
  assert.match(res2.error, /Invalid URL/);
});

test("Deep Job Reader: Blocks SSRF targets (localhost, private IPs, metadata)", async () => {
  const localRes = await readJobWithAgentReach("http://localhost:3001/admin");
  assert.equal(localRes.ok, false);
  assert.match(localRes.error, /blocked by security guardrail/i);

  const ipRes = await readJobWithAgentReach("http://127.0.0.1:8080/internal");
  assert.equal(ipRes.ok, false);
  assert.match(ipRes.error, /blocked by security guardrail/i);

  const metadataRes = await readJobWithAgentReach("http://169.254.169.254/latest/meta-data");
  assert.equal(metadataRes.ok, false);
  assert.match(metadataRes.error, /blocked by security guardrail/i);
});
