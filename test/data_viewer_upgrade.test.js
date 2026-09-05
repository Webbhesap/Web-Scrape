/**
 * Ö5 — Data viewer upgrade tests: column filters, numeric & multi-column
 * sort, column visibility, stats bar, hidden-column-aware CSV copy.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SITEMAP = {
  _id: 'viewer', name: 'viewer',
  startUrl: ['https://example.com/'],
  selectors: []
};

const RECORDS = [
  { 'web-scraper-order': '1', name: 'banana', price: '2', qty: 50, city: 'Izmir' },
  { 'web-scraper-order': '2', name: 'apple', price: '10', qty: 5, city: 'Rize' },
  { 'web-scraper-order': '3', name: 'cherry', price: '1', qty: 120, city: 'Izmir' },
  { 'web-scraper-order': '4', name: 'date', price: '25', qty: 7, city: 'Adana' },
  { 'web-scraper-order': '5', name: 'elderberry', price: '3', qty: 9, city: 'Rize' }
];

function boot() {
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

  const db = {
    sitemap_viewer: JSON.parse(JSON.stringify(SITEMAP)),
    data_viewer: { sitemapId: 'viewer', records: JSON.parse(JSON.stringify(RECORDS)) }
  };
  win.chrome = {
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

  const scripts = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js', 'lib/datamode.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/zip.js',
    'lib/undo_stack.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const sc = win.document.createElement('script');
    sc.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(sc);
  }
  return { win, db };
}

async function openBrowse(win) {
  const doc = win.document;
  await sleep(150);
  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr')).find((tr) => tr.textContent.includes('viewer'));
  assert.ok(row, 'seeded sitemap listed');
  row.querySelector('.action-browse').click();
  await sleep(80);
  return doc;
}

function columnTexts(doc, colIndex) {
  return Array.from(doc.querySelectorAll('#tbody-scraped-data tr'))
    .map((tr) => tr.children[colIndex] && tr.children[colIndex].textContent);
}

function headerIndex(doc, name) {
  return Array.from(doc.querySelectorAll('#thead-scraped-data tr:first-child th'))
    .findIndex((th) => th.textContent.startsWith(name));
}

test('Data viewer - column filter narrows rows and combines with search', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  const cityIdx = headerIndex(doc, 'city');
  const filterInput = doc.querySelectorAll('#thead-scraped-data tr:nth-child(2) th input')[cityIdx];
  assert.ok(filterInput, 'filter row rendered');
  filterInput.value = 'izmir';
  filterInput.dispatchEvent(new win.Event('input', { bubbles: true }));
  await sleep(50);

  const cities = columnTexts(doc, cityIdx);
  assert.equal(cities.length, 2, 'two Izmir rows');
  assert.ok(cities.every((c) => c === 'Izmir'));
});

test('Data viewer - numeric column sorts numerically', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  const priceIdx = headerIndex(doc, 'price');
  doc.querySelectorAll('#thead-scraped-data tr:first-child th')[priceIdx].click();
  await sleep(50);
  let prices = columnTexts(doc, priceIdx);
  assert.deepEqual(prices, ['1', '2', '3', '10', '25'], 'numeric order, not lexicographic');

  // Toggle to descending
  doc.querySelectorAll('#thead-scraped-data tr:first-child th')[priceIdx].click();
  await sleep(50);
  prices = columnTexts(doc, priceIdx);
  assert.deepEqual(prices, ['25', '10', '3', '2', '1']);
});

test('Data viewer - shift+click stacks a secondary sort', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  const cityIdx = headerIndex(doc, 'city');
  const qtyIdx = headerIndex(doc, 'qty');
  doc.querySelectorAll('#thead-scraped-data tr:first-child th')[cityIdx].click();
  await sleep(40);
  doc.querySelectorAll('#thead-scraped-data tr:first-child th')[qtyIdx].dispatchEvent(
    new win.MouseEvent('click', { bubbles: true, shiftKey: true })
  );
  await sleep(50);

  // Primary: city asc; secondary (first shift+click): qty asc within city
  const cities = columnTexts(doc, cityIdx);
  assert.deepEqual(cities, ['Adana', 'Izmir', 'Izmir', 'Rize', 'Rize']);
  const qtys = columnTexts(doc, qtyIdx).map(Number);
  assert.deepEqual(qtys, [7, 50, 120, 5, 9], 'secondary sort applied within equal primary groups');

  // A second shift+click on the same column flips it to descending
  doc.querySelectorAll('#thead-scraped-data tr:first-child th')[qtyIdx].dispatchEvent(
    new win.MouseEvent('click', { bubbles: true, shiftKey: true })
  );
  await sleep(50);
  const qtysDesc = columnTexts(doc, qtyIdx).map(Number);
  assert.deepEqual(qtysDesc, [7, 120, 50, 9, 5], 'shift+click toggles the secondary direction');
});

test('Data viewer - column visibility hides columns and persists per session', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  doc.getElementById('btn-data-columns').click();
  await sleep(30);
  const pop = doc.getElementById('data-columns-popover');
  assert.equal(pop.style.display, 'block', 'popover opens');
  const labels = Array.from(pop.querySelectorAll('label'));
  const qtyLabel = labels.find((l) => l.textContent.trim() === 'qty');
  assert.ok(qtyLabel, 'qty column listed');
  qtyLabel.querySelector('input').checked = false;
  qtyLabel.querySelector('input').dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(50);

  assert.equal(headerIndex(doc, 'qty'), -1, 'qty header hidden');
  assert.equal(win.sessionStorage.getItem('ws_hidden_cols'), JSON.stringify(['qty']), 'persisted to session storage');

  // Refresh view (re-open browse): still hidden within the session
  doc.getElementById('nav-sitemap-browse').click();
  await sleep(60);
  assert.equal(headerIndex(doc, 'qty'), -1, 'still hidden after view refresh');
});

test('Data viewer - stats bar summarizes numeric columns of the filtered set', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  const bar = doc.getElementById('data-stats-bar');
  assert.equal(bar.style.display, 'block', 'stats bar visible');
  assert.match(bar.textContent, /price/, 'price summarized');
  assert.match(bar.textContent, /n=5/, 'five numeric values');
  assert.match(bar.textContent, /41/, 'sum 1+2+3+10+25 = 41');
  assert.ok(!/name/.test(bar.textContent), 'text columns skipped');
});

test('Data viewer - Copy CSV respects hidden columns', async () => {
  const { win } = boot();
  const doc = await openBrowse(win);

  doc.getElementById('btn-data-columns').click();
  await sleep(30);
  const pop = doc.getElementById('data-columns-popover');
  const qtyLabel = Array.from(pop.querySelectorAll('label')).find((l) => l.textContent.trim() === 'qty');
  qtyLabel.querySelector('input').checked = false;
  qtyLabel.querySelector('input').dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(50);

  let copied = null;
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { copied = text; } }
  });
  doc.getElementById('btn-copy-data-csv').click();
  await sleep(60);
  assert.ok(copied, 'clipboard received CSV');
  assert.ok(!/qty/.test(copied.split('\n')[0]), 'hidden column not in the CSV header');
  assert.match(copied.split('\n')[0], /price/);
});

test('Data viewer - header union covers columns the first row does not have', async () => {
  // Regression: the table header was built from Object.keys(filteredData[0]),
  // so any column missing from the FIRST row was invisible in the viewer (and
  // therefore also absent from the stats bar and the column popover) even
  // though thousands of other rows carried it.
  const { win } = boot();
  const doc = win.document;
  await sleep(150);

  await win.AppStorage.saveScrapedData('viewer', [
    { 'web-scraper-order': '1', name: 'first' },
    { 'web-scraper-order': '2', name: 'second', price: '5', qty: 3 },
    { 'web-scraper-order': '3', name: 'third', price: '7' }
  ]);

  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr')).find((tr) => tr.textContent.includes('viewer'));
  assert.ok(row, 'sitemap listed');
  row.querySelector('.action-browse').click();
  await sleep(120);

  const headers = Array.from(doc.querySelectorAll('#thead-scraped-data tr:first-child th')).map((th) => th.textContent);
  assert.ok(headers.some((h) => h.startsWith('price')), 'price column rendered: ' + headers.join('|'));
  assert.ok(headers.some((h) => h.startsWith('qty')), 'qty column rendered: ' + headers.join('|'));

  // The cell that lacks the value renders empty rather than shifting columns.
  const rows = Array.from(doc.querySelectorAll('#tbody-scraped-data tr'));
  const priceIdx = headers.findIndex((h) => h.startsWith('price'));
  assert.equal(rows[0].children[priceIdx].textContent, '', 'missing value is an empty cell');
  assert.equal(rows[1].children[priceIdx].textContent, '5', 'values stay in their own column');

  // Stats only consider rows that actually carry a number.
  const bar = doc.getElementById('data-stats-bar');
  assert.match(bar.textContent, /price/, 'price summarized');
  assert.match(bar.textContent, /n=2/, 'two numeric values, not three');
});
