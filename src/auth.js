import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const sessionDir = join(homedir(), '.wscrape');
export const sessionPath = join(sessionDir, 'session.json');

export async function ensureSessionDir() {
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true });
  }
}
