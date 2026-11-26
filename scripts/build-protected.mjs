import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import JavaScriptObfuscator from 'javascript-obfuscator';

const rootDir = process.cwd();
const stagingDir = path.resolve(rootDir, '.desktop-staging');

console.log('🛡️  JobStrider Anti-Reverse Engineering & Protected Desktop Build');
console.log('================================================================');

// 1. Ensure Frontend UI is built
console.log('\n[1/5] Building React Frontend UI...');
const uiBuildRes = spawnSync('npm', ['--prefix', 'frontend', 'run', 'build'], {
  stdio: 'inherit',
  shell: true,
});
if (uiBuildRes.status !== 0) {
  console.error('❌ Frontend build failed! Aborting.');
  process.exit(1);
}

// 2. Prepare staging directory
console.log('\n[2/5] Creating clean .desktop-staging environment...');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Helper to copy directory recursively with strict privacy exclusions
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    // Exclude developer data, sessions, personal test workspaces, credentials, and logs
    if (
      name === 'data' ||
      name === 'workspace' ||
      name === 'backups' ||
      name.startsWith('.env') ||
      name.endsWith('.log') ||
      name.endsWith('.tmp')
    ) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy items to staging
const itemsToCopy = [
  'desktop',
  'frontend/dist',
  'frontend/server',
  'llm',
  'src',
  'templates',
  'companies.json',
  'config.example.json',
  'cv.example.md',
  'package.json',
  'autoflow.mjs',
  'config-utils.mjs',
  'evaluate.mjs',
  'generate-pdf.mjs',
  'health.mjs',
  'interview-prep.mjs',
  'jobIdentity.mjs',
  'logger.mjs',
  'process-runner.mjs',
  'resume-builder.mjs',
  'scan-evaluate.mjs',
  'scanner.mjs',
  'setup-check.mjs',
  'setup-wizard.mjs',
  'tracker.mjs',
];

for (const item of itemsToCopy) {
  const src = path.resolve(rootDir, item);
  const dest = path.resolve(stagingDir, item);
  if (!fs.existsSync(src)) continue;
  if (fs.statSync(src).isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// 3. Obfuscate all backend JavaScript and ES Modules
console.log('\n[3/5] Obfuscating JavaScript & ES Modules with control-flow flattening & string encryption...');

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  target: 'node',
};

let obfuscatedCount = 0;

function obfuscateFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Do not re-obfuscate Vite's already bundled & minified frontend output
      if (entry.name === 'dist' && fullPath.includes('frontend')) {
        continue;
      }
      obfuscateFilesRecursively(fullPath);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))
    ) {
      const originalCode = fs.readFileSync(fullPath, 'utf8');
      try {
        const obfuscated = JavaScriptObfuscator.obfuscate(originalCode, obfuscatorOptions).getObfuscatedCode();
        fs.writeFileSync(fullPath, obfuscated, 'utf8');
        obfuscatedCount++;
      } catch (err) {
        console.warn(`  ⚠️ Failed to obfuscate ${path.relative(stagingDir, fullPath)}: ${err.message}`);
      }
    }
  }
}

obfuscateFilesRecursively(stagingDir);
console.log(`  ✔ Successfully armored & obfuscated ${obfuscatedCount} source files.`);

// 4. Packaging with Electron-Builder & Fuses
console.log('\n[4/5] Packaging standalone Desktop App with Electron Fuses & ASAR Integrity...');
const buildRes = spawnSync('npx', ['electron-builder', '--win'], {
  stdio: 'inherit',
  shell: true,
});

if (buildRes.status !== 0) {
  console.error('❌ Electron Builder failed! Aborting.');
  process.exit(1);
}

// 5. Verification
console.log('\n[5/5] Verifying binary outputs...');
const distElectron = path.resolve(rootDir, 'dist-electron');
if (fs.existsSync(distElectron)) {
  const files = fs.readdirSync(distElectron);
  console.log('  ✔ Generated Artifacts:');
  for (const f of files) {
    if (f.endsWith('.exe')) {
      const stats = fs.statSync(path.join(distElectron, f));
      console.log(`    - ${f} (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`);
    }
  }
}

console.log('\n🎉 Protected Desktop Build Complete! Binary is hardened against reverse engineering.');
