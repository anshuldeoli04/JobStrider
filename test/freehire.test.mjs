import test from "node:test";
import assert from "node:assert/strict";
import { FreeHireScraper } from "../src/scrapers/freehire.mjs";

test("FreeHire Scraper: Instantiates with correct name", () => {
  const scraper = new FreeHireScraper();
  assert.equal(scraper.name, "FreeHire");
});

test("FreeHire Scraper: Normalizes fixture jobs into standard schema", async () => {
  const scraper = new FreeHireScraper();

  // Mock fetchJson to return deterministic fixtures
  scraper.fetchJson = async () => [
    {
      title: "Junior Backend Engineer",
      company: "Stripe Partner",
      url: "https://example.com/jobs/101",
      location: "Remote",
      experience: "0-1 years",
      description: "Build robust APIs using Node.js and TypeScript.",
    },
    {
      title: "Senior VP of Engineering", // should be rejected by title or experience
      company: "MegaCorp",
      url: "https://example.com/jobs/102",
      location: "Remote",
      experience: "10+ years",
      description: "Executive engineering leadership.",
    },
  ];

  const keywords = ["Backend Engineer", "Software Engineer"];
  const config = { target_locations: ["Remote", "India"] };
  const experienceProfile = { years: 0, level: "fresher" };

  const results = await scraper.scan(keywords, config, experienceProfile);

  assert.equal(results.length, 1);
  assert.equal(results[0].company, "Stripe Partner");
  assert.equal(results[0].role, "Junior Backend Engineer");
  assert.equal(results[0].source, "freehire");
  assert.equal(results[0].status, "pending");
  assert.ok(results[0].content.includes("Build robust APIs"));
});
