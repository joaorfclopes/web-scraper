import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { createRequire } from 'module';
import { preparePage } from './render.js';
import { copyScript, injectScripts } from './inject.js';

const require = createRequire(import.meta.url);
const { script: singlefileScript } = require('single-file-cli/lib/single-file-bundle.js');

export async function saveHtml(page, url, outputPath, config, { force = false } = {}) {
  if (!force && existsSync(outputPath)) return { skipped: true };
  await mkdir(dirname(outputPath), { recursive: true });

  await preparePage(page, url, config);

  // Strip all scripts from DOM before snapshot — app JS fails offline and injects error messages
  await page.evaluate(() => document.querySelectorAll('script').forEach((s) => s.remove()));

  await page.addScriptTag({ content: singlefileScript });
  const pageData = await page.evaluate(async () =>
    await singlefile.getPageData({
      removeHiddenElements: true,
      removeUnusedStyles: true,
      removeUnusedFonts: true,
      removeScripts: true,
      compressHTML: true,
    })
  );

  await writeFile(outputPath, injectScripts(pageData.content, copyScript));
  return { skipped: false };
}
