#!/usr/bin/env node
/**
 * Generates devtools/panel.html from dashboard/dashboard.html.
 *
 * The DevTools panel renders the exact same application as the standalone
 * dashboard; it previously was a hand-maintained copy that drifted out of
 * sync (stale slideshow markup, missing i18n attributes, missing scripts).
 * Both `dashboard/` and `devtools/` live one level below the repository
 * root, so every `../lib/...` / `../src/...` reference resolves identically
 * and only the same-directory asset paths need rewriting.
 *
 * Usage:  node tools/build_panel.js          (writes the file)
 *         node tools/build_panel.js --check  (verifies it is up to date)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'dashboard', 'dashboard.html');
const TARGET = path.join(ROOT, 'devtools', 'panel.html');

const BANNER = '<!-- AUTO-GENERATED from dashboard/dashboard.html by tools/build_panel.js. Do not edit directly. -->';

function buildPanelHtml(dashboardHtml) {
  let html = dashboardHtml;

  html = html.replace(
    '<title>Web Scraper - Free Web Scraping Tool</title>',
    '<title>Web Scraper - DevTools Panel</title>'
  );

  // Same-directory assets have to be re-pointed at the dashboard folder,
  // and the panel adds its own small stylesheet on top.
  html = html.replace(
    '<link rel="stylesheet" href="dashboard.css">',
    '<link rel="stylesheet" href="../dashboard/dashboard.css">\n  <link rel="stylesheet" href="panel.css">'
  );
  html = html.replace(
    '<script src="dashboard.js"></script>',
    '<script src="../dashboard/dashboard.js"></script>'
  );

  html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + BANNER);

  return html;
}

function main() {
  const dashboardHtml = fs.readFileSync(SOURCE, 'utf8');
  const panelHtml = buildPanelHtml(dashboardHtml);
  const check = process.argv.includes('--check');

  if (check) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
    if (current !== panelHtml) {
      console.error('devtools/panel.html is out of date. Run: npm run build:panel');
      process.exit(1);
    }
    console.log('devtools/panel.html is up to date.');
    return;
  }

  fs.writeFileSync(TARGET, panelHtml);
  console.log('Wrote ' + path.relative(ROOT, TARGET));
}

if (require.main === module) main();

module.exports = { buildPanelHtml, SOURCE, TARGET, BANNER };
