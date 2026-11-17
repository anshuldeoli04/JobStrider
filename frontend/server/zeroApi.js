import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import { normalizeCvText } from './utils/cvParser.js';
import { verifyPdfAts } from '../../src/services/atsVerifier.mjs';
import { generateInterviewPrep, renderInterviewPrepMarkdown } from '../../src/services/interviewPrepService.mjs';
import { findStaleApplications, generateFollowUpEmail, generateLinkedInNote, generateCoverNote } from '../../src/services/outreachService.mjs';
import { readJobWithAgentReach } from '../../src/services/deepJobReader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');

// Completely isolated workspace for the web UI so previous CLI/folder resumes
// and job histories (root cv.md, data/, config.local.json, output/, reports/) are never loaded.
export const workspaceRoot = process.env.JOBSTRIDER_TEST_WORKSPACE
  ? path.resolve(repoRoot, process.env.JOBSTRIDER_TEST_WORKSPACE)
  : path.resolve(__dirname, 'data/workspace');
const dataDir = path.join(workspaceRoot, 'data');
const envFile = path.join(workspaceRoot, '.env');
const configFile = path.join(workspaceRoot, 'config.local.json');
const baseConfigFile = path.resolve(repoRoot, 'config.json');
const cvFile = path.join(workspaceRoot, 'cv.md');
const outputDir = path.join(workspaceRoot, 'output', 'resumes');
const reportsDir = path.join(workspaceRoot, 'reports');
const appsFile = path.join(dataDir, 'applications.json');
const scanFile = path.join(dataDir, 'scan-results.json');
const usageFile = path.join(dataDir, 'usage.json');
const dbFile = path.join(dataDir, 'job-ops.db');

const STARTER_DEFAULTS = {
  gemini_model: 'gemini-2.5-flash',
  groq_model: 'llama-3.3-70b-versatile',
  name: '',
  experience_level: 'fresher',
  experience_years: 0,
  expected_ctc_lpa: '',
  target_roles: ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer'],
  target_locations: ['Remote', 'Bengaluru', 'Hyderabad', 'Pune', 'Delhi NCR'],
  disabled_sources: ['wellfound', 'naukri', 'internshala']
};

function ensureWorkspaceDirs() {
  for (const dir of [workspaceRoot, dataDir, path.join(outputDir, 'html'), reportsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

ensureWorkspaceDirs();

const router = express.Router();

// Stream state per pipeline stage
const pipelines = {
  scan: { status: 'idle', phase: 'idle', logs: [], child: null, clients: new Set(), startedAt: null },
  evaluate: { status: 'idle', phase: 'idle', logs: [], child: null, clients: new Set(), startedAt: null },
  resume: { status: 'idle', phase: 'idle', logs: [], child: null, clients: new Set(), startedAt: null }
};

function broadcastStream(channel, payload) {
  const stream = pipelines[channel];
  if (!stream) return;
  const serialized = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of stream.clients) {
    try {
      res.write(serialized);
    } catch {
      stream.clients.delete(res);
    }
  }
}

function readJsonSafe(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return fallback;
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, filePath);
}

function parseEnvSafe() {
  const out = {};
  if (!fs.existsSync(envFile)) return out;
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      out[k] = v;
    }
  }
  return out;
}

