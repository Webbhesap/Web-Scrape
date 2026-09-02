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
4. Select this repository folder (`Web-Scrape`).
5. The extension is now installed! You can:
   - Click the **Web Scraper** extension icon in your browser toolbar.
   - Or press <kbd>F12</kbd> (Inspect) on any webpage and select the **Web Scraper** tab in DevTools!

---

## 💻 Standalone Dashboard / Preview

You can also run the Web Scraper dashboard in any browser without installing as an unpacked extension:
```bash
python3 -m http.server 8080 --bind 0.0.0.0
```
Open `http://localhost:8080/dashboard/dashboard.html` in your browser.

---

## 📁 Architecture & File Structure

```
Web-Scrape/
├── manifest.json                  # Manifest V3 configuration
├── background.js                  # Background Service Worker & message broker
├── index.html                     # Root entry redirect to dashboard
├── lib/
│   ├── csv.js                     # RFC 4180 CSV parser & generator (zero-dependency)
│   ├── xlsx.js                    # Excel XML generator (zero-dependency)
│   └── icons.js                   # SVG UI icons
├── icons/
│   ├── icon.svg                   # Vector logo
│   ├── icon16.png                 # 16x16 icon
│   ├── icon32.png                 # 32x32 icon
│   ├── icon48.png                 # 48x48 icon
│   └── icon128.png                # 128x128 icon
├── content/
│   ├── selector_picker.js         # Visual point-and-click element selector
│   ├── selector_picker.css        # Highlighter overlay styles
│   └── scraper_content.js         # In-page scraping execution script
├── devtools/
│   ├── devtools.html              # DevTools panel hook
│   ├── devtools.js                # Registers Web Scraper panel in Chrome DevTools
│   ├── panel.html                 # DevTools panel view
│   └── panel.css                  # DevTools panel styles
├── dashboard/
│   ├── dashboard.html             # Standalone & full dashboard view
│   ├── dashboard.js               # Application controller & event binder
│   └── dashboard.css              # Modern dark-mode UI stylesheet
├── popup/
│   ├── popup.html                 # Extension toolbar popup
│   ├── popup.js                   # Popup controller
│   └── popup.css                  # Popup styles
├── src/
│   ├── models/
│   │   ├── Selector.js            # Selector schema and all 12 type definitions
│   │   └── Sitemap.js             # Sitemap model, hierarchy queries, and validation
│   ├── engine/
│   │   ├── UrlRangeExpander.js    # Numeric, alpha, and cartesian range expander
│   │   ├── CssSelectorGenerator.js # Smart CSS selector generator & multi-select generalizer
│   │   ├── SelectorEngine.js      # DOM data extraction engine
│   │   ├── DataFlattener.js       # Converts hierarchical tree to tabular rectangular rows
│   │   └── ScraperEngine.js       # Queue, crawler scheduler, and concurrency runner
│   ├── storage/
│   │   └── Storage.js             # IndexedDB with chrome.storage fallback
│   └── export/
│       └── Exporter.js            # CSV, Excel, and JSON exporter
├── tools/
│   ├── build_panel.js             # Generates devtools/panel.html from the dashboard
│   └── theme_preview.html         # Manual visual check for themed native controls
└── test/
    ├── url_expander.test.js       # Range expander unit tests
    ├── css_generator.test.js      # Smart CSS generator tests
    ├── selector_engine.test.js    # Selector DOM extraction tests
    ├── selectors_extended.test.js # Extended selector tests
    ├── data_flattener.test.js     # Data flattening & record normalization tests
    ├── sitemap_models.test.js     # Sitemap & Selector models tests
    ├── csv_xlsx_export.test.js    # CSV & Excel export tests
    ├── storage_concurrency.test.js# Storage integration & concurrency tests
    ├── ui_integration.test.js     # Full UI DOM & scripts integration test
    ├── slideshow_ui.test.js       # Slideshow controls, wheel nav & download tests
    ├── theme_consistency.test.js  # Dark-theme / native control styling tests
    ├── devtools_panel.test.js     # DevTools panel parity & auto-open regression tests
    ├── dashboard_regressions.test.js # Controller & i18n regression tests
    └── scraper_e2e.test.js        # Multi-page crawl & extraction E2E test
```

---

## 🧪 Automated Testing

Install the dev dependency (jsdom) once, then run the suite with the Node.js test runner:
```bash
npm install
npm test
```
All **73** automated unit, integration, UI and E2E tests will run and report results.

The DevTools panel is generated from the dashboard so the two can never drift apart:
```bash
npm run build:panel   # regenerate devtools/panel.html
npm run check:panel   # CI check: fails if it is out of date
```

> `devtools/panel.html` is auto-generated — edit `dashboard/dashboard.html` and re-run `npm run build:panel`.

---

## 📄 License
MIT License
