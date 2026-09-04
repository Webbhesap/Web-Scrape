/**
 * Ö4 — Incremental scraping (replace / append / merge) tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const DataModes = require('../chrome-edge/lib/datamode.js');
const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

test('DataModes - replace starts fresh', () => {
  const out = DataModes.apply('replace', [{ id: 1 }], [{ id: 2 }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test('DataModes - append keeps previous then adds', () => {
  const out = DataModes.apply('append',
    [{ name: 'a', v: 1 }, { name: 'b', v: 1 }],
    [{ name: 'c', v: 2 }]
  );
  assert.deepEqual(out.map((r) => r.name), ['a', 'b', 'c']);
});

test('DataModes - merge updates matching rows in place, appends the rest', () => {
  const prev = [
    { sku: 'x1', price: 10, stock: 5 },
    { sku: 'x2', price: 20, stock: 5 },
    { sku: 'x3', price: 30, stock: 5 }
  ];
  const fresh = [
    { sku: 'x2', price: 25, stock: 0 },  // update existing (position kept)
    { sku: 'x4', price: 40, stock: 1 }   // new row appended
  ];
  const out = DataModes.apply('merge', prev, fresh, 'sku');
  assert.deepEqual(out.map((r) => r.sku), ['x1', 'x2', 'x3', 'x4'], 'order preserved, new row appended');
  assert.equal(out[1].price, 25, 'x2 updated');
  assert.equal(out[1].stock, 0, 'x2 fully replaced by the fresh row');
  assert.equal(out[0].price, 10, 'untouched row intact');
});

test('DataModes - merge without a key degrades to append', () => {
  const out = DataModes.apply('merge', [{ a: 1 }], [{ a: 2 }], '');
  assert.equal(out.length, 2);
});

test('DataModes - empty previous data behaves in every mode', () => {
  for (const mode of DataModes.MODES) {
    const out = DataModes.apply(mode, [], [{ a: 1 }], 'a');
    assert.equal(out.length, 1, `${mode} with empty previous`);
  }
});

// ---------------------------------------------------------------------------
// Dashboard integration — run a real crawl through the boot script
// ---------------------------------------------------------------------------

function bootDashboard(htmlByTab, seededSitemap) {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const page = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = page.window;
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;
  if (typeof win.CSS === 'undefined') {
    win.CSS = { escape: (str) => String(str).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  }

  const db = {};
  if (seededSitemap) {
    db[`sitemap_${seededSitemap._id}`] = JSON.parse(JSON.stringify(seededSitemap));
  }
  const api = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: {
      local: {
        get: (keys, cb) => {
          const p = (async () => {
            if (keys == null) return { ...db };
            if (typeof keys === 'string') return db[keys] !== undefined ? { [keys]: db[keys] } : {};
            const out = {};
            (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => { if (db[k] !== undefined) out[k] = db[k]; });
            return out;
          })();
          if (cb) p.then((v) => cb(v));
          return p;
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) setTimeout(() => cb(), 0); return Promise.resolve(); },
        remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]); if (cb) setTimeout(() => cb(), 0); return Promise.resolve(); }
      }
    }
  };
  // Dashboard picks chrome.* first — install it and provide a fetch mock
  // the standalone runner would use otherwise.
  win.chrome = api;
  win.fetch = async (url) => {
    const body = htmlByTab[url];
    if (body === undefined) return { ok: false, status: 404, statusText: 'Not Found', url, text: async () => '' };
    return { ok: true, status: 200, statusText: 'OK', url, text: async () => body };
  };

  const scripts = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js', 'lib/datamode.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/zip.js', 'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const sc = win.document.createElement('script');
    sc.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(sc);
  }
  return { win, db };
}

const LISTING = (name, price) => `
  <html><body>
    <ul>
      <li class="item"><span class="sku">${name}</span><span class="price">${price}</span></li>
    </ul>
  </body></html>`;

const SITEMAP_JSON = {
  _id: 'incremental', name: 'incremental',
  startUrl: ['https://example.com/list'],
  selectors: [
    { id: 'item', type: 'SelectorElement', selector: 'li.item', parentSelectors: ['_root'], multiple: true },
    { id: 'sku', type: 'SelectorText', selector: '.sku', parentSelectors: ['item'] },
    { id: 'price', type: 'SelectorText', selector: '.price', parentSelectors: ['item'], transforms: [{ type: 'number' }] }
  ]
};

/** Opens the seeded sitemap straight into the scrape view via the list row. */
async function openSeededSitemap(win) {
  const doc = win.document;
  await sleep(150); // loadSitemaps() is async
  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr'))
    .find((tr) => tr.textContent.includes('incremental'));
  assert.ok(row, 'seeded sitemap listed');
  row.querySelector('.action-scrape').click();
  await sleep(60);
}

async function runScrape(win, mode, mergeKey, htmlBody) {
  const doc = win.document;
  // Point the mock at this page version
  win.__html = htmlBody;
  win.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', url: 'https://example.com/list', text: async () => htmlBody });
  doc.getElementById('scrape-request-interval').value = '0';
  doc.getElementById('scrape-page-delay').value = '0';
  if (mode) doc.getElementById('scrape-data-mode').value = mode;
  if (mergeKey !== undefined) doc.getElementById('scrape-merge-key').value = mergeKey;
  doc.getElementById('btn-start-scraping').click();
  await sleep(250);
}

test('Incremental scrape - append doubles the stored records', async () => {
  const { win, db } = bootDashboard({}, SITEMAP_JSON);
  await openSeededSitemap(win);
  await runScrape(win, 'replace', '', LISTING('x1', '10'));
  let stored = db['data_incremental'];
  assert.ok(stored, 'first scrape stored');
  assert.equal(stored.records.length, 1);

  await runScrape(win, 'append', '', LISTING('x1', '12'));
  stored = db['data_incremental'];
  assert.equal(stored.records.length, 2, 'append keeps previous + fresh');
});

test('Incremental scrape - merge updates the matching row by key', async () => {
  const { win, db } = bootDashboard({}, SITEMAP_JSON);
  await openSeededSitemap(win);

  await runScrape(win, 'replace', 'sku', LISTING('x1', '10'));
  await runScrape(win, 'merge', 'sku', LISTING('x1', '42'));
  const stored = db['data_incremental'];
  assert.equal(stored.records.length, 1, 'same key does not duplicate');
  assert.equal(stored.records[0].price, 42, 'matching row updated with fresh value');
});

test('Incremental scrape - replace drops previous data', async () => {
  const { win, db } = bootDashboard({}, SITEMAP_JSON);
  await openSeededSitemap(win);

  await runScrape(win, 'append', '', LISTING('x1', '10'));
  await runScrape(win, 'replace', '', LISTING('x2', '20'));
  const stored = db['data_incremental'];
  assert.equal(stored.records.length, 1);
  assert.equal(stored.records[0].sku, 'x2');
});