function saveEnvKeys(updates = {}) {
  ensureWorkspaceDirs();
  const existing = parseEnvSafe();
  const merged = { ...existing };
  for (const [k, v] of Object.entries(updates)) {
    if (v === null) {
      delete merged[k];
    } else if (v !== undefined) {
      merged[k] = String(v);
    }
  }
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envFile, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

function maskKey(key) {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

function isPlaceholderCv(content) {
  if (!content || typeof content !== 'string' || content.trim().length < 200) {
    return true;
  }
  return /\[\[[^\]\n]{2,80}\]\]/.test(content);
}

function normalizePortableFileUrl(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const normalized = rawPath.replace(/\\/g, '/').trim();
  if (!normalized) return null;
  if (normalized.startsWith('/files/')) return normalized;

  const workspaceNorm = workspaceRoot.replace(/\\/g, '/');
  if (normalized.startsWith(workspaceNorm + '/')) {
    const rel = normalized.slice(workspaceNorm.length + 1);
    return `/files/${rel}`;
  }

  const outputIdx = normalized.indexOf('output/');
  if (outputIdx >= 0) {
    return `/files/${normalized.slice(outputIdx)}`;
  }

  const reportsIdx = normalized.indexOf('reports/');
  if (reportsIdx >= 0) {
    return `/files/${normalized.slice(reportsIdx)}`;
  }

  return null;
}

function normalizeApplicationRecord(app) {
  if (!app || typeof app !== 'object') return app;
  return {
    ...app,
    resume_pdf: normalizePortableFileUrl(app.resume_pdf) || app.resume_pdf || null,
    resume_html: normalizePortableFileUrl(app.resume_html) || app.resume_html || null,
    report_file: normalizePortableFileUrl(app.report_file) || app.report_file || null
  };
}

function syncApplicationUpdatesToSqlite(updatedApps) {
  if (!fs.existsSync(dbFile)) return;
  try {
    const db = new Database(dbFile, { timeout: 5000 });
    const updateStmt = db.prepare(
      'UPDATE applications SET status = ?, updated_at = ?, raw_data = ? WHERE id = ?'
    );
    const tx = db.transaction((apps) => {
      const now = Date.now();
      for (const app of apps) {
        updateStmt.run(app.status || 'evaluated', now, JSON.stringify(app), String(app.id));
      }
    });
    tx(updatedApps);
    db.close();
  } catch {}
}

function deleteApplicationFromSqlite(id) {
  if (!fs.existsSync(dbFile)) return;
  try {
    const db = new Database(dbFile, { timeout: 5000 });
    db.prepare('DELETE FROM applications WHERE id = ?').run(String(id));
    db.close();
  } catch {}
}

function loadAppsFromWorkspace() {
  const raw = readJsonSafe(appsFile, []);
  return Array.isArray(raw) ? raw.map(normalizeApplicationRecord) : [];
}

function buildConfigPayload() {
  const env = parseEnvSafe();
  const baseDefaults = readJsonSafe(baseConfigFile, {});
  const localConfig = readJsonSafe(configFile, {});

  let cvContent = '';
  try {
    if (fs.existsSync(cvFile)) {
      cvContent = fs.readFileSync(cvFile, 'utf8');
    }
  } catch {}

  const rawKey = (env.GEMINI_API_KEY || '').trim();
  const rawGroqKey = (env.GROQ_API_KEY || '').trim();
  const hasKey = Boolean(rawKey && !rawKey.includes('YOUR_GEMINI_API_KEY'));
  const hasGroqKey = Boolean(rawGroqKey);
  const hasCv = Boolean(cvContent && !isPlaceholderCv(cvContent));
  const cvWords = cvContent.trim() ? cvContent.trim().split(/\s+/).filter(Boolean).length : 0;

  return {
    name: localConfig.name ?? STARTER_DEFAULTS.name,
    experience_level: localConfig.experience_level ?? STARTER_DEFAULTS.experience_level,
    experience_years: localConfig.experience_years ?? STARTER_DEFAULTS.experience_years,
    expected_ctc_lpa: localConfig.expected_ctc_lpa ?? STARTER_DEFAULTS.expected_ctc_lpa,
    gemini_model: env.GEMINI_MODEL || localConfig.gemini_model || baseDefaults.gemini_model || STARTER_DEFAULTS.gemini_model,
    groq_model: env.GROQ_MODEL || localConfig.groq_model || baseDefaults.groq_model || STARTER_DEFAULTS.groq_model,
    target_roles: Array.isArray(localConfig.target_roles)
      ? localConfig.target_roles
      : STARTER_DEFAULTS.target_roles,
    target_locations: Array.isArray(localConfig.target_locations)
      ? localConfig.target_locations
      : STARTER_DEFAULTS.target_locations,
    disabled_sources: Array.isArray(localConfig.disabled_sources)
      ? localConfig.disabled_sources
      : STARTER_DEFAULTS.disabled_sources,
    cv_content: cvContent,
    cv_word_count: cvWords,
    has_key: hasKey,
    has_groq_key: hasGroqKey,
    masked_key: hasKey ? maskKey(rawKey) : '',
    masked_groq_key: hasGroqKey ? maskKey(rawGroqKey) : '',
    has_cv: hasCv,
    configured: Boolean(hasKey && hasCv)
  };
}

function getIsolatedChildEnv(extra = {}) {
  const env = parseEnvSafe();
  return {
    ...process.env,
    JOBSTRIDER_ISOLATED: '1',
    JOBSTRIDER_DATA_DIR: dataDir,
    JOB_OPS_DATA_DIR: dataDir,
    JOBSTRIDER_CV_FILE: cvFile,
    JOBSTRIDER_CONFIG_LOCAL_FILE: configFile,
    JOBSTRIDER_ENV_FILE: envFile,
    JOBSTRIDER_OUTPUT_DIR: outputDir,
    JOBSTRIDER_REPORTS_DIR: reportsDir,
    GEMINI_API_KEY: env.GEMINI_API_KEY || '',
    GROQ_API_KEY: env.GROQ_API_KEY || '',
    GEMINI_MODEL: env.GEMINI_MODEL || STARTER_DEFAULTS.gemini_model,
    GROQ_MODEL: env.GROQ_MODEL || STARTER_DEFAULTS.groq_model,
    CI: '1',
    FORCE_COLOR: '0',
    ...extra
  };
}

function mapExperienceYears(levelSlug) {
  if (levelSlug === '0-1yr') return 1;
  if (levelSlug === '1-3yr') return 3;
  if (levelSlug === '3+yr') return 4;
  return 0;
}

async function extractPdfText(pdfBuffer) {
  const v2Path = path.resolve(repoRoot, 'node_modules/pdf-parse/dist/pdf-parse/esm/index.js');
  const mod = fs.existsSync(v2Path)
    ? await import(pathToFileURL(v2Path).href)
    : await import('pdf-parse');

  const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;
  if (typeof PDFParseClass === 'function') {
    const parser = new PDFParseClass({ data: pdfBuffer });
    try {
      const result = await parser.getText();
      return normalizeCvText(result?.text || '');
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  }
  if (typeof mod.default === 'function') {
    const parsed = await mod.default(pdfBuffer);
    return normalizeCvText(parsed?.text || '');
  }
  throw new Error('PDF parser module could not be initialized.');
}

function buildActivityFeed() {
  const apps = loadAppsFromWorkspace().slice(0, 12);
  return apps.map((a) => ({
    id: a.id,
    title: `${a.company || 'Company'} — ${a.role || 'Role'}`,
    description: `Match score ${Number(a.score || 0).toFixed(1)}/10 (Grade ${a.grade || '?'})${a.resume_pdf ? ' • Tailored resume ready' : ''}`,
    timestamp: a.timestamp || a.evaluated_at || new Date().toISOString()
  }));
}

function friendlyLogError(rawError) {
  const msg = String(rawError || 'Unexpected error');
  if (/API_KEY_INVALID|API key not valid/i.test(msg)) {
    return 'Your Google Gemini API key looks invalid. Please double-check and paste a fresh key from Google AI Studio.';
  }
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'Google Gemini free quota limit reached for now. Please wait a minute or try again later.';
  }
  if (/cv\.md missing|template text|placeholder/i.test(msg)) {
    return 'Please upload your PDF resume or paste at least 200 characters of resume details first.';
  }
  return msg;
}

// 1. Auth / Local Workspace Session
router.get('/auth/session', (_req, res) => {
  const cfg = buildConfigPayload();
  res.json({
    user: {
      id: 1,
      name: cfg.name || 'Job Seeker',
      email: 'local@jobstrider.app',
      experienceLevel: cfg.experience_level
    }
  });
});

router.post('/auth/local', (_req, res) => {
  const cfg = buildConfigPayload();
  res.json({
    user: {
      id: 1,
      name: cfg.name || 'Job Seeker',
      email: 'local@jobstrider.app',
      experienceLevel: cfg.experience_level
    },
    token: 'jobstrider-local-operator-token'
  });
});

router.post('/auth/login', (_req, res) => {
  res.json({
    user: { id: 1, name: 'Job Seeker', email: 'local@jobstrider.app' },
    token: 'jobstrider-local-operator-token'
  });
});

router.post('/auth/signup', (_req, res) => {
  res.json({
    user: { id: 1, name: 'Job Seeker', email: 'local@jobstrider.app' },
    token: 'jobstrider-local-operator-token'
  });
});

router.post('/auth/logout', (_req, res) => res.json({ ok: true }));
router.post('/auth/ticket', (_req, res) => res.json({ ticket: 'local-ticket', expiresInSeconds: 86400 }));

// 2. Configuration & Resume Profile
router.get('/config', (_req, res) => {
  res.json(buildConfigPayload());
});

router.get('/config/status', (_req, res) => {
  const cfg = buildConfigPayload();
  res.json({
    configured: cfg.configured,
    hasKey: cfg.has_key,
    hasCv: cfg.has_cv
  });
});

router.post('/config/test-key', async (req, res) => {
  try {
    const { api_key, gemini_model } = req.body || {};
    const env = parseEnvSafe();
    const key = (api_key || env.GEMINI_API_KEY || '').trim();
    const modelName = gemini_model || env.GEMINI_MODEL || STARTER_DEFAULTS.gemini_model;
    if (!key) {
      return res.status(400).json({ ok: false, error: 'Please paste a Google Gemini API key to test.' });
    }
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Reply with OK.');
    const text = result?.response?.text() || 'OK';
    res.json({ ok: true, model: modelName, sample: text.trim() });
  } catch (err) {
    res.status(400).json({ ok: false, error: friendlyLogError(err.message) });
  }
});

router.post('/config/update-key', (req, res) => {
  try {
    const { key, gemini_api_key, model, gemini_model, groq_api_key, groq_model } = req.body || {};
    const effectiveKey = (key ?? gemini_api_key ?? '').trim();
    if (!effectiveKey) {
      return res.status(400).json({ error: 'API key cannot be empty.' });
    }
    const updates = { GEMINI_API_KEY: effectiveKey };
    const effectiveModel = (model || gemini_model || '').trim();
    if (effectiveModel) updates.GEMINI_MODEL = effectiveModel;
    if (groq_api_key !== undefined) updates.GROQ_API_KEY = String(groq_api_key).trim();
    if (groq_model) updates.GROQ_MODEL = String(groq_model).trim();
    saveEnvKeys(updates);
    res.json({ ok: true, message: 'AI key saved and ready.', config: buildConfigPayload() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const {
      name,
      experience_level,
      experience_years,
      expected_ctc_lpa,
      gemini_api_key,
      gemini_model,
      groq_api_key,
      groq_model,
      clear_gemini_key,
      target_roles,
      target_locations,
      disabled_sources,
      cv_content
    } = req.body || {};

    const envUpdates = {};
    if (clear_gemini_key) {
      envUpdates.GEMINI_API_KEY = null;
    } else if (gemini_api_key !== undefined && String(gemini_api_key).trim()) {
      envUpdates.GEMINI_API_KEY = String(gemini_api_key).trim();
    }
    if (gemini_model) envUpdates.GEMINI_MODEL = String(gemini_model).trim();
    if (groq_api_key !== undefined && String(groq_api_key).trim()) {
      envUpdates.GROQ_API_KEY = String(groq_api_key).trim();
    }
    if (groq_model) envUpdates.GROQ_MODEL = String(groq_model).trim();
    if (Object.keys(envUpdates).length > 0) {
      saveEnvKeys(envUpdates);
    }

    const currentConfig = readJsonSafe(configFile, {});
    const resolvedLevel = experience_level ?? currentConfig.experience_level ?? STARTER_DEFAULTS.experience_level;
    const newConfig = {
      ...STARTER_DEFAULTS,
      ...currentConfig,
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(experience_level !== undefined ? { experience_level: resolvedLevel } : {}),
      ...(experience_years !== undefined
        ? { experience_years: Number(experience_years) || 0 }
        : experience_level !== undefined
          ? { experience_years: mapExperienceYears(resolvedLevel) }
          : {}),
      ...(expected_ctc_lpa !== undefined ? { expected_ctc_lpa: String(expected_ctc_lpa).trim() } : {}),
      ...(gemini_model ? { gemini_model: String(gemini_model).trim() } : {}),
      ...(groq_model ? { groq_model: String(groq_model).trim() } : {}),
      ...(Array.isArray(target_roles) ? { target_roles } : {}),
      ...(Array.isArray(target_locations) ? { target_locations } : {}),
      ...(Array.isArray(disabled_sources) ? { disabled_sources } : {})
    };
    writeJsonAtomic(configFile, newConfig);

    if (cv_content !== undefined) {
      ensureWorkspaceDirs();
      fs.writeFileSync(cvFile, String(cv_content), 'utf8');
    }

    res.json({ ok: true, message: 'Preferences saved.', config: buildConfigPayload() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/config/cv-pdf', async (req, res) => {
  try {
    const pdfBuffer = req.body;
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'Please select a valid PDF file.' });
    }
    const extractedText = await extractPdfText(pdfBuffer);
    if (!extractedText || extractedText.length < 40) {
      return res.status(400).json({
        error: 'Could not read enough text from this PDF (it may be a scanned image). Try pasting your resume text instead.'
      });
    }
    ensureWorkspaceDirs();
    fs.writeFileSync(cvFile, extractedText, 'utf8');
    const config = buildConfigPayload();
    res.json({
      ok: true,
      charCount: extractedText.length,
      cv_content: extractedText,
      config
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to read PDF file.' });
  }
});

// 3. Applications Tracker CRUD
router.get('/applications', (_req, res) => {
  res.json(loadAppsFromWorkspace());
});

router.patch('/applications/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const items = readJsonSafe(appsFile, []);
  let found = null;
  const updated = items.map((app) => {
    if (String(app.id) === String(id)) {
      found = { ...app, status: status || app.status, updated_at: new Date().toISOString() };
      return found;
    }
    return app;
  });
  if (found) {
    writeJsonAtomic(appsFile, updated);
    syncApplicationUpdatesToSqlite([found]);
    return res.json(normalizeApplicationRecord(found));
  }
  return res.status(404).json({ error: 'Application not found' });
});

router.patch('/applications', (req, res) => {
  const { ids = [], status = 'applied' } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ ok: true, applications: loadAppsFromWorkspace() });
  }
  const idSet = new Set(ids.map(String));
  const items = readJsonSafe(appsFile, []);
  const changed = [];
  const updated = items.map((app) => {
    if (idSet.has(String(app.id))) {
      const next = { ...app, status, updated_at: new Date().toISOString() };
      changed.push(next);
      return next;
    }
    return app;
  });
  writeJsonAtomic(appsFile, updated);
  if (changed.length) syncApplicationUpdatesToSqlite(changed);
  res.json({ ok: true, updatedCount: changed.length, applications: updated.map(normalizeApplicationRecord) });
});

router.delete('/applications/:id', (req, res) => {
  const { id } = req.params;
  const items = readJsonSafe(appsFile, []);
  const next = items.filter((app) => String(app.id) !== String(id));
  if (next.length === items.length) {
    return res.status(404).json({ error: 'Application not found' });
  }
  writeJsonAtomic(appsFile, next);
  deleteApplicationFromSqlite(id);
  res.json({ ok: true, applications: next.map(normalizeApplicationRecord) });
});

// ATS Report Audit Endpoint
router.get('/applications/:id/ats-report', async (req, res) => {
  const { id } = req.params;
  const items = readJsonSafe(appsFile, []);
  const app = items.find((a) => String(a.id) === String(id));
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (app.ats_report) {
    return res.json({ ok: true, atsReport: app.ats_report, atsScore: app.ats_score });
  }

  if (app.resume_pdf) {
    try {
      const rel = String(app.resume_pdf).replace(/^\/files\//, '');
      const inWorkspace = path.resolve(workspaceRoot, rel);
      const inRepo = path.resolve(repoRoot, rel);
      const pdfLocalPath = fs.existsSync(inWorkspace) ? inWorkspace : inRepo;
      if (fs.existsSync(pdfLocalPath)) {
        const config = readJsonSafe(configFile, {});
        const audit = await verifyPdfAts(pdfLocalPath, {
          jobDescription: app.content || '',
          candidateName: config.name || 'Candidate'
        });
        return res.json({ ok: true, atsReport: audit, atsScore: audit.atsScore });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.json({ ok: true, atsScore: null, atsReport: null, message: 'No resume PDF found to audit' });
});

// Interview Prep Dossier Endpoints
router.post('/applications/:id/interview-prep', async (req, res) => {
  const { id } = req.params;
  const items = readJsonSafe(appsFile, []);
  const app = items.find((a) => String(a.id) === String(id));
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const cvText = fs.existsSync(cvFile) ? fs.readFileSync(cvFile, 'utf8') : '';
  const config = readJsonSafe(configFile, {});

  try {
    const prepData = await generateInterviewPrep(app, cvText, { config });
    const markdown = renderInterviewPrepMarkdown(prepData, app, config.name || 'Candidate');

    const prepDir = path.join(workspaceRoot, 'reports', 'interview-prep');
    if (!fs.existsSync(prepDir)) fs.mkdirSync(prepDir, { recursive: true });
    const stem = `${app.company || 'job'}_${app.role || 'prep'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(prepDir, `${stem}.md`);
    fs.writeFileSync(filePath, markdown, 'utf8');

    app.interview_prep = prepData;
    app.interview_prep_file = filePath;
    writeJsonAtomic(appsFile, items);
    syncApplicationUpdatesToSqlite([app]);

    return res.json({ ok: true, prepData, markdown });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id/interview-prep', (req, res) => {
  const { id } = req.params;
  const items = readJsonSafe(appsFile, []);
  const app = items.find((a) => String(a.id) === String(id));
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (app.interview_prep) {
    return res.json({ ok: true, prepData: app.interview_prep });
  }
  return res.json({ ok: true, prepData: null });
});

// Outreach & Stale Applications Endpoints
router.get('/ops/stale-applications', (_req, res) => {
  const items = readJsonSafe(appsFile, []);
  const stale = findStaleApplications(items, 10);
  const enriched = stale.map((app) => ({
    ...normalizeApplicationRecord(app),
    suggestedFollowUpEmail: generateFollowUpEmail({
      candidateName: 'Candidate',
      company: app.company,
      role: app.role,
      submissionDate: app.applied_at || app.date_applied || 'recently',
      keyStrength: (app.strengths || [])[0] || ''
    }),
    suggestedLinkedInNote: generateLinkedInNote({
      company: app.company,
      role: app.role
    })
  }));
  res.json({ ok: true, staleApplications: enriched });
});

router.post('/applications/:id/outreach', (req, res) => {
  const { id } = req.params;
  const items = readJsonSafe(appsFile, []);
  const app = items.find((a) => String(a.id) === String(id));
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const config = readJsonSafe(configFile, {});
  const candidateName = config.name || 'Candidate';

  const email = generateFollowUpEmail({
    candidateName,
    company: app.company,
    role: app.role,
    submissionDate: app.applied_at || app.date_applied || 'recently',
    keyStrength: (app.strengths || [])[0] || ''
  });

  const linkedIn = generateLinkedInNote({
    candidateName,
    company: app.company,
    role: app.role
  });

  const coverNote = generateCoverNote({
    candidateName,
    company: app.company,
    role: app.role,
    skills: app.strengths || [],
    fitSummary: app.fit_summary || ''
  });

  res.json({ ok: true, email, linkedIn, coverNote });
});

// 4. Job Discovery / Scanner & Live SSE Stream
router.get('/scan-results', (_req, res) => {
  const results = readJsonSafe(scanFile, []);
  res.json(Array.isArray(results) ? results : []);
});

router.get('/scan/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const stream = pipelines.scan;
  stream.clients.add(res);
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      status: stream.status,
      phase: stream.phase,
      logs: stream.logs
    })}\n\n`
  );

  req.on('close', () => {
    stream.clients.delete(res);
  });
});

router.post('/scan', (req, res) => {
  const stream = pipelines.scan;
  if (stream.status === 'running') {
    return res.status(409).json({ error: 'A job search is already running.' });
  }

  const { mode = 'scan', sources = [], keywords = '', limit = 12, autoTailor = false } = req.body || {};
  const cfg = buildConfigPayload();
  if (mode === 'autoflow' && (!cfg.has_key || !cfg.has_cv)) {
    return res.status(400).json({
      error: !cfg.has_cv
        ? 'Please add your resume first so AI can match jobs for you.'
        : 'Please connect your free Google Gemini key first so AI can score jobs.'
    });
  }

  const script = mode === 'autoflow' ? 'autoflow.mjs' : 'scanner.mjs';
  const args = [path.resolve(repoRoot, script), '--non-interactive', '--headless'];
  if (Array.isArray(sources) && sources.length) {
    args.push(`--sources=${sources.join(',')}`);
  }
  if (typeof keywords === 'string' && keywords.trim()) {
    args.push(`--keywords=${keywords.trim()}`);
  }
  if (mode === 'autoflow') {
    args.push('--yes', `--limit=${Math.max(1, Math.min(30, Number(limit) || 12))}`);
    if (autoTailor) args.push('--auto-tailor');
  }

  stream.status = 'running';
  stream.phase = 'scanning';
  stream.startedAt = Date.now();
  stream.logs = [
    mode === 'autoflow'
      ? 'Starting Smart Job Search + AI Scoring...'
      : 'Scanning selected job boards for matching openings...'
  ];
  broadcastStream('scan', { type: 'status', status: 'running', phase: 'scanning' });
  broadcastStream('scan', { type: 'log', message: stream.logs[0] });

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: getIsolatedChildEnv()
  });
  stream.child = child;

  const handleLine = (line, isErr = false) => {
    const clean = line.trim();
    if (!clean) return;
    if (/2\.\s*Evaluating/i.test(clean) || /BATCH PRE-RANKING/i.test(clean)) {
      stream.phase = 'evaluating';
      broadcastStream('scan', { type: 'phase', phase: 'evaluating' });
    } else if (/Generating tailored/i.test(clean) || /Tailoring resume/i.test(clean)) {
      stream.phase = 'tailoring';
      broadcastStream('scan', { type: 'phase', phase: 'tailoring' });
    }
    const formatted = isErr && !clean.startsWith('[') ? `[WARN] ${clean}` : clean;
    stream.logs.push(formatted);
    broadcastStream('scan', { type: 'log', message: formatted });
  };

  child.stdout.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) handleLine(line, false);
  });

  child.stderr.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) handleLine(line, true);
  });

  child.on('error', (err) => {
    stream.child = null;
    stream.status = 'idle';
    stream.phase = 'error';
    const errMsg = `Failed to start scanner process: ${err.message}`;
    stream.logs.push(errMsg);
    broadcastStream('scan', { type: 'log', message: errMsg });
    broadcastStream('scan', { type: 'error', message: errMsg });
    broadcastStream('scan', { type: 'status', status: 'idle', phase: 'error' });
  });

  child.on('close', (code) => {
    stream.child = null;
    stream.status = 'idle';
    const scanResults = readJsonSafe(scanFile, []);
    const applications = loadAppsFromWorkspace();
    const activity = buildActivityFeed();
    const okPartial = code === 2 && (scanResults.length > 0 || applications.length > 0);
    const isSuccess = code === 0 || okPartial;
    stream.phase = isSuccess ? 'done' : 'error';
    const finishMsg =
      code === 0
        ? `Done! Found ${scanResults.length} job posting(s) and ${applications.length} scored match(es).`
        : okPartial
          ? `Search complete (some job boards didn't respond). Found ${scanResults.length} posting(s) and ${applications.length} scored match(es).`
          : `Job search ended with an issue (code ${code}). Open details to inspect.`;
    stream.logs.push(finishMsg);
    broadcastStream('scan', { type: 'log', message: finishMsg });
    broadcastStream('scan', {
      type: 'complete',
      code,
      status: isSuccess ? 'success' : 'error',
      message: finishMsg,
      scanResults,
      applications,
      activity
    });
    broadcastStream('scan', { type: 'status', status: 'idle', phase: stream.phase });
  });

  res.json({ ok: true, status: 'running', mode });
});

