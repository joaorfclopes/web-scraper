// Injected into saved HTML files to restore copy-button functionality offline.
// Finds the nearest <pre>, strips the line-number gutter, copies only the code.
export const copyScript = `<script>
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-testid=copy-button], button');
    if (!btn) return;
    var el = btn, pre = null;
    while (el && el !== document.body) {
      pre = el.querySelector('pre');
      if (pre) break;
      el = el.parentElement;
    }
    if (!pre) return;
    var clone = pre.cloneNode(true);
    clone.querySelectorAll('.react-syntax-highlighter-line-number').forEach(function (n) { n.remove(); });
    var text = (clone.innerText || clone.textContent || '').replace(/\\n+$/, '');
    navigator.clipboard.writeText(text).catch(function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    e.preventDefault();
  }, true);
})();
</script>`;

// Restores sidebar collapse/expand. Adds a floating arrow to reopen when collapsed.
export const navToggleScript = `<script>
(function () {
  var nav = document.querySelector('[class*="awsui_navigation-container"]') ||
            document.querySelector('nav[class*="awsui_navigation"]');
  if (!nav) return;
  var fab = document.createElement('button');
  fab.textContent = '\\u203A';
  fab.setAttribute('aria-label', 'Open navigation');
  fab.style.cssText = 'position:fixed;top:80px;left:0;z-index:9999;display:none;cursor:pointer;border:1px solid #ccc;border-left:none;background:#fff;padding:8px 12px;font-size:18px;line-height:1;border-radius:0 6px 6px 0;box-shadow:0 1px 4px rgba(0,0,0,0.2)';
  document.body.appendChild(fab);
  function setHidden(h) {
    nav.style.display = h ? 'none' : '';
    fab.style.display = h ? 'block' : 'none';
  }
  fab.addEventListener('click', function (e) { e.preventDefault(); setHidden(false); });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest(
      'button[class*="navigation-toggle"], button[class*="navigation-close"], [class*="awsui_navigation-toggle"]'
    );
    if (!btn) return;
    e.preventDefault();
    setHidden(nav.style.display !== 'none');
  }, true);
})();
</script>`;

// Wires the SPA next/previous buttons to navigate the local files in numeric order.
export function navButtonsScript(orderedFiles, index) {
  const data = JSON.stringify({ files: orderedFiles, index });
  return `<script>
(function () {
  var d = ${data};
  function go(i) { if (i >= 0 && i < d.files.length) location.href = encodeURI(d.files[i]); }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-testid=preview-component-next-btn]')) { e.preventDefault(); go(d.index + 1); }
    else if (e.target.closest('[data-testid=preview-component-previous-btn]')) { e.preventDefault(); go(d.index - 1); }
  }, true);
})();
</script>`;
}

// Toggles dark/light mode via the Settings button. Persists choice in localStorage.
export const darkModeScript = `<script>
(function () {
  var KEY = 'wscrape-theme';
  var isDark = localStorage.getItem(KEY) === 'dark';

  function apply() {
    document.documentElement.setAttribute('data-wscrape-theme', isDark ? 'dark' : 'light');
  }

  function toggle() {
    isDark = !isDark;
    localStorage.setItem(KEY, isDark ? 'dark' : 'light');
    apply();
  }

  apply();

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[aria-label=Settings]');
    if (btn) { e.preventDefault(); toggle(); return; }
    var item = e.target.closest('li, [role=menuitem], button');
    if (item && /dark|light/i.test(item.textContent || '')) { e.preventDefault(); toggle(); }
  }, true);
})();
</script><style>
/* Invert the whole page. html bg covers scroll gutters. */
[data-wscrape-theme=dark] html { background-color: #000 !important; }
[data-wscrape-theme=dark] body {
  filter: invert(1) hue-rotate(180deg);
  background-color: #fff !important;
}
/* Double-invert chrome that is already dark → cancels out, stays dark */
[data-wscrape-theme=dark] [class*="awsui_top-navigation"],
[data-wscrape-theme=dark] [class*="awsui_navigation-container"],
[data-wscrape-theme=dark] nav[class*="awsui"],
[data-wscrape-theme=dark] [class*="awsui_footer"],
[data-wscrape-theme=dark] footer {
  filter: invert(1) hue-rotate(180deg);
}
/* Double-invert images/media in the content area so they look natural */
[data-wscrape-theme=dark] main img,
[data-wscrape-theme=dark] main svg,
[data-wscrape-theme=dark] main video,
[data-wscrape-theme=dark] main canvas {
  filter: invert(1) hue-rotate(180deg);
}
/* Double-invert pre: cancels body filter, so colors render as literal values */
[data-wscrape-theme=dark] pre {
  filter: invert(1) hue-rotate(180deg) !important;
  background-color: #282C34 !important;
  color: #fff !important;
}
[data-wscrape-theme=dark] pre * {
  color: inherit !important;
}
</style>`;

export function injectScripts(html, ...scripts) {
  const tag = scripts.join('\n');
  const idx = html.lastIndexOf('</body>');
  return idx !== -1 ? html.slice(0, idx) + tag + html.slice(idx) : html + tag;
}
