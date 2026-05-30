# wscrape

Download workshop or documentation pages as PDFs or self-contained HTML files, preserving your authenticated session.

## Install

```bash
npm install
npx playwright install chromium
npm link          # makes `wscrape` available globally
```

## Usage

### 1. Login

Opens a browser window so you can log in interactively. Press Enter once you see the content you want to scrape.

```bash
wscrape login <url>
```

Example:
```bash
wscrape login "https://catalog.workshops.aws/event/dashboard/en-US/workshop"
```

### 2. Run

```bash
wscrape run <baseUrl> -o <output-dir> [options]
```

| Option | Default | Description |
|---|---|---|
| `-o, --output <dir>` | required | Output directory |
| `-f, --format <type>` | `pdf` | `pdf`, `html`, or `site` |
| `-c, --config <file>` | AWS workshop | Custom config JSON |
| `--force` | false | Overwrite existing files |
| `--dry-run` | false | List pages without downloading |

#### Formats

- **`pdf`** — one PDF per page, content only (no sidebar/header/footer)
- **`html`** — one self-contained HTML per page, content only; open in any browser; text is selectable and searchable (Cmd+F); JS widgets won't work offline
- **`site`** — one HTML per page WITH sidebar; nav links rewritten to open sibling local files; browse offline like the real site (minus JS)

#### Examples

```bash
# Preview what will be downloaded
wscrape run "https://catalog.workshops.aws/event/dashboard/en-US/workshop" -o ./output --dry-run

# Download all pages as PDFs (default)
wscrape run "https://catalog.workshops.aws/event/dashboard/en-US/workshop" -o ./output

# Download as searchable HTML (content only)
wscrape run "https://catalog.workshops.aws/event/dashboard/en-US/workshop" -o ./output-html --format html

# Download as offline browsable site (with sidebar + local nav links)
wscrape run "https://catalog.workshops.aws/event/dashboard/en-US/workshop" -o ./output-site --format site

# Re-download everything, overwriting existing files
wscrape run "https://..." -o ./output --force
```

Output files are named and numbered by nav order:
```
01 Overview.pdf
02 Introduction.pdf
03.01 Getting Started - Environment Setup.pdf
03.02 Getting Started - TaskFlow Setup.pdf
```

## Use on another site

Copy the default config and edit it for the target site's nav structure:

```bash
cp configs/aws-workshop.json configs/mysite.json
# edit configs/mysite.json
wscrape login "https://mysite.com/docs/intro"
wscrape run "https://mysite.com/docs/intro" -o ./out --config configs/mysite.json --dry-run
```

### Config reference

```json
{
  "loginIndicator": "/login",
  "basePath": "/docs",
  "nav": {
    "containerSelector": "nav.sidebar",
    "itemSelector": "a[href]",
    "groupSelector": ".nav-group",
    "groupTitleSelector": ".nav-group-title"
  },
  "includeBasePage": true,
  "basePageTitle": "Overview",
  "hideSelectors": ["nav.sidebar", "header", "footer"],
  "widenSelectors": ["main", ".content"],
  "waitFor": "networkidle",
  "pdfOptions": {
    "format": "A4",
    "printBackground": true,
    "margin": { "top": "15mm", "bottom": "15mm", "left": "12mm", "right": "12mm" }
  }
}
```

| Key | Description |
|---|---|
| `loginIndicator` | URL substring that indicates a redirect to the login page (triggers session-expired error) |
| `basePath` | Explicit path prefix for nav links. Auto-detected from `baseUrl` if omitted. |
| `nav.containerSelector` | CSS selector for the nav sidebar container |
| `nav.itemSelector` | CSS selector for nav links within the container |
| `nav.groupSelector` | CSS selector for collapsible group wrappers |
| `nav.groupTitleSelector` | CSS selector for group title elements (within a group wrapper) |
| `includeBasePage` | Prepend the baseUrl page itself (useful when the root page isn't in the sidebar) |
| `basePageTitle` | Title used for the base page in the filename |
| `hideSelectors` | Elements to hide in PDF/HTML content-only output |
| `widenSelectors` | Elements to stretch full-width in PDF/HTML content-only output |
| `waitFor` | Playwright `waitUntil` value: `networkidle`, `load`, or `domcontentloaded` |
| `pdfOptions` | Passed directly to Playwright's `page.pdf()` |

**Tips:**
- Use browser DevTools to find the right selectors for a new site
- Use `--dry-run` to verify page discovery before downloading
- If pages are missing, check that `nav.containerSelector` matches the correct element
