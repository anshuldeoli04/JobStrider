import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseWorkspace = process.env.JOBSTRIDER_TEST_WORKSPACE
  ? path.resolve(process.env.JOBSTRIDER_TEST_WORKSPACE)
  : fileURLToPath(new URL('../../../', import.meta.url));
const dataDir = path.resolve(baseWorkspace, 'data');
const dbFile = path.resolve(dataDir, 'jobstrider-server.db');

let _sqliteDb = null;

export function getSqliteDb() {
  if (_sqliteDb) return _sqliteDb;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  _sqliteDb = new Database(dbFile);
  _sqliteDb.pragma('journal_mode = WAL');
  _sqliteDb.pragma('synchronous = NORMAL');
  _sqliteDb.pragma('busy_timeout = 5000');
  initSchema(_sqliteDb);
  seedInitialData(_sqliteDb);
  return _sqliteDb;
}

function initSchema(db) {
  // Execute database schema initialization safely
  db['exec'](`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      experience_level_id INTEGER,
      token_version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS experience_levels (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      min_years REAL
    );

    CREATE TABLE IF NOT EXISTS user_target_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role_name TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_target_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      location_name TEXT
    );

    CREATE TABLE IF NOT EXISTS user_cvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      version INTEGER DEFAULT 1,
      is_current INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id INTEGER DEFAULT 1,
      company_name TEXT,
      role_title TEXT,
      location TEXT,
      salary_estimate TEXT,
      ai_score REAL,
      ai_grade TEXT,
      verdict TEXT,
      fit_summary TEXT,
      negotiation_note TEXT,
      status TEXT DEFAULT 'evaluated',
      source TEXT,
      job_url TEXT,
      evaluated_at TEXT,
      required_exp_min REAL,
      required_exp_max REAL,
      experience_level_id INTEGER,
      report_file TEXT
    );

    CREATE TABLE IF NOT EXISTS application_strengths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT,
      strength TEXT
    );

    CREATE TABLE IF NOT EXISTS application_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT,
      gap TEXT
    );

    CREATE TABLE IF NOT EXISTS application_interview_prep (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT,
      question TEXT
    );

    CREATE TABLE IF NOT EXISTS application_action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT,
      action_item TEXT
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT,
      user_id INTEGER,
      pdf_path TEXT,
      html_path TEXT,
      is_current INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS scanned_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_session_id INTEGER,
      company_id INTEGER,
      company_name TEXT,
      role_title TEXT,
      location TEXT,
      job_url TEXT,
      source TEXT,
      posted_at TEXT,
      is_evaluated INTEGER DEFAULT 0,
      is_duplicate INTEGER DEFAULT 0,
      raw_data TEXT,
      scraped_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scan_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      status TEXT,
      sources_used TEXT,
      keywords_used TEXT,
      total_found INTEGER DEFAULT 0,
      new_found INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      slug TEXT
    );

    CREATE TABLE IF NOT EXISTS ops_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      min_score REAL DEFAULT 7.0,
      enabled_sources TEXT,
      auto_tailor INTEGER DEFAULT 1,
      max_daily_evals INTEGER DEFAULT 25
    );
  `);
}

