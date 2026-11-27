import { ensureJsonFile, readJson, writeJson, resolveDataPath } from './fileDb.js';

const sessionFile = resolveDataPath('session.json');
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000;

await ensureJsonFile(sessionFile, { userId: null, expiresAt: null });

export async function getSessionUserId() {
  const session = await readJson(sessionFile, { userId: null, expiresAt: null });
  if (!session.userId) return null;

  if (session.expiresAt && Date.now() > Date.parse(session.expiresAt)) {
    await setSessionUserId(null);
    return null;
  }

  return session.userId;
}

export async function setSessionUserId(userId) {
  await writeJson(sessionFile, {
    userId: userId || null,
    expiresAt: userId ? new Date(Date.now() + SESSION_TTL_MS).toISOString() : null
  });
}
