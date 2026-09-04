/**
 * Ö8 — sitemap template library tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SitemapTemplates = require('../chrome-edge/lib/sitemap_templates.js');
const i18n = require('../chrome-edge/lib/i18n.js');
const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

test('Templates - built-in library has the five documented templates', () => {
  const list = SitemapTemplates.listBuiltin();
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((t) => t.id), ['product-list', 'table', 'paginated-list', 'image-gallery', 'links-subpage']);
  // every nameKey/descKey must exist in BOTH locales
  for (const tpl of list) {
    for (const key of [tpl.nameKey, tpl.descKey]) {
      assert.ok(i18n.dict && i18n.dict.en && i18n.dict.en[key], `en has ${key}`);
      assert.ok(i18n.dict && i18n.dict.tr && i18n.dict.tr[key], `tr has ${key}`);
    }
  }
});

test('Templates - buildSitemap produces a valid selector skeleton', () => {
  const payload = SitemapTemplates.buildSitemap('product-list', 'shop', ['https://x.com/products']);
  assert.equal(payload.name, 'shop');
  assert.deepEqual(payload.startUrl, ['https://x.com/products']);
  assert.equal(payload.selectors.length, 5);

  const ids = payload.selectors.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'unique selector ids');
  for (const sel of payload.selectors) {
    assert.ok(sel.selector, `${sel.id} has a placeholder CSS selector`);
    assert.ok(sel.parentSelectors.length, `${sel.id} has a parent`);
    const valid = sel.parentSelectors.every((p) => p === '_root' || ids.includes(p));
    assert.ok(valid, `${sel.id} parents resolve`);
    assert.ok(sel.type.startsWith('Selector'), `${sel.id} type recognized`);
  }
  // product element is the parent of its fields
  assert.ok(payload.selectors.slice(1).every((s) => s.parentSelectors.includes('product')));
});

test('Templates - unknown template id yields null', () => {
  assert.equal(SitemapTemplates.buildSitemap('nope', 'x', ['https://x.com']), null);
  assert.equal(SitemapTemplates.getBuiltin('nope'), null);
});

test('Templates - paginated template chains the next link to itself', () => {
  const payload = SitemapTemplates.buildSitemap('paginated-list', 'p', ['https://x.com/list']);
  const next = payload.selectors.find((s) => s.id === 'next');
  assert.equal(next.type, 'SelectorLink');
  assert.deepEqual(next.parentSelectors, ['_root', 'next'], 'self-parented for pagination');
});

test('Templates - fromSitemap deep-copies selectors', () => {
  const sitemap = {
    name: 'original',
    startUrl: ['https://x.com'],
    options: { shadowDom: true },
    selectors: [
      { id: 'item', type: 'SelectorElement', selector: '.it', parentSelectors: ['_root'], multiple: true }
    ]
  };
  const tpl = SitemapTemplates.fromSitemap(sitemap, 'My Template');
  assert.equal(tpl.id, 'tpl-my-template');
  assert.equal(tpl.name, 'My Template');
  assert.equal(tpl.sitemap.selectors.length, 1);

  sitemap.selectors[0].selector = '.changed';
  sitemap.selectors.push({ id: 'extra', type: 'SelectorText', selector: 'x', parentSelectors: ['item'] });
  assert.equal(tpl.sitemap.selectors[0].selector, '.it', 'later edits do not leak into the template');
  assert.equal(tpl.sitemap.selectors.length, 1);
});

test('Templates - storage round trip saves, overwrites and lists user templates', async () => {
  const db = {};
  global.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (db[k] !== undefined) out[k] = db[k]; });
          if (cb) setTimeout(() => cb(out), 0);
          return Promise.resolve(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) setTimeout(() => cb(), 0); return Promise.resolve(); }
      }
    }
  };
  // The module exports a ready instance built at require time — the chrome
  // mock must therefore exist BEFORE the require runs.
  const AppStorage = require('../chrome-edge/src/storage/Storage.js');
  const store = AppStorage;

  assert.deepEqual(await store.loadSitemapTemplates(), [], 'starts empty');

  const a = SitemapTemplates.fromSitemap({ name: 'a', startUrl: ['https://a.com'], selectors: [] }, 'Alpha');
  const b = SitemapTemplates.fromSitemap({ name: 'b', startUrl: ['https://b.com'], selectors: [] }, 'Beta');
  await store.saveSitemapTemplate(a);
  await store.saveSitemapTemplate(b);
  let list = await store.loadSitemapTemplates();
  assert.equal(list.length, 2);

  // same name -> same id -> overwrite, not duplicate
  const a2 = SitemapTemplates.fromSitemap({ name: 'a2', startUrl: ['https://a2.com'], selectors: [] }, 'Alpha');
  await store.saveSitemapTemplate(a2);
  list = await store.loadSitemapTemplates();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((t) => t.sitemap.startUrl[0]).sort(), ['https://a2.com', 'https://b.com']);

  await store.deleteSitemapTemplate(a.id);
  list = await store.loadSitemapTemplates();
  assert.equal(list.length, 1);
  delete global.chrome;
});

// ---------------------------------------------------------------------------
// Dashboard integration
// ---------------------------------------------------------------------------

function bootDashboard() {
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
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/zip.js',
    'lib/undo_stack.js', 'lib/download_manager.js', 'lib/sitemap_templates.js',
    'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const sc = win.document.createElement('script');
    sc.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(sc);
  }
  return { win, db };
}

test('Dashboard - creating a sitemap from a built-in template fills the skeleton', async () => {
  const { win, db } = bootDashboard();
  const doc = win.document;
  await sleep(150);

  doc.getElementById('nav-create-sitemap').click();
  await sleep(30);
  assert.ok(doc.getElementById('view-sitemap-meta').classList.contains('active'), 'meta view opened');

  const tplSelect = doc.getElementById('field-sitemap-template');
  assert.ok(tplSelect, 'template select rendered');
  const optionValues = Array.from(tplSelect.options).map((o) => o.value);
  assert.deepEqual(optionValues, ['', 'product-list', 'table', 'paginated-list', 'image-gallery', 'links-subpage']);

  doc.getElementById('field-sitemap-id').value = 'templated_shop';
  doc.getElementById('field-sitemap-urls').value = 'https://example.com/shop';
  tplSelect.value = 'product-list';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(200);

  const saved = db['sitemap_templated_shop'];
  assert.ok(saved, 'sitemap saved to storage');
  assert.equal(saved.selectors.length, 5, 'skeleton selectors came from the template');
  assert.ok(saved.selectors.some((s) => s.id === 'product' && s.type === 'SelectorElement'));
});

test('Dashboard - save as template stores and lists the current sitemap', async () => {
  const { win, db } = bootDashboard();
  const doc = win.document;
  db['sitemap_gallerydemo'] = {
    _id: 'gallerydemo', name: 'gallerydemo',
    startUrl: ['https://example.com'],
    selectors: [
      { id: 'img', type: 'SelectorImage', selector: 'img', parentSelectors: ['_root'], multiple: true }
    ],
    options: { shadowDom: true }
  };
  await sleep(150);

  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr'))
    .find((tr) => tr.textContent.includes('gallerydemo'));
  assert.ok(row, 'seeded sitemap listed');
  row.querySelector('.action-browse, .action-scrape, a, button').click();
  await sleep(150);
  assert.ok(win.document.getElementById('dropdown-current-sitemap').style.display !== 'none', 'current sitemap menu visible');

  win.prompt = () => 'My Gallery';
  doc.getElementById('nav-sitemap-save-template').click();
  await sleep(200);

  const templates = db['sitemap_templates'];
  assert.ok(Array.isArray(templates) && templates.length === 1, 'template stored');
  assert.equal(templates[0].id, 'tpl-my-gallery');
  assert.equal(templates[0].sitemap.selectors.length, 1);

  const tplSelect = doc.getElementById('field-sitemap-template');
  const optionValues = Array.from(tplSelect.options).map((o) => o.value);
  assert.ok(optionValues.includes('tpl-my-gallery'), 'user template listed in the select');
  assert.equal(tplSelect.options[tplSelect.options.length - 1].textContent, 'My Gallery');
});