function seedInitialData(db) {
  // Seed experience levels
  const levelCount = db.prepare('SELECT COUNT(*) AS c FROM experience_levels').get().c;
  if (levelCount === 0) {
    const insertLevel = db.prepare('INSERT INTO experience_levels (id, slug, min_years) VALUES (?, ?, ?)');
    insertLevel.run(1, 'fresher', 0);
    insertLevel.run(2, 'junior', 1);
    insertLevel.run(3, 'mid', 3);
    insertLevel.run(4, 'senior', 5);
  }

  // Seed default operator user
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    // Bcrypt hash for 'JobStrider123!'
    const hash = '$2a$10$wOaA3iN.a002V8y2Z7KxIu894.vK9sE/bJ7jP2jN0sO.H.w184sKG';
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, experience_level_id, token_version)
      VALUES (1, 'JobStrider Operator', 'operator@jobstrider.local', ?, 1, 1)
    `).run(hash);
  }

  // Seed user target roles from config if available
  const roleCount = db.prepare('SELECT COUNT(*) AS c FROM user_target_roles').get().c;
  if (roleCount === 0) {
    let roles = ['Frontend Developer', 'Software Engineer', 'Fullstack Engineer'];
    try {
      const cfgPath = path.resolve(repoRoot, 'config.local.json');
      const baseCfgPath = path.resolve(repoRoot, 'config.json');
      const chosenPath = fs.existsSync(cfgPath) ? cfgPath : fs.existsSync(baseCfgPath) ? baseCfgPath : null;
      if (chosenPath) {
        const parsed = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
        if (Array.isArray(parsed.target_roles) && parsed.target_roles.length > 0) {
          roles = parsed.target_roles;
        }
      }
    } catch {}
    const insertRole = db.prepare('INSERT INTO user_target_roles (user_id, role_name, is_active) VALUES (1, ?, 1)');
    for (const r of roles) {
      insertRole.run(r);
    }
  }

  // Seed user CV from cv.md if available
  const cvCount = db.prepare('SELECT COUNT(*) AS c FROM user_cvs').get().c;
  if (cvCount === 0) {
    try {
      const cvPath = path.resolve(repoRoot, 'cv.md');
      if (fs.existsSync(cvPath)) {
        const cvContent = fs.readFileSync(cvPath, 'utf8');
        db.prepare('INSERT INTO user_cvs (user_id, content, version, is_current) VALUES (1, ?, 1, 1)').run(cvContent);
      }
    } catch {}
  }

  // Seed applications from data/applications.json if available
  const appCount = db.prepare('SELECT COUNT(*) AS c FROM applications').get().c;
  if (appCount === 0) {
    try {
      const appsJsonPath = path.resolve(repoRoot, 'data/applications.json');
      if (fs.existsSync(appsJsonPath)) {
        const apps = JSON.parse(fs.readFileSync(appsJsonPath, 'utf8'));
        if (Array.isArray(apps) && apps.length > 0) {
          const insertApp = db.prepare(`
            INSERT INTO applications (
              id, user_id, company_name, role_title, location, salary_estimate,
              ai_score, ai_grade, verdict, fit_summary, negotiation_note, status,
              source, job_url, evaluated_at, report_file
            ) VALUES (
              ?, 1, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `);
          const insertStrength = db.prepare('INSERT INTO application_strengths (application_id, strength) VALUES (?, ?)');
          const insertGap = db.prepare('INSERT INTO application_gaps (application_id, gap) VALUES (?, ?)');
          const insertPrep = db.prepare('INSERT INTO application_interview_prep (application_id, question) VALUES (?, ?)');
          const insertAction = db.prepare('INSERT INTO application_action_items (application_id, action_item) VALUES (?, ?)');

          for (const item of apps) {
            insertApp.run(
              String(item.id || crypto.randomUUID()),
              item.company || 'Unknown',
              item.role || 'Software Engineer',
              item.location || 'Remote',
              item.salary_estimate || 'Competitive',
              Number(item.score || 0),
              item.grade || 'B',
              item.verdict || 'Ready to Apply',
              item.fit_summary || '',
              item.negotiation_note || '',
              item.status || 'evaluated',
              item.source || 'scanner',
              item.url || item.apply_url || '',
              item.timestamp || item.evaluated_at || new Date().toISOString(),
              item.report_file || ''
            );
            if (Array.isArray(item.strengths)) {
              for (const s of item.strengths) insertStrength.run(String(item.id), s);
            }
            if (Array.isArray(item.gaps)) {
              for (const g of item.gaps) insertGap.run(String(item.id), g);
            }
            if (Array.isArray(item.interview_prep)) {
              for (const p of item.interview_prep) insertPrep.run(String(item.id), p);
            }
            if (Array.isArray(item.action_items)) {
              for (const a of item.action_items) insertAction.run(String(item.id), a);
            }
          }
        }
      }
    } catch {}
  }

  // Seed scanned jobs from data/scan-results.json if available
  const scanCount = db.prepare('SELECT COUNT(*) AS c FROM scanned_jobs').get().c;
  if (scanCount === 0) {
    try {
      const scanJsonPath = path.resolve(repoRoot, 'data/scan-results.json');
      if (fs.existsSync(scanJsonPath)) {
        const scanItems = JSON.parse(fs.readFileSync(scanJsonPath, 'utf8'));
        if (Array.isArray(scanItems) && scanItems.length > 0) {
          const insertScan = db.prepare(`
            INSERT INTO scanned_jobs (
              scan_session_id, company_name, role_title, location, job_url,
              source, posted_at, is_evaluated, raw_data, scraped_at
            ) VALUES (
              1, ?, ?, ?, ?,
              ?, ?, ?, ?, ?
            )
          `);
          for (const item of scanItems.slice(0, 300)) {
            insertScan.run(
              item.company || 'Unknown',
              item.role || 'Engineer',
              item.location || 'Remote',
              item.url || '',
              item.source || 'scanner',
              item.posted || null,
              item.status === 'evaluated' ? 1 : 0,
              JSON.stringify(item),
              item.scanned_at || new Date().toISOString()
            );
          }
        }
      }
    } catch {}
  }
}

function parseJsonArrayField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function executeSqliteQuery(sql, params = []) {
  const db = getSqliteDb();
  let cleanSql = String(sql || '').trim();

  // 1. Convert PostgreSQL specific functions to SQLite equivalents
  cleanSql = cleanSql.replace(/NOW\(\)/gi, "datetime('now')");
  cleanSql = cleanSql.replace(/json_agg\s*\(/gi, 'json_group_array(');
  cleanSql = cleanSql.replace(/json_build_array\s*\(\s*\)/gi, 'json_array()');
  cleanSql = cleanSql.replace(/jsonb_build_object\s*\(/gi, 'json_object(');
  cleanSql = cleanSql.replace(/\bTRUE\b/gi, '1');
  cleanSql = cleanSql.replace(/\bFALSE\b/gi, '0');
  cleanSql = cleanSql.replace(/::text/gi, '');
  cleanSql = cleanSql.replace(/::int/gi, '');

  // 2. Normalize parameter markers:
  // If params is an array and query uses $1, $2, replace with ?
  const values = [];
  if (Array.isArray(params)) {
    cleanSql = cleanSql.replace(/\$\d+/g, '?');
    values.push(...params);
  } else if (params && typeof params === 'object') {
    // If query uses :paramName, replace with ? and collect in order
    cleanSql = cleanSql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
      values.push(params[name]);
      return '?';
    });
  }

  // 3. Detect statement type
  const isSelect = /^\s*SELECT\b/i.test(cleanSql);
  const isInsert = /^\s*INSERT\s+INTO\b/i.test(cleanSql);
  const hasReturning = /\bRETURNING\b/i.test(cleanSql);

  const stmt = db.prepare(cleanSql);

  if (isSelect) {
    const rows = stmt.all(...values);
    // Parse JSON string fields automatically if present
    for (const row of rows) {
      if (typeof row.strengths === 'string') row.strengths = parseJsonArrayField(row.strengths);
      if (typeof row.gaps === 'string') row.gaps = parseJsonArrayField(row.gaps);
      if (typeof row.interview_prep === 'string') row.interview_prep = parseJsonArrayField(row.interview_prep);
      if (typeof row.action_items === 'string') row.action_items = parseJsonArrayField(row.action_items);
      if (typeof row.meta === 'string') {
        try { row.meta = JSON.parse(row.meta); } catch {}
      }
      if (typeof row.sources_used === 'string') row.sources_used = parseJsonArrayField(row.sources_used);
      if (typeof row.keywords_used === 'string') row.keywords_used = parseJsonArrayField(row.keywords_used);
    }
    return rows;
  }

  if (isInsert && hasReturning) {
    const row = stmt.get(...values);
    const rows = row ? [row] : [];
    rows.insertId = row?.id;
    rows.rowCount = 1;
    rows.affectedRows = 1;
    return rows;
  }

  const info = stmt.run(...values);
  const rows = [];
  rows.insertId = info.lastInsertRowid;
  rows.rowCount = info.changes;
  rows.affectedRows = info.changes;
  return rows;
}