router.post('/scan/stop', (_req, res) => {
  const stream = pipelines.scan;
  if (stream.child && stream.status === 'running') {
    try {
      stream.child.kill('SIGTERM');
    } catch {}
    stream.status = 'idle';
    stream.phase = 'cancelled';
    stream.logs.push('Scan stopped by user.');
    broadcastStream('scan', { type: 'log', message: 'Scan stopped by user.' });
    broadcastStream('scan', { type: 'status', status: 'idle', phase: 'cancelled' });
  }
  res.json({ ok: true });
});

// 5. Evaluate Single Job or Scanned Batch + Live SSE Stream
router.get('/evaluate/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const stream = pipelines.evaluate;
  stream.clients.add(res);
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      status: stream.status,
      logs: stream.logs
    })}\n\n`
  );

  req.on('close', () => {
    stream.clients.delete(res);
  });
});

function clearBreakerIfPresent() {
  const breakerPath = path.join(dataDir, 'breaker.json');
  try {
    if (fs.existsSync(breakerPath)) {
      writeJsonAtomic(breakerPath, { gemini: { until: 0, why: '' }, groq: { until: 0, why: '' } });
    }
  } catch {}
}

router.post('/evaluate', async (req, res) => {
  const { mode = 'single', jd = '', url = '', scanItem = null, limit = 10 } = req.body || {};
  const cfg = buildConfigPayload();

  if (!cfg.has_cv) {
    return res.status(400).json({ error: 'Please upload or paste your resume first before checking a job.' });
  }
  if (!cfg.has_key) {
    return res.status(400).json({ error: 'Please connect your free Google Gemini key first to run AI matching.' });
  }

  clearBreakerIfPresent();

  const stream = pipelines.evaluate;
  stream.status = 'running';
  stream.logs = [];
  broadcastStream('evaluate', { type: 'status', status: 'running' });

  // Batch-evaluate discovered scan results
  if (mode === 'scanned') {
    const rawLimit = Number(limit);
    const limitNum = limit === 'all' || !Number.isFinite(rawLimit) || rawLimit <= 0 ? 100 : Math.max(1, Math.min(100, rawLimit));
    const args = [
      path.resolve(repoRoot, 'scan-evaluate.mjs'),
      '--non-interactive',
      '--mode=auto',
      `--limit=${limitNum}`
    ];
    stream.logs.push('Evaluating top discovered jobs against your resume...');
    broadcastStream('evaluate', { type: 'log', message: stream.logs[0] });

    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: getIsolatedChildEnv()
    });

    let stdout = '';
    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      for (const line of chunk.split(/\r?\n/)) {
        const clean = line.trim();
        if (clean) {
          stream.logs.push(clean);
          broadcastStream('evaluate', { type: 'log', message: clean });
        }
      }
    });
    child.stderr.on('data', (d) => {
      for (const line of d.toString().split(/\r?\n/)) {
        const clean = line.trim();
        if (clean) {
          stream.logs.push(clean);
          broadcastStream('evaluate', { type: 'log', message: clean });
        }
      }
    });

    child.on('error', (err) => {
      stream.status = 'idle';
      const errMsg = `Failed to start batch evaluate process: ${err.message}`;
      stream.logs.push(errMsg);
      broadcastStream('evaluate', { type: 'log', message: errMsg });
      broadcastStream('evaluate', { type: 'error', message: errMsg });
      return res.status(500).json({ error: errMsg });
    });

    child.on('close', (code) => {
      stream.status = 'idle';
      const applications = loadAppsFromWorkspace();
      const scanResults = readJsonSafe(scanFile, []);
      if (code === 0 || code === 2) {
        broadcastStream('evaluate', { type: 'status', status: 'success' });
        return res.json({
          ok: true,
          code,
          applications,
          scanResults,
          activity: buildActivityFeed(),
          message: code === 2 ? 'Quota limit reached after partial evaluation.' : 'Batch evaluation finished.'
        });
      }
      broadcastStream('evaluate', { type: 'error', message: 'Batch evaluation failed.' });
      return res.status(500).json({ error: friendlyLogError(stdout || 'Batch evaluation failed.') });
    });
    return;
  }

  // Single job evaluation (pasted JD or selected scan item)
  let effectiveJd = String(jd || '').trim();
  let effectiveUrl = String(url || '').trim();
  if (scanItem && !effectiveJd) {
    effectiveJd = [
      `Company: ${scanItem.company || 'Company'}`,
      `Role: ${scanItem.role || 'Software Role'}`,
      `Location: ${scanItem.location || 'Remote'}`,
      scanItem.experience ? `Experience: ${scanItem.experience}` : '',
      scanItem.salary ? `Salary: ${scanItem.salary}` : '',
      scanItem.content || scanItem.description || ''
    ]
      .filter(Boolean)
      .join('\n');
    effectiveUrl = effectiveUrl || scanItem.url || '';
  }

  // If JD is absent or too short, but a URL is provided, attempt deep retrieval via Agent Reach
  if (effectiveJd.length < 50 && effectiveUrl && /^https?:\/\//i.test(effectiveUrl)) {
    try {
      const readMsg = `Fetching full job posting via Agent Reach for ${effectiveUrl}...`;
      stream.logs.push(readMsg);
      broadcastStream('evaluate', { type: 'log', message: readMsg });
      const deepRead = await readJobWithAgentReach(effectiveUrl);
      if (deepRead.ok && deepRead.content && deepRead.content.length >= 50) {
        effectiveJd = `${deepRead.title ? `Title: ${deepRead.title}\n` : ''}${deepRead.content}`;
        const successMsg = `✔ Retrieved full job description (${effectiveJd.length} chars) via Agent Reach.`;
        stream.logs.push(successMsg);
        broadcastStream('evaluate', { type: 'log', message: successMsg });
      }
    } catch {}
  }

  if (effectiveJd.length < 50) {
    stream.status = 'idle';
    return res.status(400).json({
      error: 'Please paste the job description (at least 50 characters) so AI can evaluate it accurately.'
    });
  }

  const tmpJdFile = path.join(dataDir, `.tmp-jd-${Date.now()}.txt`);
  fs.writeFileSync(tmpJdFile, effectiveJd, 'utf8');

  const args = [
    path.resolve(repoRoot, 'evaluate.mjs'),
    '--non-interactive',
    '--json',
    `--jd-file=${tmpJdFile}`
  ];
  if (effectiveUrl) {
    args.push(`--url=${effectiveUrl}`);
  }

  stream.logs.push('Reading your resume and analyzing job requirements with Gemini...');
  broadcastStream('evaluate', { type: 'log', message: stream.logs[0] });

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: getIsolatedChildEnv()
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    const text = d.toString();
    stdout += text;
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean || clean.startsWith('EVAL_RESULT_JSON:')) continue;
      stream.logs.push(clean);
      broadcastStream('evaluate', { type: 'log', message: clean });
    }
  });
  child.stderr.on('data', (d) => {
    const text = d.toString();
    stderr += text;
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (clean) {
        stream.logs.push(clean);
        broadcastStream('evaluate', { type: 'log', message: clean });
      }
    }
  });

  child.on('error', (err) => {
    try { fs.unlinkSync(tmpJdFile); } catch {}
    stream.status = 'idle';
    const errMsg = `Failed to start evaluation process: ${err.message}`;
    stream.logs.push(errMsg);
    broadcastStream('evaluate', { type: 'log', message: errMsg });
    broadcastStream('evaluate', { type: 'error', message: errMsg });
    return res.status(500).json({ error: errMsg });
  });

  child.on('close', (code) => {
    try {
      fs.unlinkSync(tmpJdFile);
    } catch {}
    stream.status = 'idle';

    const match = stdout.match(/EVAL_RESULT_JSON:(.+)/);
    if (code === 0 && match) {
      try {
        const result = normalizeApplicationRecord(JSON.parse(match[1].trim()));
        const applications = loadAppsFromWorkspace();

        // Also record grade and score directly on the scan item if it was from scanResults
        const scanList = readJsonSafe(scanFile, []);
        let scanUpdated = false;
        for (const item of scanList) {
          if (
            (result.url && item.url === result.url) ||
            (result.company && result.role &&
              String(item.company || '').trim().toLowerCase() === String(result.company || '').trim().toLowerCase() &&
              String(item.role || item.title || '').trim().toLowerCase() === String(result.role || '').trim().toLowerCase())
          ) {
            item.status = 'evaluated';
            item.grade = result.grade;
            item.score = result.score;
            item.verdict = result.verdict;
            scanUpdated = true;
          }
        }
        if (scanUpdated) {
          writeJsonAtomic(scanFile, scanList);
        }

        const scanResults = readJsonSafe(scanFile, []);
        broadcastStream('evaluate', { type: 'complete', result });
        return res.json({ ok: true, result, applications, scanResults, activity: buildActivityFeed() });
      } catch {}
    }
    const errMessage = friendlyLogError(stderr || stdout || 'Could not evaluate this job.');
    broadcastStream('evaluate', { type: 'error', message: errMessage });
    return res.status(500).json({ error: errMessage });
  });
});

// 6. Tailored Resume Builder Endpoint + Live SSE Stream
router.get('/resume/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const stream = pipelines.resume;
  stream.clients.add(res);
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      status: stream.status,
      logs: stream.logs
    })}\n\n`
  );

  req.on('close', () => {
    stream.clients.delete(res);
  });
});

