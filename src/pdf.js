import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export async function savePdf(page, url, outputPath, config, { force = false } = {}) {
  if (!force && existsSync(outputPath)) {
    return { skipped: true };
  }

  await mkdir(dirname(outputPath), { recursive: true });

  try {
    await page.goto(url, { waitUntil: config.waitFor, timeout: 60000 });
  } catch (err) {
    if (err.message.includes('ERR_ABORTED') || err.message.includes('net::ERR')) {
      throw new Error(`Navigation failed: ${err.message}`);
    }
    // timeout on networkidle is acceptable — page may still be usable
  }

  await applyPrintStyles(page, config);

  await page.pdf({
    path: outputPath,
    ...config.pdfOptions,
  });

  return { skipped: false };
}

/**
 * Inject CSS to hide chrome (nav, header, footer) and widen the content area,
 * so the PDF captures only the page content.
 */
async function applyPrintStyles(page, config) {
  const hide = config.hideSelectors ?? [];
  const widen = config.widenSelectors ?? [];

  const css = [
    hide.length ? `${hide.join(',\n')} { display: none !important; }` : '',
    widen.length
      ? `${widen.join(',\n')} { margin-left: 0 !important; padding-left: 0 !important; max-width: 100% !important; width: 100% !important; }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (css) {
    await page.addStyleTag({ content: css });
    await page.waitForTimeout(400);
  }
}
