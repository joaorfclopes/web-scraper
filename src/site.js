import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { createRequire } from 'module';
import { preparePage } from './render.js';
import { copyScript, navToggleScript, navButtonsScript, injectScripts } from './inject.js';

const require = createRequire(import.meta.url);
const { script: singlefileScript } = require('single-file-cli/lib/single-file-bundle.js');

export async function saveSite(page, url, outputPath, config, { force = false, urlToFilename = {}, orderedFiles = [], index = 0 } = {}) {
  if (!force && existsSync(outputPath)) return { skipped: true };
  await mkdir(dirname(outputPath), { recursive: true });

  await preparePage(page, url, config, { keepChrome: true });

  // Force-expand all collapsed nav groups before snapshot
  await page.evaluate(({ groupSelector, groupTitleSelector }) => {
    document.querySelectorAll(groupSelector).forEach((group) => {
      const header = group.querySelector(groupTitleSelector);
      if (header) header.click();
    });
  }, { groupSelector: config.nav.groupSelector, groupTitleSelector: config.nav.groupTitleSelector });
  await page.waitForTimeout(600);

  // Rewrite all known page links (nav + next/prev) to a sentinel absolute URL.
  // Using an absolute foreign-host URL stops SingleFile from re-resolving it against
  // the AWS origin; the constant prefix is stripped post-capture. Matching by pathname
  // handles both absolute and relative source hrefs uniformly (a.href is always resolved).
  const SENTINEL = 'https://wscrape.local/';
  await page.evaluate(({ urlToFilename, sentinel }) => {
    const byPath = {};
    for (const [u, f] of Object.entries(urlToFilename)) {
      try {
        byPath[new URL(u).pathname.replace(/\/$/, '')] = f;
      } catch {}
    }
    document.querySelectorAll('a[href]').forEach((a) => {
      let filename = urlToFilename[a.href];
      if (!filename) {
        try {
          filename = byPath[new URL(a.href).pathname.replace(/\/$/, '')];
        } catch {}
      }
      if (filename) a.setAttribute('href', sentinel + encodeURIComponent(filename));
    });
  }, { urlToFilename, sentinel: SENTINEL });

  await page.evaluate(() => document.querySelectorAll('script').forEach((s) => s.remove()));

  await page.addScriptTag({ content: singlefileScript });
  const pageData = await page.evaluate(async () =>
    await singlefile.getPageData({
      removeUnusedStyles: true,
      removeUnusedFonts: true,
      removeScripts: true,
      compressHTML: true,
    })
  );

  let html = pageData.content;

  // Strip any <base> tag so relative links resolve against the local file's directory
  html = html.replace(/<base\s[^>]*>/gi, '');

  // Strip the sentinel prefix, leaving a clean %20-encoded relative filename
  html = html.replaceAll(SENTINEL, '');

  await writeFile(
    outputPath,
    injectScripts(html, copyScript, navToggleScript, navButtonsScript(orderedFiles, index))
  );
  return { skipped: false };
}
