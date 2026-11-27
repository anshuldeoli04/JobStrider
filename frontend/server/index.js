import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import zeroApi, { workspaceRoot } from './zeroApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  })
);

const port = process.env.PORT || 3001;
const host = process.env.HOST || '127.0.0.1';
const configuredOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      return true;
    }
  } catch {}
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed.'));
    }
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use(globalLimiter);

app.use('/api/config', express.json({ limit: '2mb' }));
app.use('/api/auth', express.json({ limit: '2mb' }));
app.use('/api/evaluate', express.json({ limit: '500kb' }));
app.use('/api/resume', express.json({ limit: '500kb' }));
app.use(express.json({ limit: '200kb' }));
app.use('/api/config/cv-pdf', express.raw({ type: 'application/pdf', limit: '10mb' }));

// Safe file download & preview route strictly confined to the isolated frontend workspace
app.use('/files/:folder/:filename(*)', (req, res) => {
  try {
    const { folder, filename } = req.params;
    if (!['output', 'reports'].includes(folder)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const baseDir = path.resolve(workspaceRoot, folder);
    const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
    const safePath = path.resolve(baseDir, filename);
    if (!safePath.startsWith(normalizedBase)) {
      return res.status(403).json({ error: 'Directory traversal detected.' });
    }
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'File not found.' });
    }
    const stat = fs.statSync(safePath);
    if (!stat.isFile()) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    return res.sendFile(safePath);
  } catch {
    return res.status(500).json({ error: 'Error reading file.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'jobstrider-frontend-bridge',
    storage: 'isolated-workspace',
    repoRoot: path.basename(repoRoot)
  });
});

app.use('/api', zeroApi);
app.use(zeroApi);

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/files') || path.extname(req.path)) {
      return next();
    }
    if (req.accepts('html')) {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        try {
          const html = fs.readFileSync(indexHtml, 'utf8');
          res.type('html');
          return res.send(html);
        } catch {
          return res.sendFile(indexHtml);
        }
      }
    }
    next();
  });
}

app.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({
    error: error.message || 'Unexpected server error'
  });
});

let server = null;
if (process.env.NODE_ENV !== 'test' && !process.env.DISABLE_SERVER_LISTEN) {
  server = app.listen(port, host, () => {
    console.log(`JobStrider bridge on http://${host}:${port}`);
    if (host !== '127.0.0.1' && host !== 'localhost') {
      console.warn('WARNING: server is exposed beyond localhost. Authentication is not designed for public exposure.');
    }
  });
}

export { app, server };
export default app;
