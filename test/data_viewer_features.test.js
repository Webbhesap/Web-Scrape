/**
 * Tests for Data Viewer improvements (Plan.md Feature 1):
 * - Page size selector (25/50/100/250)
 * - Per-row delete button that persists removal
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

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
          if (typeof keys === 'function') return keys({ ...db });
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

function makeStore(recordCount) {
  const records = [];
  for (let i = 1; i <= recordCount; i++) {
    records.push({
      'web-scraper-order': `1-${i}`,
      'web-scraper-start-url': 'https://x.test/',
      title: `Item ${i}`
    });
  }
  return {
    sitemap_shop: { _id: 'shop', name: 'Shop', startUrl: ['https://x.test/'], selectors: [] },
    data_shop: { sitemapId: 'shop', count: records.length, records }
  };
}

test('Data viewer - page size selector changes rows per page', async () => {
  const { window } = boot(makeStore(60));
  await wait(50);

  const doc = window.document;
  const sizeSel = doc.getElementById('data-page-size');
  assert.ok(sizeSel, 'page size selector must exist');
  assert.deepEqual(Array.from(sizeSel.options).map(o => o.value), ['25', '50', '100', '250']);

  // Open the sitemap's data view
  window.eval(`
    (async () => {
      const link = document.querySelectorAll('#tbody-sitemaps .action-browse')[0];
      link.click();
    })();
  `);
  await wait(80);

  let rows = doc.querySelectorAll('#tbody-scraped-data tr');
  assert.equal(rows.length, 25, 'default page size is 25');

  sizeSel.value = '50';
  sizeSel.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait(30);

  rows = doc.querySelectorAll('#tbody-scraped-data tr');
  assert.equal(rows.length, 50, 'page size 50 shows 50 rows');
});

test('Data viewer - deleting a row removes it from data and storage', async () => {
  const { window, db } = boot(makeStore(5));
  await wait(50);
  const doc = window.document;

  window.eval(`document.querySelectorAll('#tbody-sitemaps .action-browse')[0].click();`);
  await wait(80);

  let rows = doc.querySelectorAll('#tbody-scraped-data tr');
  assert.equal(rows.length, 5);

  const firstDelete = rows[0].querySelector('.row-delete-btn');
  assert.ok(firstDelete, 'each row must have a delete button');
  firstDelete.click();
  await wait(80);

  rows = doc.querySelectorAll('#tbody-scraped-data tr');
  assert.equal(rows.length, 4, 'row is removed from the table');
  assert.equal(db.data_shop.records.length, 4, 'row removal is persisted to storage');
  assert.ok(!db.data_shop.records.some(r => r.title === 'Item 1'), 'the clicked row is the one deleted');
});
