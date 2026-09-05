/**
 * P2.4 — "kolon tipi kalıcılığı (CSV sayı/tarih formatı per sitemap)"
 * (Plan.md roadmap item 8):
 *
 * - Sitemap persists per-column CSV types (number / date + format)
 *   round-tripping through toJSON / constructor.
 * - Exporter.toCSV applies the persisted types: localized numbers are
 *   normalized, dates are written in the column's date format.
 * - The browse-data view renders a per-column type select in the header
 *   and persists the choice with the sitemap (chrome.storage path).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Exporter = require('../chrome-edge/src/export/Exporter.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');

test('P2.4 - parseColumnNumber normalizes localized numbers', () => {
  assert.equal(Exporter.parseColumnNumber('1.234,56'), 1234.56);
  assert.equal(Exporter.parseColumnNumber('1,234.56'), 1234.56);
  assert.equal(Exporter.parseColumnNumber('$1,234'), 1234);
  assert.equal(Exporter.parseColumnNumber('45,90 ₺'), 45.9);
  assert.equal(Exporter.parseColumnNumber('-2 500,75'), -2500.75);
  assert.equal(Exporter.parseColumnNumber('3,5'), 3.5);
  assert.equal(Exporter.parseColumnNumber(42), 42);
  assert.equal(Exporter.parseColumnNumber('3.75'), 3.75);
  // Not a number -> null (exporter leaves such cells untouched).
  assert.equal(Exporter.parseColumnNumber('abc'), null);
  assert.equal(Exporter.parseColumnNumber(''), null);
  assert.equal(Exporter.parseColumnNumber(null), null);
  assert.equal(Exporter.parseColumnNumber(NaN), null);
  assert.equal(Exporter.parseColumnNumber('1.2.3'), null);
});

test('P2.4 - formatColumnDate formats Date-like values, leaves others', () => {
  const d = new Date(2024, 2, 9, 12, 5, 3); // 9 March 2024 (local noon — TZ safe)
  assert.equal(Exporter.formatColumnDate(d, 'YYYY-MM-DD'), '2024-03-09');
  assert.equal(Exporter.formatColumnDate(d, 'DD/MM/YYYY'), '09/03/2024');
  assert.equal(Exporter.formatColumnDate(d, 'YYYY-MM-DD HH:mm:ss'), '2024-03-09 12:05:03');
  assert.equal(Exporter.formatColumnDate(d, null), '2024-03-09'); // default format
  assert.equal(Exporter.formatColumnDate('2024-03-09T12:00:00', 'DD.MM.YYYY'), '09.03.2024');
  // Non-date values are returned untouched.
  assert.equal(Exporter.formatColumnDate('hello', 'YYYY-MM-DD'), 'hello');
  assert.equal(Exporter.formatColumnDate('', 'DD/MM/YYYY'), '');
});

test('P2.4 - toCSV applies persisted column types (array and map shapes)', () => {
  const rows = [
    { price: '1.234,56', date: '2024-03-09T12:00:00', name: 'Ayşe' },
    { price: '99,90', date: '2023-12-31T12:00:00', name: 'B' }
  ];

  const withArray = Exporter.toCSV(rows, {
    bom: false,
    columnTypes: [
      { name: 'price', type: 'number' },
      { name: 'date', type: 'date', format: 'DD/MM/YYYY' }
    ]
  });
  assert.ok(withArray.includes('1234.56'), 'localized number normalized: ' + withArray);
  assert.ok(withArray.includes('99.9'), 'second row number normalized: ' + withArray);
  assert.ok(withArray.includes('09/03/2024'), 'date in DD/MM/YYYY: ' + withArray);
  assert.ok(withArray.includes('31/12/2023'), 'second date: ' + withArray);
  assert.ok(withArray.includes('Ayşe'), 'text column untouched: ' + withArray);
  assert.ok(!withArray.includes('1.234,56'), 'raw localized string no longer present');

  const withMap = Exporter.toCSV(rows, {
    bom: false,
    columnTypes: { price: { type: 'number' }, date: { type: 'date', format: 'YYYY-MM-DD' } }
  });
  assert.ok(withMap.includes('1234.56'), 'map shape works');
  assert.ok(withMap.includes('2024-03-09'), 'default-ish ISO format from map');

  // No columnTypes -> byte-identical to the plain export (backwards compat).
  const plain = Exporter.toCSV(rows, { bom: false });
  assert.ok(plain.includes('1.234,56'), 'without types the raw value is kept');
});

test('P2.4 - Sitemap persists and validates columnTypes', () => {
  const sm = new Sitemap({ _id: 'ct', name: 'CT', startUrl: ['https://ct.test'] });
  assert.deepEqual(sm.columnTypes, []);

  sm.setColumnType('price', 'number');
  sm.setColumnType('date', 'date', 'DD/MM/YYYY');
  assert.deepEqual(sm.getColumnType('price'), { name: 'price', type: 'number' });
  assert.deepEqual(sm.getColumnType('date'), { name: 'date', type: 'date', format: 'DD/MM/YYYY' });
  assert.equal(sm.getColumnType('name'), null);

  // Round-trip through the stored JSON shape.
  const json = JSON.parse(JSON.stringify(sm.toJSON()));
  const sm2 = new Sitemap(json);
  assert.deepEqual(sm2.columnTypes, sm.columnTypes);

  // 'text' removes the entry; changing format updates in place.
  sm2.setColumnType('price', 'text');
  assert.equal(sm2.getColumnType('price'), null);
  sm2.setColumnType('date', 'date', 'YYYY-MM-DD');
  assert.equal(sm2.getColumnType('date').format, 'YYYY-MM-DD');
  assert.deepEqual(sm2.getColumnType('date'), { name: 'date', type: 'date', format: 'YYYY-MM-DD' });

  // Constructor filters junk entries and defaults the date format.
  const dirty = new Sitemap({
    _id: 'd', name: 'D', startUrl: ['https://d.test'],
    columnTypes: [
      { name: '', type: 'number' },
      { name: 'a', type: 'bogus' },
      { name: 'ok', type: 'date' },
      null,
      'nonsense'
    ]
  });
  assert.deepEqual(dirty.columnTypes, [{ name: 'ok', type: 'date', format: 'YYYY-MM-DD' }]);
});

// ---------------------------------------------------------------------------
// UI: the browse-data header renders one type select per column and the
// choice is persisted with the sitemap.
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bootDashboard() {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = dom.window;
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;

  const db = {};
  win.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: {
      local: {
        QUOTA_BYTES: 104857600,
        getBytesInUse: (keys, cb) => cb(0),
        get: (keys, cb) => {
          if (keys == null) return cb({ ...db });
          if (typeof keys === 'string') return cb(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => { if (db[k] !== undefined) out[k] = db[k]; });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) cb(); },
        remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]); if (cb) cb(); }
      }
    }
  };
  win.alert = (m) => { win.__alerts = win.__alerts || []; win.__alerts.push(String(m)); };
  win.confirm = () => true;

  const SCRIPTS = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/datamode.js', 'lib/undo_stack.js',
    'lib/sitemap_templates.js', 'lib/download_manager.js', 'lib/zip.js', 'dashboard/dashboard.js'
  ];
  for (const rel of SCRIPTS) {
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(el);
  }
  return { win, db };
}

async function createSitemap(win, id) {
  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = id;
  doc.getElementById('field-sitemap-urls').value = 'https://ct.test/page';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
}

test('P2.4 - browse view column type select persists with the sitemap', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await createSitemap(win, 'col_types');

  const rows = [
    { price: '1.234,56', date: '2024-03-09T12:00:00', name: 'Ayşe' },
    { price: '99,90', date: '2023-12-31T12:00:00', name: 'B' }
  ];
  await win.AppStorage.saveScrapedData('col_types', rows);

  doc.getElementById('nav-sitemap-browse').click();
  await sleep(80);

  // One type select per data column (plus the header filter inputs intact).
  const priceSel = doc.querySelector('select[data-col-type="price"]');
  const dateSel = doc.querySelector('select[data-col-type="date"]');
  const nameSel = doc.querySelector('select[data-col-type="name"]');
  assert.ok(priceSel && dateSel && nameSel, 'every column has a type select');
  assert.equal(priceSel.value, 'text', 'default type is text');
  assert.ok(doc.querySelector('input[data-col-filter="price"]'), 'filter inputs still present');

  // Choose number for price and a date format for date.
  priceSel.value = 'number';
  priceSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  dateSel.value = 'date-dmy';
  dateSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(80);

  // Persisted with the sitemap (through the real storage path).
  const stored = await win.AppStorage.getSitemap('col_types');
  const storedTypes = stored.columnTypes || [];
  assert.ok(storedTypes.some((ct) => ct.name === 'price' && ct.type === 'number'), 'price=number saved: ' + JSON.stringify(storedTypes));
  assert.ok(storedTypes.some((ct) => ct.name === 'date' && ct.type === 'date' && ct.format === 'DD/MM/YYYY'), 'date=DD/MM/YYYY saved: ' + JSON.stringify(storedTypes));

  // Re-render (filtering) keeps the stored choices in the selects.
  const filter = doc.querySelector('input[data-col-filter="name"]');
  filter.value = 'Ayşe';
  filter.dispatchEvent(new win.Event('input', { bubbles: true }));
  await sleep(50);
  assert.equal(doc.querySelector('select[data-col-type="price"]').value, 'number', 'select keeps stored type after re-render');
  assert.equal(doc.querySelector('select[data-col-type="date"]').value, 'date-dmy', 'select keeps stored format after re-render');

  // Switching back to text removes the entry.
  const dateSel2 = doc.querySelector('select[data-col-type="date"]');
  dateSel2.value = 'text';
  dateSel2.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(80);
  const stored2 = await win.AppStorage.getSitemap('col_types');
  assert.ok(!(stored2.columnTypes || []).some((ct) => ct.name === 'date'), 'text choice removed the entry');
  assert.ok((stored2.columnTypes || []).some((ct) => ct.name === 'price' && ct.type === 'number'), 'price entry untouched');

  // The stored types drive the export through the same public API.
  const csv = win.Exporter.toCSV(rows, { bom: false, columnTypes: stored2.columnTypes });
  assert.ok(csv.includes('1234.56'), 'export applies the persisted number type: ' + csv);

  win.close();
});
