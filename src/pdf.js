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

  // Collapse sidebar if toggle exists
  if (config.sidebar?.toggleSelector) {
    try {
      const toggle = page.locator(config.sidebar.toggleSelector).first();
      if (await toggle.isVisible({ timeout: 3000 })) {
        await toggle.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // sidebar toggle not found or not clickable — continue
    }
  }

  await page.pdf({
    path: outputPath,
    ...config.pdfOptions,
  });

  return { skipped: false };
}
