import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifyPdfAts, extractKeywords } from "../src/services/atsVerifier.mjs";

test("ATS Verifier: extractKeywords extracts tech terms accurately", () => {
  const sample = "Looking for a full stack engineer with Python, React, PostgreSQL, Docker, and REST APIs.";
  const keywords = extractKeywords(sample);
  assert.ok(keywords.includes("python"));
  assert.ok(keywords.includes("react"));
  assert.ok(keywords.includes("postgresql"));
  assert.ok(keywords.includes("docker"));
  assert.ok(keywords.includes("rest"));
  assert.ok(!keywords.includes("ruby"));
});

test("ATS Verifier: Throws error when PDF file does not exist", async () => {
  await assert.rejects(
    async () => {
      await verifyPdfAts("non-existent-resume-file.pdf");
    },
    /PDF file not found/
  );
});

test("ATS Verifier: Validates in-memory PDF buffer with full scoring breakdown", async () => {
  // Construct a minimal valid PDF with comprehensive resume text
  const resumeText = "Arjun Verma | Email: arjun@example.com | Phone: 9876543210 | linkedin.com/in/arjun | github.com/arjun\n" +
    "Summary: Passionate software engineer with experience in React and Node.js.\n" +
    "Skills: JavaScript, TypeScript, Python, React, Node.js, PostgreSQL, Docker, Git.\n" +
    "Projects: Full Stack E-Commerce app using React and Express.\n" +
    "Experience: Software Engineer Intern at TechCorp.\n" +
    "Education: B.Tech Computer Science from State University.";

  // Safe PDF with ASCII stream
  const streamContent = `BT\n/F1 10 Tf\n50 700 Td\n(${resumeText.replace(/\n/g, ") Tj T* (")}) Tj\nET`;
  const streamLength = Buffer.byteLength(streamContent);

  const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000302 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  const buffer = Buffer.from(samplePdf);
  const targetJd = "We need a Software Engineer skilled in React, Node.js, and PostgreSQL.";

  const result = await verifyPdfAts(buffer, { jobDescription: targetJd, candidateName: "Arjun Verma" });

  assert.ok(result.atsScore >= 75, `Expected score >= 75, got ${result.atsScore}`);
  assert.equal(result.detectedContacts.hasEmail, true);
  assert.equal(result.detectedContacts.email, "arjun@example.com");
  assert.equal(result.detectedContacts.hasPhone, true);
  assert.equal(result.detectedContacts.hasLinkedIn, true);
  assert.equal(result.detectedContacts.hasGitHub, true);
  assert.equal(result.isSinglePage, true);
  assert.ok(result.matchedKeywords.includes("react"));
  assert.ok(result.matchedKeywords.includes("node.js"));
  assert.ok(result.matchedKeywords.includes("postgresql"));
});