router.post('/resume', (req, res) => {
  const { applicationId, jobId, jd } = req.body || {};
  const targetId = applicationId || jobId;
  if (!targetId && !jd) {
    return res.status(400).json({ error: 'Please choose a job or paste a job description first.' });
  }

  const cfg = buildConfigPayload();
  if (!cfg.has_cv) {
    return res.status(400).json({ error: 'Please upload or paste your resume first.' });
  }

  const stream = pipelines.resume;
  stream.status = 'running';
  stream.logs = ['Customizing your resume for this role...'];
  broadcastStream('resume', { type: 'status', status: 'running' });
  broadcastStream('resume', { type: 'log', message: stream.logs[0] });

  let tmpJdFile = null;
  const args = [path.resolve(repoRoot, 'resume-builder.mjs'), '--non-interactive'];
  if (targetId) {
    args.push(`--job-id=${targetId}`);
  } else {
    tmpJdFile = path.join(dataDir, `.tmp-resume-jd-${Date.now()}.txt`);
    fs.writeFileSync(tmpJdFile, String(jd), 'utf8');
    args.push(`--jd-file=${tmpJdFile}`);
  }

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: getIsolatedChildEnv()
  });

  let output = '';
  child.stdout.on('data', (d) => {
    const text = d.toString();
    output += text;
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean || clean.startsWith('RESUME_RESULT_JSON:')) continue;
      stream.logs.push(clean);
      broadcastStream('resume', { type: 'log', message: clean });
    }
  });
  child.stderr.on('data', (d) => {
    const text = d.toString();
    output += text;
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (clean) {
        stream.logs.push(clean);
        broadcastStream('resume', { type: 'log', message: clean });
      }
    }
  });

  child.on('error', (err) => {
    if (tmpJdFile) {
      try { fs.unlinkSync(tmpJdFile); } catch {}
    }
    stream.status = 'idle';
    const errMsg = `Failed to start resume builder: ${err.message}`;
    stream.logs.push(errMsg);
    broadcastStream('resume', { type: 'log', message: errMsg });
    broadcastStream('resume', { type: 'error', message: errMsg });
    return res.status(500).json({ error: errMsg });
  });

  child.on('close', (code) => {
    if (tmpJdFile) {
      try { fs.unlinkSync(tmpJdFile); } catch {}
    }
    stream.status = 'idle';

    if (code === 0) {
      let parsed = {};
      const jsonMatch = output.match(/RESUME_RESULT_JSON:(.+)/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
        } catch {}
      }
      const resumePdf = normalizePortableFileUrl(parsed.resume_pdf);
      const resumeHtml = normalizePortableFileUrl(parsed.resume_html);
      const payload = {
        ok: true,
        message: resumePdf ? 'Tailored PDF and HTML resume ready.' : 'Tailored HTML resume ready.',
        file: resumePdf ? resumePdf.replace(/^\/files\//, '') : null,
        resume_pdf: resumePdf,
        resume_html: resumeHtml,
        changes_made: parsed.changes_made || [],
        keywords_injected: parsed.keywords_injected || [],
        applications: loadAppsFromWorkspace(),
        logs: stream.logs
      };
      broadcastStream('resume', { type: 'complete', result: payload });
      return res.json(payload);
    }

    const errMsg = friendlyLogError(output || 'Resume customization failed.');
    broadcastStream('resume', { type: 'error', message: errMsg });
    return res.status(500).json({ error: errMsg });
  });
});

