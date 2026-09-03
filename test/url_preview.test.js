/**
 * Tests for the URL range live preview (Plan.md Feature 4).
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

function boot() {
  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const window = dom.window;
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
  const db = {};
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
  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  return { window };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('URL preview - shows count and sample URLs for range patterns', async () => {
  const { window } = boot();
  await wait(50);
  const doc = window.document;

  const textarea = doc.getElementById('field-sitemap-urls');
  const box = doc.getElementById('url-range-preview');
  assert.ok(textarea && box, 'preview elements exist');
  assert.equal(box.style.display, 'none', 'hidden initially');

  textarea.value = 'https://x.test/page/[1-30]';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(400); // debounce is 250ms

  assert.equal(box.style.display, 'block', 'preview visible for range URLs');
  assert.ok(doc.getElementById('url-range-count').textContent.includes('30'), 'count shows 30 URLs');
  const samples = doc.getElementById('url-range-samples').textContent;
  assert.ok(samples.includes('https://x.test/page/1'));
  assert.ok(samples.includes('…'), 'more than 5 URLs shows an ellipsis');
});

test('URL preview - hidden for plain URLs without ranges', async () => {
  const { window } = boot();
  await wait(50);
  const doc = window.document;

  const textarea = doc.getElementById('field-sitemap-urls');
  textarea.value = 'https://x.test/products';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(400);

  assert.equal(doc.getElementById('url-range-preview').style.display, 'none');
});
