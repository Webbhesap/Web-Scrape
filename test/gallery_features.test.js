/**
 * Tests for gallery improvements (Plan.md Feature 5):
 * - Lazy loading on gallery images
 * - Select all / clear selection controls with counter badge
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
          if (keys == null) return cb({ ...db });
          if (typeof keys === 'string') return cb(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => {
            if (db[k] !== undefined) out[k] = db[k];
          });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) cb(); },
        remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]); if (cb) cb(); }
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
  return { window, db };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeImageStore() {
  const records = [
    { 'web-scraper-order': '1-1', 'web-scraper-start-url': 'https://g.test/', image: 'https://g.test/a.jpg' },
    { 'web-scraper-order': '1-2', 'web-scraper-start-url': 'https://g.test/', image: 'https://g.test/b.png' },
    { 'web-scraper-order': '1-3', 'web-scraper-start-url': 'https://g.test/', image: 'https://g.test/c.webp' }
  ];
  return {
    sitemap_gal: { _id: 'gal', name: 'Gallery', startUrl: ['https://g.test/'], selectors: [] },
    data_gal: { sitemapId: 'gal', count: records.length, records }
  };
}

async function openGallery(window) {
  window.eval(`
    (async () => {
      document.querySelectorAll('#tbody-sitemaps .action-open')[0].click();
      await new Promise(r => setTimeout(r, 30));
      document.getElementById('nav-sitemap-gallery').click();
    })();
  `);
  await wait(150);
}

test('Gallery - images use lazy loading', async () => {
  const { window } = boot(makeImageStore());
  await wait(50);
  await openGallery(window);

  const imgs = window.document.querySelectorAll('#gallery-grid .gallery-card img');
  assert.equal(imgs.length, 3, 'all three image URLs are rendered');
  imgs.forEach((img) => {
    assert.equal(img.getAttribute('loading'), 'lazy', 'each image must be lazy loaded');
  });
});

test('Gallery - select all / clear selection controls with badge', async () => {
  const { window } = boot(makeImageStore());
  await wait(50);
  await openGallery(window);
  const doc = window.document;

  const badge = doc.getElementById('gallery-selected-badge');
  assert.ok(badge, 'selection badge exists');
  assert.equal(badge.style.display, 'none', 'badge hidden with no selection');

  doc.getElementById('btn-gallery-select-all').click();
  await wait(30);
  const checks = doc.querySelectorAll('#gallery-grid .gallery-select');
  checks.forEach((c) => assert.equal(c.checked, true, 'select all checks every checkbox'));
  assert.notEqual(badge.style.display, 'none', 'badge visible after select all');
  assert.ok(badge.textContent.includes('3'), 'badge shows count of 3');

  doc.getElementById('btn-gallery-select-none').click();
  await wait(30);
  checks.forEach((c) => assert.equal(c.checked, false, 'clear selection unchecks all'));
  assert.equal(badge.style.display, 'none', 'badge hidden again');
});
