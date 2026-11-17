import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DISABLE_SERVER_LISTEN = "1";
process.env.JOBSTRIDER_TEST_WORKSPACE = "test/tmp/workspace";

const { app } = await import("../frontend/server/index.js");
const { workspaceRoot } = await import("../frontend/server/zeroApi.js");

function startTestServer() {
  return new Promise((resolve) => {
    const srv = http.createServer(app);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      resolve({ server: srv, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test("Frontend Bridge Isolation: starts clean without loading root folder resume or job posts", async () => {
  // Ensure clean workspace before checking initial state
  fs.rmSync(workspaceRoot, { recursive: true, force: true });

  const { server, baseUrl } = await startTestServer();
  try {
    // Reset endpoint guarantees fresh state
    const resetRes = await fetch(`${baseUrl}/api/workspace/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeResume: true, includeKey: true })
    });
    assert.strictEqual(resetRes.status, 200);

    const cfgRes = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(cfgRes.status, 200);
    const cfg = await cfgRes.json();
    assert.strictEqual(cfg.has_cv, false);
    assert.strictEqual(cfg.cv_content, "");
    assert.strictEqual(cfg.has_key, false);
    assert.strictEqual("gemini_api_key" in cfg, false, "Must never expose raw API key on GET /config");

    const appsRes = await fetch(`${baseUrl}/api/applications`);
    assert.strictEqual(appsRes.status, 200);
    const apps = await appsRes.json();
    assert.deepStrictEqual(apps, []);

    const scanRes = await fetch(`${baseUrl}/api/scan-results`);
    assert.strictEqual(scanRes.status, 200);
    const scans = await scanRes.json();
    assert.deepStrictEqual(scans, []);

    // Build a valid PDF with exact 20-byte xref entries
    const textBody = "BT\n/F1 12 Tf\n72 712 Td\n(Alex Test Candidate - Software Developer with React Node.js TypeScript PostgreSQL Docker REST APIs and automated testing experience across web applications.) Tj\nET";
    const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n";
    const obj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(textBody, "utf8")} >>\nstream\n${textBody}\nendstream\nendobj\n`;
    const header = "%PDF-1.4\n";
    const off1 = Buffer.byteLength(header, "utf8");
    const off2 = off1 + Buffer.byteLength(obj1, "utf8");
    const off3 = off2 + Buffer.byteLength(obj2, "utf8");
    const off4 = off3 + Buffer.byteLength(obj3, "utf8");
    const xrefOffset = off4 + Buffer.byteLength(obj4, "utf8");
    const pad = (n) => String(n).padStart(10, "0");
    const xref = `xref\n0 5\n0000000000 65535 f\r\n${pad(off1)} 00000 n\r\n${pad(off2)} 00000 n\r\n${pad(off3)} 00000 n\r\n${pad(off4)} 00000 n\r\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const samplePdf = Buffer.from(header + obj1 + obj2 + obj3 + obj4 + xref, "utf8");

    const pdfRes = await fetch(`${baseUrl}/api/config/cv-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: samplePdf
    });
    const pdfBody = await pdfRes.text();
    assert.strictEqual(pdfRes.status, 200, `Expected 200 from /api/config/cv-pdf, got ${pdfRes.status}: ${pdfBody}`);
    const pdfJson = JSON.parse(pdfBody);
    assert.strictEqual(pdfJson.ok, true);
    assert.match(pdfJson.cv_content, /Alex Test Candidate/);

    // Verify files route blocks traversal and isolates from root output/reports
    const traversalRes = await fetch(`${baseUrl}/files/output/../../package.json`);
    assert.ok([403, 404].includes(traversalRes.status));

    // Clean up workspace so user gets an empty starting state
    await fetch(`${baseUrl}/api/workspace/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeResume: true, includeKey: true })
    });
    const configLocalInWorkspace = path.join(workspaceRoot, "config.local.json");
    if (fs.existsSync(configLocalInWorkspace)) fs.unlinkSync(configLocalInWorkspace);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
