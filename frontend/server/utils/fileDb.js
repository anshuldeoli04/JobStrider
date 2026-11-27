import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveDataPath(relativePath) {
  const baseDir = process.env.JOBSTRIDER_TEST_WORKSPACE
    ? path.join(path.resolve(process.env.JOBSTRIDER_TEST_WORKSPACE), 'data')
    : path.join(fileURLToPath(new URL('../../../', import.meta.url)), 'data');
  return path.join(baseDir, relativePath);
}

function normalizeTarget(targetPath) {
  if (typeof targetPath === 'string') {
    return targetPath.startsWith('file:') ? fileURLToPath(new URL(targetPath)) : targetPath;
  }
  if (targetPath instanceof URL) {
    return fileURLToPath(targetPath);
  }
  return String(targetPath);
}

export async function ensureJsonFile(targetPath, fallbackValue) {
  const filePath = normalizeTarget(targetPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, JSON.stringify(fallbackValue, null, 2));
  }
}

export async function readJson(targetPath, fallbackValue) {
  try {
    const filePath = normalizeTarget(targetPath);
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

export async function writeJson(targetPath, value) {
  const filePath = normalizeTarget(targetPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2));
  await rename(tmpPath, filePath);
}
