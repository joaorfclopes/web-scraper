import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { createRequire } from 'module';
import { preparePage } from './render.js';
import { copyScript, navToggleScript, navButtonsScript, darkModeScript, injectScripts } from './inject.js';

const require = createRequire(import.meta.url);
const { script: singlefileScript } = require('single-file-cli/lib/single-file-bundle.js');

export async function saveSite(page, url, outputPath, config, { force = false, urlToFilename = {}, orderedFiles = [], index = 0 } = {}) {
  if (!force && existsSync(outputPath)) return { skipped: true };
  await mkdir(dirname(outputPath), { recursive: true });

  // Intercept image responses at network level to capture raw bytes.
  // SingleFile uses in-page fetch() which is blocked by CORS on CDN origins;
  // Playwright interception bypasses this, letting us pre-convert to data URIs.
  const capturedImages = new Map();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'image') {
      try {
        const response = await route.fetch();
        const body = await response.body();
        const ct = (response.headers()['content-type'] || 'image/jpeg').split(';')[0].trim();
        capturedImages.set(route.request().url(), `data:${ct};base64,${body.toString('base64')}`);
        await route.fulfill({ response });
      } catch {
        await route.continue();
      }
    } else {
      await route.continue();
    }
  });

  await preparePage(page, url, config, { keepChrome: true });

  // Scroll through page to trigger lazy-loaded images, then reset scroll position
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(window.innerHeight, 400);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await delay(80);
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  // Replace img src with captured data URIs so SingleFile inlines them as-is
  await page.unroute('**/*');
  if (capturedImages.size > 0) {
    await page.evaluate((imageMap) => {
      document.querySelectorAll('img[src]').forEach((img) => {
        const uri = imageMap[img.src];
        if (uri) { img.src = uri; img.removeAttribute('srcset'); img.removeAttribute('loading'); }
      });
    }, Object.fromEntries(capturedImages));
  }

  // Remove notifications banner (e.g. "Event ends in...") before snapshot
  await page.evaluate(() => {
    document.querySelectorAll(
      '[aria-label="Notifications"], #app-notifications, [data-itemid="EVENT_STATE"], [data-testid="preview-component-side-nav-footer"]'
    ).forEach((el) => el.remove());
  });

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

  // Nullify any remaining AWS links (logo, breadcrumbs, exit button, etc.)
  const awsOrigin = new URL(url).origin;
  const awsEscaped = awsOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`href=${awsEscaped}[^ >]*`, 'g'), 'href=#');
  html = html.replace(new RegExp(`href="${awsEscaped}[^"]*"`, 'g'), 'href="#"');

  await writeFile(
    outputPath,
    injectScripts(html, copyScript, navToggleScript, navButtonsScript(orderedFiles, index), darkModeScript)
  );
  return { skipped: false };
}
