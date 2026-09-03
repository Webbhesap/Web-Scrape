# Web Scraper Extension - Development Plan

**Repository:** https://github.com/Webbhesap/Web-Scrape  
**Branch:** `arena/01a065a0-web-scrape`  
**Last Updated:** 2026-09-03

---

## 📋 Overview

This plan documents all developable features, enhancements, and architectural improvements for the **Web Scraper** Chrome extension. The extension is built with pure HTML, CSS, and Vanilla JavaScript (Manifest V3), with a modular architecture spanning ~30 source files, 73 automated tests, and a dark-themed UI.

The goal is to provide a clear, prioritized roadmap that the maintainer can review and use to guide incremental development, beginning with the highest-impact items.

---

## ✨ Existing Feature Summary (Reference)

The extension already ships with **50+ features** across 8 domains:

1. **Visual Element Picker** – point-and-click selector with hierarchy traversal, live preview, and CSS generalization.
2. **12 Selector Types** – Text, Link, Image, Table, Element, Attribute, HTML, Grouped, Pagination, Click, Scroll, and more.
3. **URL Range Expansion** – Numeric, zero-padded, step, alphabetic, value lists, and Cartesian products.
4. **Interactive Selector Hierarchy Graph** – SVG tree diagram with color-coded nodes, pan/zoom, and click navigation.
5. **Scraping Engine & Live Monitor** – Configurable delays, page limits, real-time metrics (visited, records, queue, elapsed), pause/resume/stop, activity log.
6. **Image Gallery & Slideshow** – Responsive grid, fullscreen slideshow with fade/slide/zoom/cut transitions, autoplay, mouse-wheel nav, export (ZIP/download).
7. **Fully Themed Dark UI** – CSS custom properties, `color-scheme: dark`, themed native controls (`<select>`, sliders, scrollbars, etc.).
8. **Data Viewer & Export** – Interactive table with sorting/search, export to CSV (RFC 4180, configurable delimiters), Excel (SpreadsheetML XML), JSON, and import/export sitemaps.

**Test Suite:** 73 unit, integration, UI, and E2E tests covering URL expansion, selector generation, data flattening, storage concurrency, UI theming, DevTools panel, dashboard regressions, and multi-page E2E crawling.

**Architecture:** Modular `src/` directory with models (`Selector.js`, `Sitemap.js`), engine modules (`UrlRangeExpander.js`, `CssSelectorGenerator.js`, `SelectorEngine.js`, `DataFlattener.js`, `ScraperEngine.js`), storage (`Storage.js`), and exporters (`Exporter.js`).

---

## 🚀 Prioritized Developable Features & Enhancements

### Phase 1: Core Enhancements (High Impact, Low Risk)

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F1** | **Smart CSS Selector Auto-Generalization** | Improve the multi-element detection algorithm to produce more robust, nested selectors when users click similar elements (e.g., product cards in a list). Currently good, but can be tuned for edge cases (dynamic classes, shadow DOM). | Medium |
| **F2** | **XPath Selector Support** | Add a new selector type or extension for XPath expressions, enabling users to write custom XPath queries for complex extractions. Could be a toggle in the existing `SelectorElementAttribute` UI. | High |
| **F3** | **Session Persistence & Cloud Sync** | Persist sitemap state (visited URLs, extracted data, queue state) across browser restores via IndexedDB upgrades, and provide optional encrypted cloud sync (e.g., via a simple API backend). | High |
| **F4** | **Selector Templates Library** | Pre-built selector templates for common sites (Amazon, eBay, Indeed, etc.) that users can import with one click, reducing setup time for new scrapes. | Medium |
| **F5** | **Infinite Scroll & Load More Automation** | Enhanced detection and automation for "Load More" buttons and infinite scroll, with configurable max requests, delay, and visual feedback on what's being loaded. | Medium |

### Phase 2: UI/UX & Accessibility Upgrades

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F6** | **Responsive Popup & Dashboard** | Make the popup and dashboard layouts fully responsive for narrow windows (e.g., vertical sidebar, embedded DevTools). Currently fixed-width in places. | Low |
| **F7** | **Keyboard Navigation & Accessibility Overhaul** | Full keyboard navigation flow (Tab/Shift-Tab), ARIA labels, focus management, screen-reader compatibility for the selector picker, gallery, and data table. | Medium |
| **F8** | **Theme Switcher (Light/Day/High-contrast)** | Add a manual theme switcher alongside the automatic `color-scheme: dark`, with customizable color variables and save-to-storage persistence. | Medium |
| **F9** | **Drag-and-Drop Selector Import** | Allow users to drag a JSON sitemap file from their OS file explorer into the dashboard or popup to import it, rather than using the "Import" button dialog. | Low |

