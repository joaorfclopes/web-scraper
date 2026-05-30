/**
 * Discovers all workshop pages from the nav sidebar, in DOM order.
 * Returns flat ordered array of { title, url, groupTitle, depth }.
 * Only links whose pathname starts with basePath are kept.
 */
export async function discoverPages(page, baseUrl, config) {
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');

  const pages = await page.evaluate(
    ({ containerSelector, itemSelector, groupSelector, basePath }) => {
      const containers = document.querySelectorAll(containerSelector);
      const nav = containers.length > 0 ? containers[0] : document;

      const results = [];
      let currentGroup = null;
      let depth = 0;

      const allElements = nav.querySelectorAll(`${itemSelector}, ${groupSelector}`);

      allElements.forEach((el) => {
        if (el.matches(itemSelector) && el.tagName === 'A') {
          const href = el.getAttribute('href') || '';
          const absoluteUrl = href.startsWith('http')
            ? href
            : window.location.origin + (href.startsWith('/') ? href : '/' + href);

          let pathname;
          try {
            pathname = new URL(absoluteUrl).pathname.replace(/\/$/, '');
          } catch {
            return;
          }

          if (!pathname.startsWith(basePath + '/') && pathname !== basePath) return;
          if (pathname === basePath) return;

          const title = (el.textContent || '').trim().replace(/\s+/g, ' ');
          if (!title) return;

          results.push({ title, url: absoluteUrl, groupTitle: currentGroup, depth });
        } else if (el.matches(groupSelector)) {
          currentGroup = (el.textContent || '').trim().replace(/\s+/g, ' ');
          depth = 1;
        }
      });

      return results;
    },
    {
      containerSelector: config.nav.containerSelector,
      itemSelector: config.nav.itemSelector,
      groupSelector: config.nav.groupSelector,
      basePath,
    }
  );

  return pages;
}

export function buildFilename(pageInfo, index, total, groupCounters) {
  const padWidth = String(total).length;
  const pad = (n) => String(n).padStart(2, '0');

  const sanitize = (s) =>
    s.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);

  if (pageInfo.groupTitle) {
    const groupKey = pageInfo.groupTitle;
    if (!groupCounters.has(groupKey)) {
      groupCounters.set(groupKey, { parentIndex: groupCounters.size + 1, childIndex: 0 });
    }
    const group = groupCounters.get(groupKey);
    group.childIndex += 1;
    return `${pad(group.parentIndex)}.${pad(group.childIndex)} ${sanitize(pageInfo.groupTitle)} - ${sanitize(pageInfo.title)}.pdf`;
  } else {
    const globalIndex = index + 1;
    return `${pad(globalIndex)} ${sanitize(pageInfo.title)}.pdf`;
  }
}
