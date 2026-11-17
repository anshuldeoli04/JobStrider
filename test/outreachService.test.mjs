import test from "node:test";
import assert from "node:assert/strict";
import {
  findStaleApplications,
  generateFollowUpEmail,
  generateLinkedInNote,
  generateCoverNote,
} from "../src/services/outreachService.mjs";

test("Outreach: findStaleApplications correctly filters applications older than threshold", () => {
  const now = Date.now();
  const twelveDaysAgo = new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

  const apps = [
    { id: "app-1", company: "Meta", role: "SDE", status: "applied", applied_at: twelveDaysAgo },
    { id: "app-2", company: "Google", role: "SDE", status: "applied", applied_at: threeDaysAgo },
    { id: "app-3", company: "Netflix", role: "SDE", status: "rejected", applied_at: twelveDaysAgo }, // not open
  ];

  const stale = findStaleApplications(apps, 10);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].company, "Meta");
});

test("Outreach: generateFollowUpEmail formats professional email draft", () => {
  const email = generateFollowUpEmail({
    candidateName: "Arjun Verma",
    company: "Zomato",
    role: "Backend Engineer",
    submissionDate: "two weeks ago",
    keyStrength: "scalable Node.js microservices",
  });

  assert.ok(email.subject.includes("Backend Engineer Application — Arjun Verma"));
  assert.ok(email.body.includes("Hi Zomato Hiring Team"));
  assert.ok(email.body.includes("scalable Node.js microservices"));
  assert.ok(email.body.includes("Arjun Verma"));
});

test("Outreach: generateLinkedInNote enforces strict 300 character ceiling", () => {
  const note = generateLinkedInNote({
    candidateName: "Arjun Verma",
    company: "Uber",
    role: "Software Engineer",
  });

  assert.ok(note.length <= 300);
  assert.ok(note.includes("Software Engineer"));
  assert.ok(note.includes("Uber"));
});

test("Outreach: generateCoverNote formats clean 3-paragraph cover letter", () => {
  const note = generateCoverNote({
    candidateName: "Arjun Verma",
    company: "Cred",
    role: "Full Stack Engineer",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    fitSummary: "My recent project demonstrated a 20% latency reduction in payment pipelines.",
  });

  assert.ok(note.includes("Dear Cred Hiring Team"));
  assert.ok(note.includes("Full Stack Engineer"));
  assert.ok(note.includes("React, TypeScript, Node.js, PostgreSQL"));
  assert.ok(note.includes("Sincerely,\nArjun Verma"));
});