### Phase 3: Export & Data Utility

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F10** | **XML & Google Sheets Export** | Add XML export format compatible with Google Sheets `IMPORTXML`, plus a "Copy as cURL" feature for the current extraction config. | Medium |
| **F11** | **Bulk Data Transformation** | Post-scrape transformations: trim whitespace, normalize URLs, regex replace, lowercase/uppercase, and custom JavaScript snippets per column before export. | High |
| **F12** | **Auto-Detect & Extract Dynamic Data** | AI-assisted or rule-based detection of dynamically loaded data (e.g., prices updating via AJAX, review counts, stock status) with suggested selector generation. | High |

### Phase 4: Engine & Performance

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F13** | **Concurrent Page Scraping with Isolation** | Allow multiple pages to scrape concurrently with per-tab isolation (storage, CSS, JS) to speed up large sitemaps, with a concurrency cap and global throttle. | High |
| **F14** | **Memory Leak Fixes & Cleanup** | Systematic review of event listeners, timeouts, and Interval references in the scraper engine to prevent leaks during long-running crawls (>100 pages). | Medium |
| **F15** | **Selective Logger & Log Export** | Allow users to export the activity log as JSON/CSV, filter by severity (info/warn/error), and timestamp range, for debugging without console access. | Low |

### Phase 5: Testing & Quality Assurance

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F16** | **Cross-Browser Compatibility Tests** | Expand the test suite to cover Firefox and Edge behaviors (Manifest V3 differences, storage API, icon handling). | Medium |
| **F17** **| **Puppeteer/Playwright E2E Suite** | Replace/add browser automation tests using Puppeteer or Playwright for headless multi-page crawling, selector validation, and export verification. | High |
| **F18** | **Property-Based Testing for Selector Generation** | Use `hypothesis` or similar to generate random DOM structures and validate that CSS selector generation remains deterministic and correct. | High |

### Phase 6: Documentation & Onboarding

| ID | Feature | Description | Effort |
|----|---------|-------------|--------|
| **F19** | **Interactive Quick-Start Tutorial** | A step-by-step in-app guided tour (via a lightweight library like Shepherd.js) for first-time users, covering: installing, creating a sitemap, running a scrape, and exporting data. | Low |
| **F20** | **Video Demo Library** | Short (30–60s) screen-recorded demos for the most used features: visual picker, range expansion, gallery slideshow, and CSV export. | Low |
| **F21** | **Developer Contribution Guide** | Docs on how to add a new selector type, run the test suite, build the DevTools panel, and submit PRs, including linting/formatting standards. | Low |

---

## 📦 Suggested Next Development Step

**Start with F1 (Smart CSS Selector Auto-Generalization) and F6 (Responsive Popup/Dashboard).** 

These two provide immediate quality-of-life improvements with bounded scope, can be implemented using the existing `src/models/Selector.js` and `dashboard/dashboard.html`/`popup/popup.html` structures, and lay groundwork for larger enhancements.

**Immediate action items:**
1. Fork/clone the repo and ensure the test suite passes: `npm install && npm test`
2. Review the existing selector generalization logic in `src/engine/CssSelectorGenerator.js`
3. Create a branch `feature/F1-smart-generalization` and implement improvements
4. Update `PLAN.md` progress as items are completed, committing frequently to `arena/01a065a0-web-scrape`

---

## 🛠️ Development Workflow (Already in Use)

- **Branch:** `arena/01a065a0-web-scrape` (this session)
- **Commit format:** `git commit -m "F1: improve CSS selector generalization for dynamic class names"`
- **Push:** `git push origin arena/01a065a0-web-scrape`
- **Tests:** `npm test` (73 tests, must pass before push)
- **Panel build:** `npm run build:panel` (regenerates `devtools/panel.html` from `dashboard/dashboard.html`)
- **Lint/formatting:** enforced by repo config (check `package.json` scripts)

---

## 📬 Feedback & Planning

This plan is a living document. Each feature can be:
- **Deferred** – postponed to a later phase or version
- **Split** – divided into smaller, independent PRs
- **Merged** – implemented as-is if low-risk/high-value
- **Replaced** – substituted with a better idea from the community or maintainer

Feel free to review, reorder, or expand any item. The next step is to pick a Phase 1 item, create a feature branch, and implement the first incremental change.

---

*Generated for the Web Scraper extension development planning session.* 