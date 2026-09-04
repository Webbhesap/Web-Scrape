/**
 * Ö10 — selector undo/redo + webscraper.io import compatibility tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const UndoStack = require('../chrome-edge/lib/undo_stack.js');
const Selector = require('../chrome-edge/src/models/Selector.js');
const SitemapModule = require('../chrome-edge/src/models/Sitemap.js');
const Sitemap = SitemapModule.Sitemap || SitemapModule;

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// UndoStack unit
// ---------------------------------------------------------------------------

test('UndoStack - add, delete, undo, redo cycle restores each state', () => {
  const h = UndoStack.create();
  const base = [{ id: 'a' }];
  h.commit(base);                    // baseline (1 selector)
  h.commit([{ id: 'a' }, { id: 'b' }]); // add b (2)
  h.commit([{ id: 'a' }]);           // delete b (1)

  const afterDelete = h.undo([{ id: 'a' }]);
  assert.deepEqual(afterDelete, [{ id: 'a' }, { id: 'b' }], 'undo restores the add');

  const afterUndo = h.undo(afterDelete);
  assert.deepEqual(afterUndo, [{ id: 'a' }], 'second undo returns to baseline');

  assert.equal(h.undo(afterUndo), null, 'no further undo at the bottom');

  const redone = h.redo(afterUndo);
  assert.deepEqual(redone, [{ id: 'a' }, { id: 'b' }], 'redo replays the add');
  const redone2 = h.redo(redone);
  assert.deepEqual(redone2, [{ id: 'a' }], 'redo replays the delete');
  assert.equal(h.redo(redone2), null, 'no further redo');
});

test('UndoStack - a new commit clears the redo branch; limit caps depth', () => {
  const h = UndoStack.create(3);
  h.commit({ n: 1 });
  h.commit({ n: 2 });
  h.undo({ n: 2 }); // back to 1
  assert.ok(h.canRedo());
  h.commit({ n: 3 }); // branching change
  assert.ok(!h.canRedo(), 'redo cleared by the new commit');
  assert.equal(h.undo({ n: 3 }).n, 1);

  const small = UndoStack.create(2);
  for (let i = 0; i < 10; i++) small.commit({ n: i });
  assert.equal(small.depth(), 2, 'history capped');
});

// ---------------------------------------------------------------------------
// webscraper.io normalization
// ---------------------------------------------------------------------------

// Realistic webscraper.io export shape (same selector type names, extra
// fields we do not use, missing fields we default).
const WEBSCRAPER_IO_JSON = {
  _id: 'ecommerce_products',
  startUrl: ['https://webscraper.io/test-sites/e-commerce/allinone'],
  selectors: [
    {
      id: 'category_link', type: 'SelectorLink', selector: 'div.sidebar a.nav-link',
      parentSelectors: ['_root'], multiple: true, linkType: 'linkFromHref', delay: 0,
      clickElementUniquenessType: 'uniqueText' // unknown -> ignored
    },
    {
      id: 'product_card', type: 'SelectorElement', selector: 'div.product-wrapper',
      parentSelectors: ['category_link', '_root'], multiple: true, delay: 0
    },
    {
      id: 'price', type: 'SelectorText', selector: 'span.price',
      parentSelectors: ['product_card'], multiple: false, regex: '[\\d.]+', delay: 0,
      stringManupulationType: 'replace', // webscraper.io legacy field -> ignored
      textManipulation: { regex: 'x' }   // unknown -> ignored
    },
    null, // broken row -> filtered
    { id: 'no_parent', type: 'SelectorText', selector: 'h1' } // parentSelectors missing -> ['_root']
  ]
};

test('Import - webscraper.io JSON normalizes into a valid sitemap', () => {
  const normalized = Sitemap.normalizeImported(WEBSCRAPER_IO_JSON);
  assert.ok(normalized, 'normalized');
  assert.equal(normalized._id, 'ecommerce_products');
  assert.equal(normalized.selectors.length, 4, 'null row dropped');

  const sm = new Sitemap(normalized);
  const v = sm.validate();
  assert.ok(v.isValid, 'validates: ' + JSON.stringify(v.errors));

  const price = sm.getSelectorById('price');
  assert.equal(price.regex, '[\\d.]+', 'regex preserved');
  assert.ok(!('stringManupulationType' in price) && !('textManipulation' in price), 'unknown fields dropped');
  const noParent = sm.getSelectorById('no_parent');
  assert.deepEqual(noParent.parentSelectors, ['_root'], 'missing parents defaulted');
});

test('Import - startUrl string, missing _id and unknown top-level fields are handled', () => {
  const normalized = Sitemap.normalizeImported({
    startUrl: 'https://example.com/one',
    selectors: [{ id: 't', type: 'SelectorText', selector: 'p' }],
    latestData: [{ t: 1 }],       // unknown top-level field -> ignored
    someFutureField: true
  });
  assert.ok(normalized._id, 'fallback id generated');
  assert.deepEqual(normalized.startUrl, ['https://example.com/one'], 'string startUrl coerced to array');
  assert.ok(!('latestData' in normalized) && !('someFutureField' in normalized));

  assert.equal(Sitemap.normalizeImported(null), null);
  assert.equal(Sitemap.normalizeImported([1, 2]), null);
  assert.equal(Sitemap.normalizeImported('text'), null);
});

// ---------------------------------------------------------------------------
// Dashboard integration
// ---------------------------------------------------------------------------

function bootDashboard(seededSitemap) {
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
  if (seededSitemap) db[`sitemap_${seededSitemap._id}`] = JSON.parse(JSON.stringify(seededSitemap));
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
  win.fetch = async () => ({ ok: false, status: 404, text: async () => '' });

  const scripts = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js', 'lib/datamode.js',
    'lib/sitemap_templates.js', 'lib/download_manager.js', 'lib/undo_stack.js',
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

const SITEMAP = {
  _id: 'undodemo', name: 'undodemo',
  startUrl: ['https://example.com'],
  selectors: [
    { id: 'item', type: 'SelectorElement', selector: '.item', parentSelectors: ['_root'], multiple: true },
    { id: 'title', type: 'SelectorText', selector: '.title', parentSelectors: ['item'] }
  ],
  options: { shadowDom: true }
};

function keyEvent(win, opts) {
  return new win.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, opts));
}

test('Dashboard - selector add, delete, Ctrl+Z, Ctrl+Y round trip', async () => {
  const { win, db } = bootDashboard(SITEMAP);
  const doc = win.document;
  await sleep(150);

  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr'))
    .find((tr) => tr.textContent.includes('undodemo'));
  row.querySelector('.action-scrape, .action-browse, a, button').click();
  await sleep(150);
  const rowsIn = () => db['sitemap_undodemo'].selectors.map((s) => s.id);

  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title']));

  // add a selector through the editor form
  doc.getElementById('btn-add-selector').click();
  await sleep(50);
  assert.ok(doc.getElementById('view-selector-edit').classList.contains('active'));
  doc.getElementById('field-selector-id').value = 'price';
  doc.getElementById('field-selector-css').value = '.price';
  const parentCb = Array.from(doc.querySelectorAll('#parent-selectors-list input[type="checkbox"]'))
    .find((c) => c.value === 'item');
  assert.ok(parentCb, 'parent checkbox rendered');
  parentCb.checked = true;
  doc.getElementById('form-selector-edit').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(200);
  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title', 'price']), 'selector added');

  // delete it (confirm mocked)
  win.confirm = () => true;
  const delBtn = Array.from(doc.querySelectorAll('#tbody-selectors .action-delete'))
    .find((b) => b.closest('tr').textContent.includes('price'));
  delBtn.click();
  await sleep(150);
  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title']), 'selector deleted');

  // Ctrl+Z restores the add
  doc.body.dispatchEvent(keyEvent(win, { key: 'z', ctrlKey: true }));
  await sleep(150);
  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title', 'price']), 'undo restored the deleted selector');

  // Ctrl+Z again -> back to the state before the add
  doc.body.dispatchEvent(keyEvent(win, { key: 'z', ctrlKey: true }));
  await sleep(150);
  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title']), 'second undo removes the added selector');

  // Ctrl+Y redoes the add
  doc.body.dispatchEvent(keyEvent(win, { key: 'y', ctrlKey: true }));
  await sleep(150);
  assert.equal(JSON.stringify(rowsIn()), JSON.stringify(['item', 'title', 'price']), 'redo re-applies the add');

  // storage persisted the redone state
  assert.equal(JSON.stringify(db['sitemap_undodemo'].selectors.map((s) => s.id)), JSON.stringify(['item', 'title', 'price']));
});

test('Dashboard - importing webscraper.io JSON creates a working sitemap', async () => {
  const { win, db } = bootDashboard();
  const doc = win.document;
  await sleep(150);

  doc.getElementById('nav-import-sitemap').click();
  await sleep(50);
  assert.ok(doc.getElementById('view-sitemap-import').classList.contains('active'));

  doc.getElementById('field-import-json').value = JSON.stringify(WEBSCRAPER_IO_JSON);
  doc.getElementById('form-sitemap-import').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(250);

  const saved = db['sitemap_ecommerce_products'];
  assert.ok(saved, 'imported sitemap stored');
  assert.equal(saved.selectors.length, 4, 'broken row filtered');
  assert.ok(saved.selectors.some((s) => s.id === 'price' && s.regex === '[\\d.]+'));
  assert.ok(!JSON.stringify(saved).includes('clickElementUniquenessType'), 'unknown fields not persisted');

  const sm = new Sitemap(saved);
  assert.ok(sm.validate().isValid);
});
