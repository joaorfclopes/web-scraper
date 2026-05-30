#!/usr/bin/env node
import { program } from 'commander';
import { chromium } from 'playwright';
import { resolve, join } from 'path';
import { createInterface } from 'readline';
import { saveSession, loadSession, sessionPath } from './auth.js';
import { loadConfig } from './config.js';
import { discoverPages, buildFilename } from './nav.js';
import { savePdf } from './pdf.js';

program
  .name('wscrape')
  .description('Download workshop/docs pages as PDFs')
  .version('1.0.0');

// ── login ──────────────────────────────────────────────────────────────────

program
  .command('login <baseUrl>')
  .description('Open browser, log in, save session cookies')
  .action(async (baseUrl) => {
    console.log('Opening browser — log in, then press Enter here to save session...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl);

    await waitForEnter();

    const cookies = await context.cookies();
    await saveSession(cookies);
    await browser.close();

    console.log(`Session saved to ${sessionPath}`);
    console.log(`Cookies saved: ${cookies.length}`);
  });

// ── run ───────────────────────────────────────────────────────────────────

program
  .command('run <baseUrl>')
  .description('Scrape all pages and save as PDFs')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-c, --config <file>', 'Custom config JSON (overrides AWS workshop defaults)')
  .option('--force', 'Overwrite existing PDFs', false)
  .option('--dry-run', 'List pages without downloading', false)
  .action(async (baseUrl, opts) => {
    const cookies = await loadSession();
    if (!cookies) {
      console.error('No session found. Run: wscrape login <url>');
      process.exit(1);
    }

    const config = await loadConfig(opts.config);
    const outputDir = resolve(opts.output);

    console.log(`Loading session (${cookies.length} cookies)...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(cookies);
    const page = await context.newPage();

    console.log(`Navigating to ${baseUrl}...`);
    try {
      await page.goto(baseUrl, { waitUntil: config.waitFor, timeout: 60000 });
    } catch {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    // Check if redirected to login
    const currentUrl = page.url();
    if (!currentUrl.includes(new URL(baseUrl).hostname)) {
      console.error('Redirected away from site — session may be expired. Re-run: wscrape login <url>');
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
      const groupCounters = new Map();
      pages.forEach((p, i) => {
        const filename = buildFilename(p, i, pages.length, groupCounters);
        console.log(`  ${filename}`);
        console.log(`    ${p.url}`);
      });
      await browser.close();
      return;
    }

    const failed = [];
    let downloaded = 0;
    let skipped = 0;
    const groupCounters = new Map();

    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];
      const filename = buildFilename(pageInfo, i, pages.length, groupCounters);
      const outputPath = join(outputDir, filename);

      process.stdout.write(`[${i + 1}/${pages.length}] ${filename} ... `);

      try {
        const result = await savePdf(page, pageInfo.url, outputPath, config, { force: opts.force });
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
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter when logged in... ', () => {
      rl.close();
      resolve();
    });
  });
}
