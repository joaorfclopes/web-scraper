import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = join(__dirname, '..', 'configs', 'aws-workshop.json');

export async function loadConfig(configPath) {
  const defaultRaw = await readFile(defaultConfigPath, 'utf-8');
  const defaults = JSON.parse(defaultRaw);

  if (!configPath) return defaults;

  const userRaw = await readFile(resolve(configPath), 'utf-8');
  const userConfig = JSON.parse(userRaw);

  return {
    ...defaults,
    ...userConfig,
    nav: { ...defaults.nav, ...(userConfig.nav ?? {}) },
    sidebar: { ...defaults.sidebar, ...(userConfig.sidebar ?? {}) },
    pdfOptions: { ...defaults.pdfOptions, ...(userConfig.pdfOptions ?? {}) },
  };
}
