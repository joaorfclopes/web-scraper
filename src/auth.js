import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const sessionDir = join(homedir(), '.wscrape');
const sessionPath = join(sessionDir, 'session.json');

export async function saveSession(cookies) {
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true });
  }
  await writeFile(sessionPath, JSON.stringify(cookies, null, 2));
}

export async function loadSession() {
  if (!existsSync(sessionPath)) return null;
  try {
    const raw = await readFile(sessionPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { sessionPath };
