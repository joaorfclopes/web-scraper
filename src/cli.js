#!/usr/bin/env node
import { program } from 'commander';
import { chromium } from 'playwright';
import { resolve, join } from 'path';
import { ensureSessionDir, sessionPath } from './auth.js';
import { loadConfig } from './config.js';
import { discoverPages, buildFilename, newFilenameState } from './nav.js';
import { savePdf } from './pdf.js';
import { saveHtml } from './html.js';
import { saveSite } from './site.js';

program
  .name('wscrape')
  .description('Download workshop/docs pages as PDFs')
  .version('1.0.0');

// ── login ──────────────────────────────────────────────────────────────────

program
  .command('login <pageUrl>')
  .description('Open browser, log in, save full session state')
  .action(async (pageUrl) => {
    await ensureSessionDir();

    console.log('Opening browser...');
    console.log('1. Log in and navigate to a workshop page');
    console.log('2. Once you see workshop content with sidebar, come back here and press Enter\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pageUrl);

    await waitForEnter();

    // Save full storage state (cookies + localStorage + sessionStorage)
    await context.storageState({ path: sessionPath });
    await browser.close();

    console.log(`Session saved to ${sessionPath}`);
  });

// ── run ───────────────────────────────────────────────────────────────────

program
  .command('run <baseUrl>')
  .description('Scrape all pages as PDF, HTML, or offline linked site')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-c, --config <file>', 'Custom config JSON (overrides AWS workshop defaults)')
  .option('-f, --format <type>', 'Output format: pdf, html, or site', 'pdf')
  .option('--force', 'Overwrite existing files', false)
  .option('--dry-run', 'List pages without downloading', false)
  .action(async (baseUrl, opts) => {
    const { existsSync } = await import('fs');
    if (!existsSync(sessionPath)) {
      console.error('No session found. Run: wscrape login <url>');
      process.exit(1);
    }

    if (!['pdf', 'html', 'site'].includes(opts.format)) {
      console.error(`Invalid format: "${opts.format}". Use pdf, html, or site.`);
      process.exit(1);
    }

    const config = await loadConfig(opts.config);
    const outputDir = resolve(opts.output);
    const ext = opts.format === 'pdf' ? 'pdf' : 'html';
    const save = { pdf: savePdf, html: saveHtml, site: saveSite }[opts.format];

    console.log('Loading session...');

    const browser = await chromium.launch({ headless: true });
    // Restore full storageState (cookies + localStorage)
    const context = await browser.newContext({ storageState: sessionPath, bypassCSP: true });
    const page = await context.newPage();

    console.log(`Navigating to ${baseUrl}...`);
    try {
      await page.goto(baseUrl, { waitUntil: config.waitFor, timeout: 60000 });
    } catch {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    const currentUrl = page.url();
    const sameHost = new URL(currentUrl).hostname === new URL(baseUrl).hostname;
    const hitLogin = config.loginIndicator && currentUrl.includes(config.loginIndicator);
    if (!sameHost || hitLogin) {
      console.error(`Redirected to: ${currentUrl}`);
      console.error('Session expired or invalid. Re-run: wscrape login <url>');
      await browser.close();
      process.exit(1);
    }

    console.log('Discovering pages...');
    const pages = await discoverPages(page, baseUrl, config);

    if (pages.length === 0) {
      console.error('No pages found. Check nav selectors with --config or inspect the site DOM.');
      await browser.close();
      process.exit(1);
    }

    console.log(`Found ${pages.length} pages.\n`);

    if (opts.dryRun) {
      const state = newFilenameState();
      pages.forEach((p) => {
        const filename = buildFilename(p, state, ext);
        console.log(`  ${filename}`);
        console.log(`    ${p.url}`);
      });
      await browser.close();
      return;
    }

    // Build url→filename map + ordered file list for --format site
    // (needed to rewrite nav links and wire next/prev navigation)
    const urlToFilename = {};
    const orderedFiles = [];
    if (opts.format === 'site') {
      const mapState = newFilenameState();
      pages.forEach((p) => {
        const fn = buildFilename(p, mapState, 'html');
        urlToFilename[p.url] = fn;
        orderedFiles.push(fn);
      });
    }

    const failed = [];
    let downloaded = 0;
    let skipped = 0;
    const state = newFilenameState();

    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];
      const filename = buildFilename(pageInfo, state, ext);
      const outputPath = join(outputDir, filename);

      process.stdout.write(`[${i + 1}/${pages.length}] ${filename} ... `);

      try {
        const result = await save(page, pageInfo.url, outputPath, config, { force: opts.force, urlToFilename, orderedFiles, index: i });
        if (result.skipped) {
          console.log('skipped');
          skipped++;
        } else {
          console.log('done');
          downloaded++;
        }
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        failed.push({ filename, url: pageInfo.url, error: err.message });
      }
    }

    await browser.close();

    console.log(`\n── Summary ──────────────────`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped:    ${skipped}`);
    console.log(`Failed:     ${failed.length}`);
    if (failed.length > 0) {
      console.log('\nFailed pages:');
      failed.forEach((f) => console.log(`  ${f.filename}\n    ${f.url}\n    ${f.error}`));
    }
  });

program.parse();

function waitForEnter() {
  return new Promise((resolve) => {
    import('readline').then(({ createInterface }) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Press Enter when logged in and workshop content is visible... ', () => {
        rl.close();
        resolve();
      });
    });
  });
}
