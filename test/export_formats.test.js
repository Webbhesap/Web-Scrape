/**
 * P3.9 — "Markdown + XML dışa aktarımı, ZIP içine meta.json"
 * (Plan.md roadmap item 9):
 *
 * - Exporter.toMarkdown: GitHub-flavored table (pipe/newline escaping).
 * - Exporter.toXML: well-formed XML with entity escaping + safe tag names.
 * - Exporter.buildMeta: the meta.json document (sitemap, columns, types, date).
 * - Dashboard: the "Download everything (ZIP)" button bundles CSV + JSON +
 *   Markdown + XML + meta.json through the local SimpleZip (no network).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Exporter = require('../chrome-edge/src/export/Exporter.js');

test('P3.9 - toMarkdown builds a GFM table with escaping', () => {
  const rows = [
    { title: 'A | B', note: 'line1\nline2' },
    { title: 'plain', note: 'ok' }
  ];
  const md = Exporter.toMarkdown(rows, 'My Data');
  const lines = md.trim().split('\n');
  assert.ok(lines[0].startsWith('# My Data'), 'title line');
  assert.ok(lines[2].includes('| title | note |'), 'header row: ' + lines[2]);
  assert.ok(lines[3].includes('| --- | --- |'), 'separator row: ' + lines[3]);
  assert.ok(lines[4].includes('A \\| B'), 'pipe escaped: ' + lines[4]);
  assert.ok(lines[4].includes('line1<br>line2'), 'newline -> <br>: ' + lines[4]);
  assert.equal(lines.length, 6, 'title + blank + header + sep + 2 rows');

  const empty = Exporter.toMarkdown([], 'Nothing');
  assert.ok(empty.includes('_No records._'), 'empty dataset says so');
});

test('P3.9 - toXML is well-formed and escapes entities', () => {
  const rows = [
    { 'odd name!': '<b>&"quote"</b>', val: '5' },
    { 'odd name!': 'x', val: '6' }
  ];
  const xml = Exporter.toXML(rows, 'scrapedData');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'xml declaration');
  assert.ok(xml.includes('<scrapedData count="2">'), 'root with count');
  assert.ok(xml.includes('</scrapedData>'), 'closed root');
  assert.ok(xml.includes('<odd_name_>&lt;b&gt;&amp;"quote"&lt;/b&gt;</odd_name_>'), 'escaped + sanitized tag: ' + xml);
  assert.ok(!/<b>/.test(xml), 'raw markup never leaks');
  assert.equal((xml.match(/<record>/g) || []).length, 2, 'one record element per row');
  assert.equal(xml.trim().split('\n').pop(), '</scrapedData>', 'root closed last');

  const empty = Exporter.toXML([], 'scrapedData');
  assert.ok(empty.includes('<scrapedData count="0">'), 'empty root has count=0');
  assert.ok(empty.trim().endsWith('</scrapedData>'), 'empty root closed');
});

test('P3.9 - buildMeta describes the export and carries column types', () => {
  const rows = [
    { price: '1', date: '2024-03-09T12:00:00', name: 'x' },
    { price: '2', date: '2023-01-01T12:00:00', name: 'y', extra: 'z' }
  ];
  const sm = { _id: 's1', name: 'S One', startUrl: ['https://a.test', 'https://b.test'], columnTypes: [{ name: 'price', type: 'number' }] };
  const meta = Exporter.buildMeta(sm, rows);
  assert.equal(meta.sitemapId, 's1');
  assert.equal(meta.sitemapName, 'S One');
  assert.deepEqual(meta.sourceUrls, ['https://a.test', 'https://b.test']);
  assert.equal(meta.recordCount, 2);
  assert.deepEqual(meta.columns, ['price', 'date', 'name', 'extra'], 'union of keys, first-seen order');
  assert.deepEqual(meta.columnTypes, [{ name: 'price', type: 'number' }]);
  assert.equal(meta.generatorVersion, '1.0.0');
  assert.ok(!isNaN(Date.parse(meta.exportedAt)), 'exportedAt is a valid ISO date');

  // No sitemap / no columnTypes must not throw.
  const bare = Exporter.buildMeta(null, rows);
  assert.equal(bare.sitemapId, null);
  assert.deepEqual(bare.columnTypes, []);
});

// ---------------------------------------------------------------------------
// E2E: the ZIP bundle button in the export view.
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
  doc.getElementById('field-sitemap-urls').value = 'https://exp.test/page';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
}

test('P3.9 - export view ZIP bundle contains CSV/JSON/MD/XML + meta.json', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await createSitemap(win, 'exp_zip');

  const rows = [
    { price: '1.234,56', date: '2024-03-09T12:00:00', name: 'Ayşe' },
    { price: '99,90', date: '2023-12-31T12:00:00', name: 'B' }
  ];
  await win.AppStorage.saveScrapedData('exp_zip', rows);

  // Set the column type through the real browse-view UI so the dashboard's
  // live sitemap instance (and storage) both carry it.
  doc.getElementById('nav-sitemap-browse').click();
  await sleep(80);
  const priceType = doc.querySelector('select[data-col-type="price"]');
  assert.ok(priceType, 'browse view rendered column type selects');
  priceType.value = 'number';
  priceType.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(60);
  doc.getElementById('nav-sitemap-export-data').click();
  await sleep(40);

  // Capture what the local zip library receives and what the anchor downloads.
  let zipFiles = null;
  win.SimpleZip.build = async (files) => { zipFiles = files; return new Uint8Array([0x50, 0x4b, 0x03, 0x04]); };
  const clicks = [];
  win.HTMLAnchorElement.prototype.click = function () { clicks.push({ download: this.download, href: this.href }); };
  win.URL.createObjectURL = (blob) => 'blob:fake-' + (blob.size || 0);
  win.URL.revokeObjectURL = () => {};

  // Markdown + XML buttons trigger plain downloads.
  doc.getElementById('btn-download-md').click();
  doc.getElementById('btn-download-xml').click();
  await sleep(30);
  assert.equal(clicks.length, 2, 'md + xml downloads triggered');
  assert.ok(clicks[0].download.endsWith('_data.md'), 'md filename: ' + clicks[0].download);
  assert.ok(clicks[1].download.endsWith('_data.xml'), 'xml filename: ' + clicks[1].download);

  clicks.length = 0;
  doc.getElementById('btn-download-zip').click();
  await sleep(120);

  assert.ok(Array.isArray(zipFiles) && zipFiles.length === 5, 'zip got 5 files: ' + (zipFiles || []).map((f) => f.name).join(','));
  const byName = new Map(zipFiles.map((f) => [f.name, f]));
  // jsdom runs dashboard code in a vm realm; wrap that Uint8Array's
  // ArrayBuffer with an outer-realm view and reads come back flaky
  // (sometimes zeroed). Copy through plain numbers instead.
  const dec = (bytes) => new TextDecoder().decode(new Uint8Array(Array.from(bytes)));
  for (const n of ['exp_zip_data.csv', 'exp_zip_data.json', 'exp_zip_data.md', 'exp_zip_data.xml', 'meta.json']) {
    assert.ok(byName.has(n), 'bundle contains ' + n);
  }

  // CSV inside the bundle honors the persisted number type.
  const csvText = dec(byName.get('exp_zip_data.csv').data);
  assert.ok(csvText.includes('1234.56'), 'bundled CSV applies column type: ' + csvText);

  // meta.json is valid JSON with the full export description.
  const meta = JSON.parse(dec(byName.get('meta.json').data));
  assert.equal(meta.sitemapId, 'exp_zip');
  assert.equal(meta.recordCount, 2);
  assert.deepEqual(meta.columns, ['price', 'date', 'name']);
  assert.deepEqual(meta.columnTypes, [{ name: 'price', type: 'number' }]);
  assert.ok(!isNaN(Date.parse(meta.exportedAt)), 'meta.exportedAt valid');

  // XML payload is well-formed.
  const xmlText = dec(byName.get('exp_zip_data.xml').data);
  assert.ok(xmlText.startsWith('<?xml'), 'xml declaration in bundle');
  assert.ok(xmlText.trim().endsWith('</scrapedData>'), 'xml root closed in bundle');

  // The anchor downloaded the bundle under the right name.
  assert.equal(clicks.length, 1, 'one bundle download');
  assert.equal(clicks[0].download, 'exp_zip_export.zip', 'bundle filename');

  win.close();
});
