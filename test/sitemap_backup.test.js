/**
 * Tests for sitemap backup (Plan.md Feature 3):
 * - Exporter.buildSitemapsBackup structure
 * - Importing a backup file restores every sitemap
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const Exporter = require('../chrome-edge/src/export/Exporter.js');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const dashboardHtml = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');

const SCRIPTS = [
  'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
  'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
  'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
  'lib/i18n.js', 'lib/zip.js', 'dashboard/dashboard.js'
];

function boot(store) {
  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const window = dom.window;
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
  const db = store || {};
  window.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: {
      local: {
        get: (keys, cb) => {
          if (keys == null) return cb({ ...db });
          if (typeof keys === 'string') return cb(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => {
            if (db[k] !== undefined) out[k] = db[k];
          });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) cb(); },
        remove: (keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]);
          if (cb) cb();
        }
      }
    }
  };
  window.alert = () => {};
  window.confirm = () => true;
  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  return { dom, window, db };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Exporter.buildSitemapsBackup - stable format envelope', () => {
  const backup = Exporter.buildSitemapsBackup([{ _id: 'a' }, { _id: 'b' }]);
  assert.equal(backup.format, 'web-scraper-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.sitemaps.length, 2);
  assert.ok(backup.exportedAt);
  // Defensive: non-array input
  assert.deepEqual(Exporter.buildSitemapsBackup(null).sitemaps, []);
});

test('Import - backup file restores every contained sitemap', async () => {
  const { window, db } = boot({
    sitemap_existing: { _id: 'existing', name: 'Existing', startUrl: ['https://e.test/'], selectors: [] }
  });
  await wait(50);
  const doc = window.document;

  const backup = {
    format: 'web-scraper-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    sitemaps: [
      { _id: 'shop_a', name: 'Shop A', startUrl: ['https://a.test/'], selectors: [] },
      { _id: 'shop_b', name: 'Shop B', startUrl: ['https://b.test/'], selectors: [
        { id: 'title', type: 'SelectorText', selector: 'h1', parentSelectors: ['_root'] }
      ] }
    ]
  };

  doc.getElementById('field-import-json').value = JSON.stringify(backup);
  doc.getElementById('btn-submit-sitemap-import').click();
  await wait(120);

  assert.ok(db.sitemap_shop_a, 'first sitemap imported');
  assert.ok(db.sitemap_shop_b, 'second sitemap imported');
  assert.equal(db.sitemap_shop_b.selectors.length, 1, 'selectors preserved');
  assert.ok(db.sitemap_existing, 'existing sitemaps untouched');
});

test('Import - plain array of sitemaps is also accepted', async () => {
  const { window, db } = boot({});
  await wait(50);
  const doc = window.document;

  const arr = [
    { _id: 'x1', name: 'X1', startUrl: ['https://x1.test/'], selectors: [] },
    { _id: 'x2', name: 'X2', startUrl: ['https://x2.test/'], selectors: [] }
  ];
  doc.getElementById('field-import-json').value = JSON.stringify(arr);
  doc.getElementById('btn-submit-sitemap-import').click();
  await wait(120);

  assert.ok(db.sitemap_x1);
  assert.ok(db.sitemap_x2);
});

test('Dashboard HTML - Export All button exists', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  assert.ok(html.includes('id="btn-sitemaps-export-all"'));
});
