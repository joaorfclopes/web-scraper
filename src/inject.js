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

export function injectScripts(html, ...scripts) {
  const tag = scripts.join('\n');
  const idx = html.lastIndexOf('</body>');
  return idx !== -1 ? html.slice(0, idx) + tag + html.slice(idx) : html + tag;
}
