const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const AppIcons = require('../lib/icons.js');

test('AppIcons - All SVG icons are valid XML and well-formed path commands', () => {
  for (const [name, svgStr] of Object.entries(AppIcons.icons)) {
    const dom = new JSDOM(svgStr, { contentType: 'image/svg+xml' });
    const errors = dom.window.document.querySelectorAll('parsererror');
    assert.equal(errors.length, 0, `Icon "${name}" has XML parse error`);

    const paths = dom.window.document.querySelectorAll('path');
    paths.forEach(p => {
      const d = p.getAttribute('d');
      assert.ok(d && /^[a-zA-Z]/.test(d.trim()), `Icon "${name}" path d must start with a valid command (e.g. M, m, l, etc.): got "${d}"`);
    });
  }
});

test('UI Integration - Dashboard HTML loads, parses scripts and initializes cleanly', async () => {
  const htmlPath = path.join(__dirname, '../dashboard/dashboard.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Load in JSDOM without fetching remote CSS/scripts (scripts are injected from disk below)
  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html'
  });

  const window = dom.window;

  // Mock chrome APIs
  window.chrome = {
    runtime: {
      getURL: (p) => p,
      sendMessage: () => {},
      onMessage: { addListener: () => {} }
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {}
      }
    }
  };

  const scriptFiles = [
    '../lib/csv.js',
    '../lib/xlsx.js',
    '../lib/icons.js',
    '../src/engine/UrlRangeExpander.js',
    '../src/models/Selector.js',
    '../src/models/Sitemap.js',
    '../src/engine/CssSelectorGenerator.js',
    '../src/engine/SelectorEngine.js',
    '../src/engine/DataFlattener.js',
    '../src/engine/ScraperEngine.js',
    '../src/storage/Storage.js',
    '../src/export/Exporter.js',
    '../src/ui/SelectorGraph.js',
    '../dashboard/dashboard.js'
  ];

  for (const sFile of scriptFiles) {
    const sPath = path.resolve(__dirname, '../dashboard', sFile);
    const scriptCode = fs.readFileSync(sPath, 'utf8');
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = scriptCode;
    window.document.body.appendChild(scriptEl);
  }

  // Check DOM structure
  const document = window.document;
  assert.ok(document.getElementById('view-sitemaps'), 'view-sitemaps should exist');
  assert.ok(document.getElementById('view-selectors'), 'view-selectors should exist');
  assert.ok(document.getElementById('view-selector-edit'), 'view-selector-edit should exist');
  assert.ok(document.getElementById('view-scrape'), 'view-scrape should exist');
  assert.ok(document.getElementById('view-browse-data'), 'view-browse-data should exist');
  assert.ok(document.getElementById('view-selector-graph'), 'view-selector-graph should exist');

  // Check selector types dropdown
  const selectorTypeSelect = document.getElementById('field-selector-type');
  assert.equal(selectorTypeSelect.options.length, 13, 'Should have all 13 Web Scraper selector types (12 CSS based + XPath)');

  assert.equal(typeof window.Selector, 'function', 'Selector must be a constructor in the browser global');
  assert.ok(window.Selector.SELECTOR_TYPES && window.Selector.SELECTOR_TYPES.SelectorText);
  const sel = new window.Selector({ id: 'title', type: 'SelectorText', selector: 'h1', parentSelectors: ['_root'] });
  assert.equal(sel.id, 'title');
  assert.equal(typeof window.Sitemap, 'function', 'Sitemap must be a constructor');
  const sm = new window.Sitemap({ _id: 'demo', startUrl: ['example.com'] });
  assert.equal(sm.startUrl[0], 'https://example.com');
  sm.addSelector(sel);
  assert.equal(sm.getRootSelectors().length, 1);
});
