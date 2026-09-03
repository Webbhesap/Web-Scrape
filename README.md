# Web Scraper - Free Web Scraping Tool (Chrome Extension)

A powerful, modular, and visual web scraping Chrome extension built entirely with **pure HTML, CSS, and Vanilla JavaScript** (Manifest V3 compatible). No bundlers, compilers, or build steps required.

Designed to provide all the core local scraping features of [Web Scraper (webscraper.io)](https://webscraper.io/) directly in your browser.

---

## 🌟 Key Features

### 1. Visual Element Picker (Point-and-Click Selector)
- **Hover & Highlight**: Real-time visual overlay highlighting hovered DOM elements with tag name, class names, and IDs.
- **Smart Generalization**: Multi-element auto-detection algorithm that generates clean CSS selectors (e.g. clicking 2 similar product cards automatically detects `.product-wrapper`).
- **Hierarchy Traversal**:
  - `Parent [P]`: Expand selection to parent container.
  - `Child [C]`: Narrow selection to key child element.
- **Element Preview**: Instantly outlines all elements matched by the selector in real-time.
- **Live Data Preview**: Opens an in-page floating data table displaying extracted values immediately.

### 2. Supported Selector Types (All 12 Types)
1. **Text Selector (`SelectorText`)**: Extracts plain text, strips HTML tags, replaces `<br>` with newlines, regex extraction filters, and multiple elements extraction.
2. **Link Selector (`SelectorLink`)**: Extracts `href` URLs and automatically follows links into child pages, passing parent data to sub-page extractors.
3. **Link (Popup) Selector (`SelectorPopupLink`)**: Extracts URLs from links opening in new windows/popups or JavaScript `window.open(...)` handlers.
4. **Image Selector (`SelectorImage`)**: Extracts image URLs from `src`, `data-src`, `data-original`, `srcset`, or CSS `background-image`.
5. **Table Selector (`SelectorTable`)**: Automatically parses table headers and data rows, supporting custom column renaming and column exclusion.
6. **Element (Container) Selector (`SelectorElement`)**: Groups repetitive item cards/wrappers (e.g. `.product-card`) so that child selectors extract fields relative to each item row.
7. **Element Attribute Selector (`SelectorElementAttribute`)**: Extracts any HTML attribute (e.g. `data-id`, `href`, `title`, `alt`, `aria-label`).
8. **HTML Selector (`SelectorHTML`)**: Extracts raw `innerHTML` or `outerHTML` with regex extraction support.
9. **Grouped Selector (`SelectorGrouped`)**: Collects multiple matching elements into a single comma-separated or delimited field.
10. **Pagination Selector (`SelectorPagination`)**: Navigates multi-page lists recursively (Next page links, page numbers, infinite scroll).
11. **Element Click Selector (`SelectorElementClick`)**: Interactively clicks buttons (e.g. "Load more", AJAX pagination, tabs, accordion) before or during scraping.
12. **Element Scroll Selector (`SelectorElementScroll`)**: Smoothly scrolls pages or container elements to bottom for infinite scroll data extraction.

### 3. URL Range Expansion
Supports advanced start URL patterns:
- **Numeric ranges**: `https://example.com/page/[1-100]`
- **Zero-padded ranges**: `https://example.com/item-[001-100].html`
- **Step increments**: `https://example.com/offset/[0-100:10]`
- **Alphabetic ranges**: `https://example.com/category/[a-z]` or `[A-Z]`
- **Value lists**: `https://example.com/[books,electronics,shoes]/list`
- **Multi-range Cartesian products**: `https://example.com/[a-b]/page/[1-5]`

### 4. Interactive Selector Hierarchy Graph
- Visual SVG tree diagram displaying parent-child selector relationships.
- Color-coded node pills by selector type.
- Pan, zoom, and interactive node click navigation.

### 5. Scraping Engine & Live Monitor
- Configurable **request interval delay** (ms), **page load delay** (ms), and **maximum pages limit**.
- Real-time **metrics**: Pages Visited, Records Scraped, Queue Size, and Elapsed Time.
- **Controls**: Pause, Resume, Stop.
- Real-time **activity log stream**.

### 6. Image Gallery & Slideshow
- Responsive image grid with adjustable column count, inline URL editing, and per-image delete.
- **Fullscreen slideshow** with fade / slide / zoom / cut transitions and configurable autoplay interval.
- **Mouse wheel** scrolls through images; arrow keys and <kbd>Space</kbd> also work, <kbd>Esc</kbd> closes.
- Controls auto-hide after 2 seconds of inactivity — **the mouse cursor hides with them** for an unobstructed view.
- **Download button saves the currently displayed image directly** (original filename and extension preserved), while the gallery toolbar keeps bulk **ZIP** export for all/selected images.

### 7. Fully Themed Dark UI
The interface uses a single dark palette driven by CSS custom properties, and opts into the browser's dark UA color scheme (`color-scheme: dark`) so that **browser-painted controls match the theme** instead of rendering white:
- `<select>` popup option lists, number-input spinner arrows, range sliders, checkboxes/radios, scrollbars, focus rings and Chrome autofill are all explicitly themed.
- The same theme is applied to the dashboard, the DevTools panel, the toolbar popup, and the in-page selector picker.

### 8. Data Viewer & Multiple Export Formats
- Interactive data table with column sorting (asc/desc), live keyword search, and pagination.
- **Export to CSV**: RFC 4180 compliant with UTF-8 BOM for Microsoft Excel compatibility, configurable delimiters (comma `,`, semicolon `;`, tab `\t`).
- **Export to Excel**: SpreadsheetML XML format (`.xls`) with styled headers and native column widths.
- **Export to JSON**: Formatted JSON records array.
- **Export / Import Sitemap**: Share and backup sitemaps via JSON definitions.

---

## 🚀 Installation

### In Chrome, Brave, Edge, Chromium:
1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode** toggle (top right).
3. Click **Load unpacked** (top left).
4. Select the **`chrome-edge/`** folder inside this repository (`Web-Scrape/chrome-edge`).
5. The extension is now installed! You can:
   - Click the **Web Scraper** extension icon in your browser toolbar.
   - Or press <kbd>F12</kbd> (Inspect) on any webpage and select the **Web Scraper** tab in DevTools!

### In Tor Browser (Firefox ESR):
A dedicated **Firefox-native** build lives in the [`tor/`](tor/) folder (auto-generated
from the [`chrome-edge/`](chrome-edge/) source tree by `npm run build:tor` — never edit it
by hand). It targets only
Firefox/Tor: promise-based `browser.*` APIs with async/await, an event-page background,
and no `chrome.*` calls at all.

1. Open `about:debugging#/runtime/this-firefox` in Tor Browser.
2. Click **Load Temporary Add-on…** and select `tor/manifest.json`.
3. After installing, open `about:addons` → Web Scraper → **Permissions** and enable
   *"Access your data for all websites"* (Firefox MV3 does not grant `<all_urls>` automatically).

See [`tor/README.md`](tor/README.md) for permanent installation (`.xpi`), the exact
differences from the Chrome build, and an important privacy/fingerprinting warning —
the Tor Project generally advises against adding extensions to Tor Browser.

---

## 💻 Standalone Dashboard / Preview

You can also run the Web Scraper dashboard in any browser without installing as an unpacked extension:
```bash
python3 -m http.server 8080 --bind 0.0.0.0
```
Open `http://localhost:8080/chrome-edge/dashboard/dashboard.html` in your browser.

---

## 📁 Architecture & File Structure

```
Web-Scrape/
├── chrome-edge/                   # Chrome / Edge / Brave / Chromium extension (load this folder)
│   ├── manifest.json              # Manifest V3 configuration
│   ├── background.js              # Background Service Worker & message broker
│   ├── index.html                 # Root entry redirect to dashboard
│   ├── lib/
│   │   ├── csv.js                 # RFC 4180 CSV parser & generator (zero-dependency)
│   │   ├── xlsx.js                # Excel XML generator (zero-dependency)
│   │   ├── zip.js                 # Zero-dependency ZIP (store method) writer
│   │   ├── i18n.js                # EN / TR UI translations
│   │   └── icons.js               # SVG UI icons
│   ├── icons/                     # Vector logo + 16/32/48/128 px PNGs
│   ├── content/
│   │   ├── selector_picker.js     # Visual point-and-click element selector
│   │   ├── selector_picker.css    # Highlighter overlay styles
│   │   └── scraper_content.js     # In-page scraping execution script
│   ├── devtools/
│   │   ├── devtools.html          # DevTools panel hook
│   │   ├── devtools.js            # Registers Web Scraper panel in DevTools
│   │   ├── panel.html             # DevTools panel view (auto-generated)
│   │   └── panel.css              # DevTools panel styles
│   ├── dashboard/
│   │   ├── dashboard.html         # Standalone & full dashboard view
│   │   ├── dashboard.js           # Application controller & event binder
│   │   └── dashboard.css          # Modern dark-mode UI stylesheet
│   ├── popup/
│   │   ├── popup.html             # Extension toolbar popup
│   │   ├── popup.js               # Popup controller
│   │   └── popup.css              # Popup styles
│   ├── _locales/                  # Store-listing strings (en / tr)
│   └── src/
│       ├── models/
│       │   ├── Selector.js        # Selector schema and all 12+ type definitions
│       │   └── Sitemap.js         # Sitemap model, hierarchy queries, and validation
│       ├── engine/
│       │   ├── UrlRangeExpander.js        # Numeric, alpha, and cartesian range expander
│       │   ├── CssSelectorGenerator.js    # Smart CSS selector generator & multi-select generalizer
│       │   ├── SelectorEngine.js          # DOM data extraction engine
│       │   ├── DataFlattener.js           # Converts hierarchical tree to tabular rows
│       │   └── ScraperEngine.js           # Queue, crawler scheduler, and concurrency runner
│       ├── storage/
│       │   └── Storage.js         # chrome/browser.storage + IndexedDB + localStorage
│       ├── export/
│       │   └── Exporter.js        # CSV, Excel, JSON and ZIP exporter
│       └── ui/
│           └── SelectorGraph.js   # Interactive SVG selector hierarchy graph
├── tor/                           # Tor Browser / Firefox ESR native build (auto-generated)
├── tools/
│   ├── build_panel.js             # Generates devtools/panel.html from the dashboard
│   ├── build_tor.js               # Generates the tor/ Firefox-native build
│   ├── tor_native/                # Hand-written Firefox-native replacement sources
│   └── theme_preview.html         # Manual visual check for themed native controls
└── test/                          # Node.js test-runner suite (npm test)
```

---

## 🧪 Automated Testing

Install the dev dependency (jsdom) once, then run the suite with the Node.js test runner:
```bash
npm install
npm test
```
All automated unit, integration, UI and E2E tests will run and report results (`npm run check:tor` / `npm run check:panel` verify the generated builds are up to date).

The DevTools panel is generated from the dashboard so the two can never drift apart:
```bash
npm run build:panel   # regenerate devtools/panel.html
npm run check:panel   # CI check: fails if it is out of date
```

> `devtools/panel.html` is auto-generated — edit `chrome-edge/dashboard/dashboard.html` and re-run `npm run build:panel`. Similarly, `tor/` is auto-generated from `chrome-edge/` by `npm run build:tor`.

---

## 📄 License
MIT License
