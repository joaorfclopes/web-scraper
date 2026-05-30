import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { preparePage } from './render.js';

export async function savePdf(page, url, outputPath, config, { force = false } = {}) {
  if (!force && existsSync(outputPath)) return { skipped: true };
  await mkdir(dirname(outputPath), { recursive: true });

  await preparePage(page, url, config);

  await page.pdf({ path: outputPath, ...config.pdfOptions });

  return { skipped: false };
}
