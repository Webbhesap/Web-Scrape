/**
 * DevTools panel tests.
 *
 * The panel embeds the same application as the standalone dashboard. It used
 * to be a hand-maintained copy of dashboard.html that had drifted: its
 * slideshow overlay carried stale markup and, crucially, no `hidden`
 * attribute — so simply opening the extension in DevTools rendered the
 * fullscreen slideshow over the whole panel.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const { buildPanelHtml } = require('../tools/build_panel.js');

const dashboardHtml = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
const panelHtml = fs.readFileSync(path.join(ROOT, 'devtools', 'panel.html'), 'utf8');

test('DevTools panel - slideshow overlay is hidden on load', () => {
  const dom = new JSDOM(panelHtml);
  const overlay = dom.window.document.getElementById('slideshow-overlay');

  assert.ok(overlay, 'panel contains the slideshow overlay');
  assert.ok(overlay.hasAttribute('hidden'), 'overlay must carry the hidden attribute in the markup');
  assert.ok(!overlay.classList.contains('open'), 'overlay must not be marked open');

  dom.window.close();
});

test('DevTools panel - opening the panel does not auto-start the slideshow', async () => {
  const dom = new JSDOM(panelHtml, {
    runScripts: 'dangerously',
    url: 'chrome-extension://abc/devtools/panel.html',
    pretendToBeVisual: true
  });
  const window = dom.window;

  // Emulate the DevTools environment: chrome.devtools is what distinguishes
  // the panel from a normal dashboard tab.
  window.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    devtools: { inspectedWindow: { tabId: 42 } },
    storage: {
      local: {
        get: (keys, cb) => (typeof keys === 'function' ? keys({}) : cb({})),
        set: (o, cb) => cb && cb(),
        remove: (k, cb) => cb && cb()
      }
    }
  };

  const scripts = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/zip.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  await new Promise((r) => setTimeout(r, 80));

  const overlay = window.document.getElementById('slideshow-overlay');
  assert.ok(overlay.hasAttribute('hidden'), 'slideshow stays hidden after the app boots in DevTools');
  assert.ok(!overlay.classList.contains('open'), 'slideshow is not opened by initialization');

  // The sitemaps view should be the visible one instead.
  assert.ok(
    window.document.getElementById('view-sitemaps').classList.contains('active'),
    'the panel lands on the sitemaps view'
  );

  dom.window.close();
});

test('DevTools panel - markup is generated from the dashboard and in sync', () => {
  assert.equal(
    panelHtml,
    buildPanelHtml(dashboardHtml),
    'devtools/panel.html must match the generator output (run: npm run build:panel)'
  );
});

test('DevTools panel - asset paths are rewritten correctly', () => {
  assert.match(panelHtml, /href="\.\.\/dashboard\/dashboard\.css"/, 'stylesheet points at the dashboard folder');
  assert.match(panelHtml, /href="panel\.css"/, 'panel-specific stylesheet is included');
  assert.match(panelHtml, /src="\.\.\/dashboard\/dashboard\.js"/, 'controller points at the dashboard folder');

  // Shared libraries live one level up from both folders, so these are unchanged.
  assert.match(panelHtml, /src="\.\.\/lib\/i18n\.js"/, 'i18n script is loaded');
  assert.match(panelHtml, /src="\.\.\/lib\/zip\.js"/, 'zip script is loaded');
  assert.match(panelHtml, /src="\.\.\/src\/storage\/Storage\.js"/, 'storage script is loaded');

  // No same-directory dashboard references should survive the rewrite.
  assert.ok(!/href="dashboard\.css"/.test(panelHtml), 'no unrewritten dashboard.css reference');
  assert.ok(!/src="dashboard\.js"/.test(panelHtml), 'no unrewritten dashboard.js reference');
});

test('DevTools panel - has the same views, controls and i18n as the dashboard', () => {
  const ids = (html) => (html.match(/id="([^"]+)"/g) || []).sort();
  assert.deepEqual(ids(panelHtml), ids(dashboardHtml), 'panel and dashboard expose identical element ids');

  // Features previously missing from the hand-written panel.
  assert.match(panelHtml, /id="btn-lang-toggle"/, 'language toggle is present');
  assert.match(panelHtml, /id="btn-slide-download"/, 'single image download button is present');
  assert.match(panelHtml, /id="btn-gallery-zip-all"/, 'gallery ZIP actions are present');
  assert.ok(
    (panelHtml.match(/data-i18n=/g) || []).length > 50,
    'panel markup is fully translatable like the dashboard'
  );

  // Stale slideshow markup that no stylesheet supported must be gone.
  for (const stale of ['slideshow-topbar', 'slideshow-bottombar', 'slideshow-thumbs', 'slideshow-progress', 'slideshow-nav']) {
    assert.ok(!panelHtml.includes(stale), `stale "${stale}" markup removed from the panel`);
  }
});

test('DevTools panel - registers itself with a valid panel page', () => {
  const devtoolsJs = fs.readFileSync(path.join(ROOT, 'devtools', 'devtools.js'), 'utf8');
  assert.match(devtoolsJs, /chrome\.devtools\.panels\.create/, 'panel is registered');

  // Regression: paths MUST be extension-root absolute (leading "/").
  // Chrome resolves relative paths against the extension root but Firefox
  // resolves them against the devtools/ directory, producing the broken
  // "devtools/devtools/panel.html" URL in Firefox/Tor Browser.
  const referenced = devtoolsJs.match(/'(\/devtools\/panel\.html)'/);
  assert.ok(referenced, 'panel page path is passed to create() as an absolute path');
  assert.ok(fs.existsSync(path.join(ROOT, referenced[1].slice(1))), 'the referenced panel page exists');

  const iconRef = devtoolsJs.match(/'(\/icons\/[^']+)'/);
  assert.ok(iconRef, 'panel icon path is absolute');
  assert.ok(fs.existsSync(path.join(ROOT, iconRef[1].slice(1))), 'the panel icon exists');

  assert.ok(!/'(?:devtools|icons)\//.test(devtoolsJs), 'no root-relative panel paths remain (Firefox-incompatible)');
});

test('DevTools panel - manifest wires up the devtools page', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.devtools_page, 'devtools/devtools.html');
  assert.ok(fs.existsSync(path.join(ROOT, manifest.devtools_page)), 'devtools page file exists');

  // Every file the extension declares must actually be present.
  assert.ok(fs.existsSync(path.join(ROOT, manifest.background.service_worker)), 'service worker exists');
  assert.ok(fs.existsSync(path.join(ROOT, manifest.options_page)), 'options page exists');
  assert.ok(fs.existsSync(path.join(ROOT, manifest.action.default_popup)), 'popup page exists');
  for (const cs of manifest.content_scripts) {
    [...(cs.js || []), ...(cs.css || [])].forEach((f) => {
      assert.ok(fs.existsSync(path.join(ROOT, f)), `content script asset exists: ${f}`);
    });
  }
  Object.values(manifest.icons).forEach((icon) => {
    assert.ok(fs.existsSync(path.join(ROOT, icon)), `icon exists: ${icon}`);
  });
});
