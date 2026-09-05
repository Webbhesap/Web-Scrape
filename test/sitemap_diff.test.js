/**
 * P3.11 — "Sitemap sürüm-diff aracı (compare(sitemapA, sitemapB) saf fonksiyon)"
 * (Plan.md roadmap item 11):
 *
 * - lib/sitemap_diff.js: compareSitemaps(a, b) — pure, no DOM/network.
 *   Accepts Sitemap instances or plain JSON; identity by selector id;
 *   field-level selector changes (any type-specific attribute included via
 *   the toJSON shape); start URL / name / options / columnTypes diffs.
 * - Dashboard: "Version diff" entry in the sitemap dropdown — base = another
 *   saved sitemap OR an uploaded sitemap JSON; readable +/-/~ rendering.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SitemapDiff = require('../chrome-edge/lib/sitemap_diff.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');

function plainSitemap(over) {
  return Object.assign({
    _id: 'x', name: 'X',
    startUrl: ['https://a.test/1'],
    selectors: [{ id: 't', type: 'SelectorText', selector: '.t', parentSelectors: ['_root'] }],
    options: { shadowDom: true },
    columnTypes: []
  }, over || {});
}

test('P3.11 - identical sitemaps diff to identical', () => {
  const a = plainSitemap();
  const b = plainSitemap();
  const d = SitemapDiff.compareSitemaps(a, b);
  assert.ok(d);
  assert.equal(d.identical, true);
  assert.deepEqual(d.summary, { added: 0, removed: 0, changed: 0, identical: true });
});

test('P3.11 - selector add/remove/change + URL + name + options diffs', () => {
  const a = plainSitemap({
    name: 'Old',
    startUrl: ['https://a.test/1', 'https://a.test/gone'],
    selectors: [
      { id: 'keep', type: 'SelectorText', selector: '.same', parentSelectors: ['_root'] },
      { id: 'gone', type: 'SelectorText', selector: '.old', parentSelectors: ['_root'] },
      { id: 'mod', type: 'SelectorLink', selector: 'a.x', parentSelectors: ['_root'], linkType: 'linkFromText' }
    ],
    options: { shadowDom: true, maxPages: 10 }
  });
  const b = plainSitemap({
    name: 'New',
    startUrl: ['https://a.test/1', 'https://a.test/new'],
    selectors: [
      // parentSelectors in different order must still be "unchanged".
      { id: 'keep', type: 'SelectorText', selector: '.same', parentSelectors: ['_root'] },
      { id: 'mod', type: 'SelectorLink', selector: 'a.y', parentSelectors: ['_root'], linkType: 'linkFromHref' },
      { id: 'fresh', type: 'SelectorImage', selector: 'img.z', parentSelectors: ['_root'] }
    ],
    options: { shadowDom: false, maxPages: 10 }
  });

  const d = SitemapDiff.compareSitemaps(a, b);
  assert.equal(d.identical, false);
  assert.equal(d.name.from, 'Old');
  assert.equal(d.name.to, 'New');

  assert.deepEqual(d.startUrls.added, ['https://a.test/new']);
  assert.deepEqual(d.startUrls.removed, ['https://a.test/gone']);

  assert.deepEqual(d.selectors.added.map((s) => s.id), ['fresh']);
  assert.deepEqual(d.selectors.removed.map((s) => s.id), ['gone']);
  assert.deepEqual(d.selectors.changed.map((c) => c.id), ['mod']);
  assert.equal(d.selectors.unchangedCount, 1, 'keep is unchanged (order-insensitive parents)');

  const mod = d.selectors.changed[0];
  assert.equal(mod.changes.selector.from, 'a.x');
  assert.equal(mod.changes.selector.to, 'a.y');
  assert.equal(mod.changes.linkType.from, 'linkFromText');
  assert.equal(mod.changes.linkType.to, 'linkFromHref', 'type-specific attribute diffed');

  const opts = Object.fromEntries(d.options.changed.map((c) => [c.key, c]));
  assert.equal(opts.shadowDom.from, true);
  assert.equal(opts.shadowDom.to, false);
  assert.ok(!('maxPages' in opts), 'unchanged option not listed');

  assert.equal(d.summary.added, 1);
  assert.equal(d.summary.removed, 1);
  assert.equal(d.summary.changed, 3, 'name + selector + option');
});

test('P3.11 - columnTypes diff + Sitemap instance input + invalid input', () => {
  const a = new Sitemap({
    _id: 'c1', name: 'C', startUrl: ['https://c.test'],
    selectors: [], options: {},
    columnTypes: [{ name: 'price', type: 'number' }, { name: 'd', type: 'date', format: 'YYYY-MM-DD' }]
  });
  a.setColumnType('price', 'number');
  const b = plainSitemap({
    _id: 'c1', name: 'C', startUrl: ['https://c.test'],
    selectors: [],
    options: { shadowDom: true, respectRobots: false, robotsUserAgent: '*', pageTitle: { enabled: false, selector: 'title', field: 'pageTitle' } },
    columnTypes: [{ name: 'price', type: 'number' }, { name: 'd', type: 'date', format: 'DD/MM/YYYY' }]
  });
  // a is a Sitemap instance (goes through toJSON), b is plain JSON.
  const d = SitemapDiff.compareSitemaps(a, b);
  assert.ok(d, 'mixed instance/plain input works');
  assert.deepEqual(d.columnTypes.changed.map((c) => c.name), ['d'], 'only the format change listed');
  assert.equal(d.columnTypes.changed[0].to.format, 'DD/MM/YYYY');

  assert.equal(SitemapDiff.compareSitemaps(null, b), null);
  assert.equal(SitemapDiff.compareSitemaps('nope', b), null);
  assert.equal(SitemapDiff.compareSitemaps([], b), null, 'arrays are not sitemaps');
  // A bare {} IS a usable (empty) sitemap: everything in b shows as added.
  const emptyDiff = SitemapDiff.compareSitemaps({}, b);
  assert.ok(emptyDiff && !emptyDiff.identical, 'empty-object diff is valid');
  assert.equal(emptyDiff.name.from, '');
});

// ---------------------------------------------------------------------------
// UI: the version-diff view in the dashboard
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
    'src/engine/DataFlattener.js', 'lib/robots.js', 'lib/sitemap_diff.js', 'src/engine/ScraperEngine.js',
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
  doc.getElementById('field-sitemap-urls').value = `https://${id}.test/page`;
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
}

test('P3.11 - diff view compares saved sitemaps and uploaded JSON', async () => {
  const { win } = bootDashboard();
  const doc = win.document;

  // Base sitemap WITH a selector; current sitemap WITHOUT it.
  await createSitemap(win, 'diff_base');
  doc.getElementById('btn-add-selector').click();
  await sleep(30);
  doc.getElementById('field-selector-id').value = 'price';
  const typeSel = doc.getElementById('field-selector-type');
  typeSel.value = 'SelectorText';
  typeSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(20);
  doc.getElementById('field-selector-css').value = '.price';
  doc.getElementById('btn-save-selector').click();
  await sleep(60);

  await createSitemap(win, 'diff_cur');

  // Open the diff view: the base dropdown offers the OTHER sitemap only.
  doc.getElementById('nav-sitemap-diff').click();
  await sleep(30);
  const baseSel = doc.getElementById('diff-base-select');
  assert.ok(baseSel, 'diff view rendered');
  const opts = Array.from(baseSel.querySelectorAll('option')).map((o) => o.value);
  assert.ok(opts.includes('diff_base'), 'base sitemap offered');
  assert.ok(!opts.includes('diff_cur'), 'current sitemap excluded');

  // Saved-sitemap comparison: #price exists in base but not in current.
  baseSel.value = 'diff_base';
  doc.getElementById('btn-diff-run').click();
  await sleep(60);
  const result = doc.getElementById('diff-result');
  assert.equal(result.style.display, 'block', 'result shown');
  const bodyText = doc.getElementById('diff-body').textContent;
  assert.ok(bodyText.includes('#price'), 'removed selector listed: ' + bodyText);
  assert.ok(bodyText.includes('diff_base') && bodyText.includes('→') && bodyText.includes('diff_cur'), 'name change rendered: ' + bodyText);

  // Identical base (current vs current-as-file) -> identical badge.
  const curJson = JSON.stringify(await win.AppStorage.getSitemap('diff_cur'));
  const fileInput = doc.getElementById('diff-file-input');
  const fakeFile = Object.create(win.File ? win.File.prototype : Object.prototype);
  Object.defineProperty(fakeFile, 'name', { value: 'cur.json' });
  fakeFile.text = async () => curJson;
  Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });
  doc.getElementById('btn-diff-run').click();
  await sleep(60);
  assert.ok(doc.getElementById('diff-summary').textContent.includes('identical'), 'identical badge: ' + doc.getElementById('diff-summary').textContent);

  // Corrupt upload -> translated alert, no crash.
  const badFile = Object.create(win.File ? win.File.prototype : Object.prototype);
  Object.defineProperty(badFile, 'name', { value: 'bad.json' });
  badFile.text = async () => '{ not json';
  Object.defineProperty(fileInput, 'files', { value: [badFile], configurable: true });
  doc.getElementById('btn-diff-run').click();
  await sleep(40);
  assert.ok((win.__alerts || []).length > 0, 'alert for invalid JSON');

  win.close();
});

test('P3.11 - diff result names the base version it was computed against', async () => {
  // Regression: runSitemapDiff() already knew the base label (uploaded file
  // name, or the saved sitemap's name) but stored it in a variable that was
  // never used — the result showed a list of changes with no indication of
  // WHICH version they were relative to.
  const { win } = bootDashboard();
  const doc = win.document;

  await createSitemap(win, 'label_base');
  await createSitemap(win, 'label_cur');

  doc.getElementById('nav-sitemap-diff').click();
  await sleep(30);

  // Saved-sitemap base: the label comes from the sitemap name/id.
  doc.getElementById('diff-base-select').value = 'label_base';
  doc.getElementById('btn-diff-run').click();
  await sleep(60);
  const summaryText = doc.getElementById('diff-summary').textContent;
  assert.ok(/label_base/.test(summaryText), 'saved base named in the summary: ' + summaryText);
  assert.ok(/Base version|Baz sürüm/.test(summaryText), 'label is localized: ' + summaryText);

  // Uploaded-file base: the label is the file name.
  const curJson = JSON.stringify(await win.AppStorage.getSitemap('label_cur'));
  const fileInput = doc.getElementById('diff-file-input');
  const fakeFile = Object.create(win.File ? win.File.prototype : Object.prototype);
  Object.defineProperty(fakeFile, 'name', { value: 'upload_v7.json' });
  fakeFile.text = async () => curJson;
  Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });
  doc.getElementById('btn-diff-run').click();
  await sleep(60);
  const summaryText2 = doc.getElementById('diff-summary').textContent;
  assert.ok(/upload_v7\.json/.test(summaryText2), 'uploaded file named in the summary: ' + summaryText2);

  win.close();
});
