/**
 * Discovers all workshop pages from the nav sidebar, in DOM order.
 * Returns flat ordered array of { title, url, groupTitle }.
 * Only links whose pathname starts with basePath are kept.
 */
export async function discoverPages(page, baseUrl, config) {
  let basePath;
  if (config.basePath) {
    basePath = config.basePath.replace(/\/$/, '');
  } else {
    const rawPath = new URL(baseUrl).pathname.replace(/\/$/, '');
    if (/\/workshops\//.test(rawPath)) {
      // Public catalog: /workshops/{uuid}/{locale} — full path is the base
      basePath = rawPath;
    } else {
      const idx = rawPath.lastIndexOf('/workshop');
      basePath =
        idx !== -1
          ? rawPath.slice(0, idx + '/workshop'.length)
          : rawPath.slice(0, rawPath.lastIndexOf('/'));
    }
  }

  const pages = await page.evaluate(
    ({ containerSelector, itemSelector, groupSelector, groupTitleSelector, basePath }) => {
      const nav = document.querySelector(containerSelector) || document;
      const links = nav.querySelectorAll(itemSelector);
      const results = [];

      links.forEach((a) => {
        const href = a.getAttribute('href') || '';
        const absoluteUrl = href.startsWith('http')
          ? href
          : window.location.origin + (href.startsWith('/') ? href : '/' + href);

        let pathname;
        try {
          pathname = new URL(absoluteUrl).pathname.replace(/\/$/, '');
        } catch {
          return;
        }

        // Only keep links strictly under the base path
        if (!pathname.startsWith(basePath + '/')) return;

        const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!title) return;

        // Find nearest group ancestor
        let groupTitle = null;
        let el = a.parentElement;
        while (el && el !== nav) {
          if (el.matches(groupSelector)) {
            const titleEl = el.querySelector(groupTitleSelector);
            if (titleEl) {
              groupTitle = (titleEl.textContent || '').trim().replace(/\s+/g, ' ');
            }
            break;
          }
          el = el.parentElement;
        }

        results.push({ title, url: absoluteUrl, groupTitle });
      });

      return results;
    },
    {
      containerSelector: config.nav.containerSelector,
      itemSelector: config.nav.itemSelector,
      groupSelector: config.nav.groupSelector,
      groupTitleSelector: config.nav.groupTitleSelector,
      basePath,
    }
  );

  // Optionally prepend the base/overview page (the workshop root URL itself),
  // which the nav links to via breadcrumb rather than a sidebar item.
  if (config.includeBasePage) {
    const baseUrlClean = new URL(baseUrl).origin + basePath;
    const alreadyPresent = pages.some((p) => p.url.replace(/\/$/, '') === baseUrlClean);
    if (!alreadyPresent) {
      pages.unshift({
        title: config.basePageTitle ?? 'Overview',
        url: baseUrlClean,
        groupTitle: null,
      });
    }
  }

  return pages;
}

/**
 * Builds a flat, numbered filename for a page, preserving DOM order.
 * Top-level pages and groups share one sequential parent counter.
 * Pass the same `state` object across all pages in a run.
 *
 * Examples:
 *   01 Overview.pdf
 *   02 Introduction.pdf
 *   03.01 Getting Started - Environment Setup.pdf
 *   03.02 Getting Started - TaskFlow Setup.pdf
 */
export function buildFilename(pageInfo, state, ext = 'pdf') {
  const sanitize = (s) =>
    s.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);

  const pad = (n) => String(n).padStart(2, '0');

  if (pageInfo.groupTitle) {
    if (pageInfo.groupTitle !== state.currentGroup) {
      state.currentGroup = pageInfo.groupTitle;
      state.parentIndex += 1;
      state.childIndex = 0;
    }
    state.childIndex += 1;
    return `${pad(state.parentIndex)}.${pad(state.childIndex)} ${sanitize(pageInfo.groupTitle)} - ${sanitize(pageInfo.title)}.${ext}`;
  } else {
    state.currentGroup = null;
    state.parentIndex += 1;
    state.childIndex = 0;
    return `${pad(state.parentIndex)} ${sanitize(pageInfo.title)}.${ext}`;
  }
}

export function newFilenameState() {
  return { parentIndex: 0, childIndex: 0, currentGroup: null };
}