// 7. Workspace Reset (keeps user totally in control of their clean workspace)
router.post('/workspace/reset', (req, res) => {
  try {
    const { includeResume = false, includeKey = false } = req.body || {};
    writeJsonAtomic(appsFile, []);
    writeJsonAtomic(scanFile, []);
    writeJsonAtomic(usageFile, { today: 0, limit_estimate: 1500 });

    for (const extraFile of ['breaker.json', 'cv-profile.json', 'health-log.jsonl', 'job-ops.db', 'job-ops.db-wal', 'job-ops.db-shm']) {
      const target = path.join(dataDir, extraFile);
      if (fs.existsSync(target)) {
        try { fs.unlinkSync(target); } catch {}
      }
    }
    for (const dir of [outputDir, reportsDir]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    if (includeResume && fs.existsSync(cvFile)) {
      fs.unlinkSync(cvFile);
    }
    if (includeKey && fs.existsSync(envFile)) {
      fs.unlinkSync(envFile);
    }
    ensureWorkspaceDirs();

    res.json({
      ok: true,
      applications: [],
      scanResults: [],
      activity: [],
      config: buildConfigPayload()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Quota Usage, Activity & Ops
router.get('/usage', (_req, res) => {
  const usage = readJsonSafe(usageFile, { today: 0, limit_estimate: 1500 });
  res.json(usage);
});

router.get('/activity', (_req, res) => {
  res.json(buildActivityFeed());
});

router.get('/ops', (_req, res) => {
  res.json({ ok: true, mode: 'isolated-workspace' });
});

router.get('/ops/health', (_req, res) => {
  res.json({
    status: 'healthy',
    backend: 'connected',
    storage: 'isolated-workspace',
    appsCount: loadAppsFromWorkspace().length
  });
});

router.patch('/ops/settings', (req, res) => {
  try {
    const settings = req.body || {};
    const currentConfig = readJsonSafe(configFile, {});
    const updated = {
      ...currentConfig,
      ops: { ...(currentConfig.ops || {}), ...settings }
    };
    writeJsonAtomic(configFile, updated);
    res.json({ ok: true, settings: updated.ops });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ops/auto-apply/preview', (_req, res) => {
  const apps = loadAppsFromWorkspace();
  const highFit = apps.filter(
    (a) => (a.grade === 'A' || Number(a.score || 0) >= 8.0) && a.status !== 'applied'
  );
  res.json({ candidates: highFit, total: highFit.length });
});

router.get('/ops/score-report/:id', (req, res) => {
  const { id } = req.params;
  const apps = loadAppsFromWorkspace();
  const app = apps.find((a) => String(a.id) === String(id));
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json(app);
});

export default router;
