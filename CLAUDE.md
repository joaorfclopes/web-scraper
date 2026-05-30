# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

```bash
npm install
npx playwright install chromium
npm link   # exposes `wscrape` globally
```

## Common commands

```bash
wscrape login <url>                            # interactive login, saves session
wscrape run <url> -o ./output                  # download as PDF (default)
wscrape run <url> -o ./output --format html    # content-only HTML snapshots
wscrape run <url> -o ./output --format site    # full-page HTML with local nav links
wscrape run <url> -o ./output --dry-run        # list pages without downloading
wscrape run <url> -o ./output --force          # overwrite existing files
wscrape run <url> -o ./output --config custom.json # use custom site config
```

## Architecture

Two-step CLI (`src/cli.js` via commander): `login` saves Playwright storageState (cookies + localStorage); `run` restores it via `browser.newContext({ storageState, bypassCSP: true })`.

**Page discovery** (`src/nav.js`): navigates to `baseUrl`, queries the nav container in the live DOM, walks `a[href]` links filtered to `basePath`, groups by nearest `groupSelector` ancestor. Returns ordered `[{ title, url, groupTitle }]`. `buildFilename(pageInfo, state, ext)` produces sortable flat names like `03.02 Group - Page.pdf`.

**Format dispatch** (`src/cli.js`): `--format` selects `savePdf` / `saveHtml` / `saveSite`. A `urlToFilename` map is pre-built before the download loop (needed by `saveSite` for link rewriting).

**Shared page prep** (`src/render.js`): `preparePage(page, url, config, { keepChrome })` — navigates, then injects hide/widen CSS unless `keepChrome: true`. Used by all three save functions.

**PDF** (`src/pdf.js`): `preparePage` → `page.pdf()`.

**HTML content-only** (`src/html.js`): `preparePage` (hides sidebar/chrome) → strips all `<script>` tags → injects SingleFile bundle as string → calls `singlefile.getPageData()` → appends copy-button script via `injectScripts`.

**HTML site** (`src/site.js`): `preparePage` with `keepChrome: true` → force-clicks nav group headers to expand them → rewrites ALL `a[href]` in the document to local filenames from `urlToFilename` → strips scripts → SingleFile snapshot → injects copy-button script.

**Script injection** (`src/inject.js`): `copyScript` string (vanilla JS event delegation on button clicks, copies nearest `pre`/`code` text) + `injectScripts(html, ...scripts)` appends before `</body>`.

**Config** (`src/config.js`): deep-merges user `--config` over `configs/default.json`. All config keys flow through; no hardcoded selectors outside the JSON.

## Key config fields

| Key | Purpose |
|---|---|
| `loginIndicator` | URL substring indicating session/login page (triggers "session expired" error) |
| `basePath` | Override auto-detected path prefix for nav items |
| `nav.containerSelector` | CSS selector for nav/sidebar container |
| `nav.groupSelector` | CSS selector for collapsible group wrappers |
| `nav.groupTitleSelector` | CSS selector for group titles within groups |
| `hideSelectors` | Elements hidden in PDF/HTML content-only output |
| `widenSelectors` | Elements stretched full-width in PDF/HTML output |

## SingleFile integration

`single-file-cli` exports `{ script, hookScript, zipScript }` — string values, not live globals. Inject via `page.addScriptTag({ content: script })`. Requires `bypassCSP: true` on the browser context. `removeScripts: true` option is passed to `getPageData` but scripts are also manually stripped from the DOM beforehand for reliability.
