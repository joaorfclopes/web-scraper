export async function preparePage(page, url, config, { keepChrome = false } = {}) {
  try {
    await page.goto(url, { waitUntil: config.waitFor, timeout: 60000 });
  } catch (err) {
    if (err.message.includes('ERR_ABORTED') || err.message.includes('net::ERR')) {
      throw new Error(`Navigation failed: ${err.message}`);
    }
    // networkidle timeout acceptable — page may still be usable
  }
  if (!keepChrome) await applyPrintStyles(page, config);
}

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
