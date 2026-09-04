/**
 * Regression tests for the code-review fix round:
 *
 * 1. Script-load order in the real HTML (dashboard.html / devtools panel):
 *    lib/transforms.js MUST load before src/engine/SelectorEngine.js — the
 *    engine factory captures the global TextTransforms at script-eval time,
 *    so a late load freezes `undefined` into postProcess() and every
 *    transform/defaultValue extraction throws in the browser (jsdom boots
 *    used to inject their own script list and could not catch this).
 * 2. i18n dictionaries must not declare the same key twice (the last one
 *    silently wins) and every data-i18n key in the markup must resolve.
 * 3. Sitemap.renameSelector keeps the selector hierarchy intact and refuses
 *    id collisions instead of silently overwriting a sibling selector.
 * 4. ScraperEngine: link/table child records inherit ALL sibling fields of
 *    their container regardless of the order the selectors are defined in.
 * 5. SelectorEngine.getElementVisibleText: clone fast-path parity.
 * 6. Gallery ZIP: failed image fetches are skipped (no 404 error pages
 *    packed as "corrupt images").
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function scriptSrcs(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)).map((m) => m[1]);
}

function indexOfSuffix(list, suffix) {
  return list.findIndex((src) => src.endsWith(suffix));
}

// ---------------------------------------------------------------------------
// 1. Script load order in the actual pages
// ---------------------------------------------------------------------------

test('dashboard.html loads lib/transforms.js BEFORE src/engine/SelectorEngine.js', () => {
  const scripts = scriptSrcs(read('dashboard/dashboard.html'));
  const transforms = indexOfSuffix(scripts, 'lib/transforms.js');
  const engine = indexOfSuffix(scripts, 'src/engine/SelectorEngine.js');
  assert.ok(transforms >= 0, 'transforms.js is referenced');
  assert.ok(engine >= 0, 'SelectorEngine.js is referenced');
  assert.ok(transforms < engine, 'transforms.js must load before SelectorEngine.js (factory captures the global)');
});

test('dashboard.html script order is dependency-safe overall', () => {
  const scripts = scriptSrcs(read('dashboard/dashboard.html'));
  const pos = (suffix) => indexOfSuffix(scripts, suffix);
  assert.ok(pos('lib/csv.js') < pos('src/export/Exporter.js'), 'CSV before Exporter');
  assert.ok(pos('lib/xlsx.js') < pos('src/export/Exporter.js'), 'XLSX before Exporter');
  assert.ok(pos('src/engine/UrlRangeExpander.js') < pos('src/models/Sitemap.js'), 'expander before Sitemap');
  assert.ok(pos('src/models/Selector.js') < pos('src/models/Sitemap.js'), 'Selector before Sitemap');
  assert.ok(pos('src/engine/SelectorEngine.js') < pos('src/engine/ScraperEngine.js'), 'SelectorEngine before ScraperEngine');
  assert.ok(pos('src/engine/DataFlattener.js') < pos('src/engine/ScraperEngine.js'), 'DataFlattener before ScraperEngine');
  const dashApp = scripts.length - 1; // dashboard.js is the last (same-dir) script tag
  assert.ok(scripts[dashApp] === 'dashboard.js', 'dashboard.js is loaded last');
  assert.ok(pos('lib/i18n.js') < dashApp, 'i18n before dashboard app');
  assert.ok(pos('lib/transforms.js') < dashApp, 'transforms before dashboard app');
  assert.equal(scripts.filter((s) => s.endsWith('lib/transforms.js')).length, 1, 'transforms.js referenced exactly once');
});

test('devtools/panel.html mirrors the dashboard script order', () => {
  const scripts = scriptSrcs(read('devtools/panel.html'));
  const transforms = indexOfSuffix(scripts, 'lib/transforms.js');
  const engine = indexOfSuffix(scripts, 'src/engine/SelectorEngine.js');
  assert.ok(transforms >= 0 && transforms < engine, 'panel loads transforms before the engine');
});

test('Browser-context smoke: extracting with transforms/defaultValue works when scripts load in HTML order', async () => {
  // Load the EXACT script order of dashboard.html into a fresh jsdom window.
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="src">  abc  </div></body></html>',
    { runScripts: 'outside-only', url: 'https://x.test/' }
  );
  const win = dom.window;
  win.TextEncoder = TextEncoder;
  if (typeof win.CSS === 'undefined') {
    win.CSS = { escape: (str) => String(str).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  }
  const scripts = scriptSrcs(read('dashboard/dashboard.html'));
  for (const src of scripts) {
    const rel = src.replace(/^(\.\.\/)+/, '');
    if (rel === 'dashboard.js') continue; // the app controller needs DOM ids we don't replicate here
    win.eval(read(rel));
  }

  const engine = new win.SelectorEngine({ baseUrl: 'https://x.test/' });
  const doc = win.document;

  const upper = new win.Selector({
    id: 'up', type: 'SelectorText', selector: '#src',
    transforms: [{ type: 'uppercase' }], parentSelectors: ['_root']
  });
  assert.equal(engine.extract(doc, upper), 'ABC');

  const missing = new win.Selector({
    id: 'gone', type: 'SelectorText', selector: '#nope',
    defaultValue: 'N/A', parentSelectors: ['_root']
  });
  assert.equal(engine.extract(doc, missing), 'N/A');
});

// ---------------------------------------------------------------------------
// 2. i18n dictionaries
// ---------------------------------------------------------------------------

function duplicateKeysBySection(source) {
  const dicts = { en: new Map(), tr: new Map() };
  let cur = null;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s{4}en: \{/.test(line)) { cur = 'en'; continue; }
    if (/^\s{4}tr: \{/.test(line)) { cur = 'tr'; continue; }
    const m = line.match(/^\s{6}([A-Za-z0-9_]+):/);
    if (m && cur) {
      if (!dicts[cur].has(m[1])) dicts[cur].set(m[1], []);
      dicts[cur].get(m[1]).push(i + 1);
    }
  }
  const dupes = {};
  for (const [lang, map] of Object.entries(dicts)) {
    dupes[lang] = Array.from(map.entries()).filter(([, lines]) => lines.length > 1).map(([k]) => k);
  }
  return dupes;
}

test('i18n dictionaries declare no duplicate keys (last-one-wins shadowing bug)', () => {
  const dupes = duplicateKeysBySection(read('lib/i18n.js'));
  assert.deepEqual(dupes.en, [], 'no duplicated keys in the English dictionary');
  assert.deepEqual(dupes.tr, [], 'no duplicated keys in the Turkish dictionary');
});

test('every data-i18n key used in dashboard/popup markup resolves in BOTH languages', () => {
  const AppI18n = require('../chrome-edge/lib/i18n.js');
  const htmlFiles = ['dashboard/dashboard.html', 'popup/popup.html', 'devtools/panel.html'];
  for (const rel of htmlFiles) {
    const html = read(rel);
    const keys = new Set();
    for (const m of html.matchAll(/data-i18n(?:-title|-placeholder)?="([A-Za-z0-9_]+)"/g)) keys.add(m[1]);
    for (const key of keys) {
      assert.ok(Object.prototype.hasOwnProperty.call(AppI18n.dict.en, key), `${rel}: "${key}" missing in EN`);
      assert.ok(Object.prototype.hasOwnProperty.call(AppI18n.dict.tr, key), `${rel}: "${key}" missing in TR`);
    }
  }
});

test('i18n - the image selector checkbox and the gallery download button have distinct keys', () => {
  const AppI18n = require('../chrome-edge/lib/i18n.js');
  // Regression: both used `downloadImages` and the gallery button won.
  assert.equal(AppI18n.dict.en.downloadImages, 'Download image files locally');
  assert.equal(AppI18n.dict.en.downloadImagesAll, 'Download images');
  assert.notEqual(AppI18n.dict.en.downloadImages, AppI18n.dict.en.downloadImagesAll);
});

// ---------------------------------------------------------------------------
// 3. Sitemap.renameSelector
// ---------------------------------------------------------------------------

const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const { Selector } = require('../chrome-edge/src/models/Selector.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');

test('Sitemap.renameSelector re-points children and refuses collisions', () => {
  const sm = new Sitemap({
    _id: 'ren', name: 'ren', startUrl: ['https://shop.test/list'],
    selectors: [
      { id: 'cat', type: 'SelectorLink', selector: 'a.cat', multiple: true, parentSelectors: ['_root'] },
      { id: 'item', type: 'SelectorElement', selector: '.item', multiple: true, parentSelectors: ['cat'] },
      { id: 'title', type: 'SelectorText', selector: '.t', parentSelectors: ['item'] },
      { id: 'other', type: 'SelectorText', selector: '.o', parentSelectors: ['_root'] }
    ]
  });

  assert.equal(sm.renameSelector('cat', 'category'), true);
  assert.deepEqual(sm.getSelectorById('item').parentSelectors, ['category'], 'children follow the rename');
  assert.deepEqual(sm.getSelectorById('category').parentSelectors, ['_root']);
  assert.equal(sm.getSelectorById('cat'), null);

  // Renaming onto an existing id must fail instead of destroying that selector.
  assert.equal(sm.renameSelector('category', 'other'), false);
  assert.ok(sm.getSelectorById('other'), 'collision target stays intact');
  assert.ok(sm.getSelectorById('category'), 'source stays after refused rename');

  assert.equal(sm.renameSelector('ghost', 'x'), false, 'unknown id -> false');
  assert.equal(sm.renameSelector('other', 'other'), true, 'no-op rename succeeds');
});

test('Sitemap import keeps click-element uniqueness settings (normalizeImported)', () => {
  const normalized = Sitemap.normalizeImported({
    _id: 'imp', name: 'imp',
    startUrl: ['https://x.test/'],
    selectors: [
      {
        id: 'more', type: 'SelectorElementClick', selector: '.item',
        clickElementSelector: 'button.load', clickElementUniquenessType: 'uniqueText',
        parentSelectors: ['_root']
      }
    ]
  });
  assert.equal(normalized.selectors[0].clickElementUniquenessType, 'uniqueText');
});

// ---------------------------------------------------------------------------
// 4. Order-independent parent data inheritance
// ---------------------------------------------------------------------------

function makeFetcher(pages) {
  return async (url) => {
    const html = pages[url];
    if (!html) throw new Error('404 ' + url);
    const dom = new JSDOM(html, { url });
    return { document: dom.window.document, url };
  };
}

test('link child pages inherit sibling fields declared AFTER the link selector', async () => {
  const sm = new Sitemap({
    _id: 'order', name: 'order', startUrl: ['https://shop.test/list'],
    selectors: [
      { id: 'item', type: 'SelectorElement', selector: 'li', multiple: true, parentSelectors: ['_root'] },
      // Link FIRST on purpose — the old engine enqueued child pages with a
      // half-filled record, so `title` (defined later) never reached them.
      { id: 'detail', type: 'SelectorLink', selector: 'a', parentSelectors: ['item'] },
      { id: 'title', type: 'SelectorText', selector: '.t', parentSelectors: ['item'] },
      { id: 'body', type: 'SelectorText', selector: '.body', parentSelectors: ['detail'] }
    ]
  });

  const engine = new ScraperEngine(sm, {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0,
    fetcher: makeFetcher({
      'https://shop.test/list': '<ul><li><a href="https://shop.test/d1">D1</a><em class="t">Title 1</em></li></ul>',
      'https://shop.test/d1': '<div class="body">Detail body one</div>'
    })
  });
  await engine.start();

  const rows = engine.results;
  assert.equal(rows.length, 1, 'one detail row');
  assert.equal(rows[0].title, 'Title 1', 'container siblings are inherited regardless of definition order');
  assert.equal(rows[0].body, 'Detail body one');
  assert.equal(rows[0].detail, 'D1');
  assert.equal(rows[0]['detail-href'], 'https://shop.test/d1');
});

test('container child tables inherit fields declared after the table selector', async () => {
  const sm = new Sitemap({
    _id: 'torder', name: 'torder', startUrl: ['https://shop.test/list'],
    selectors: [
      { id: 'item', type: 'SelectorElement', selector: 'li', multiple: true, parentSelectors: ['_root'] },
      {
        id: 'specs', type: 'SelectorTable', selector: 'table',
        tableHeaderRowSelector: 'thead tr', tableDataRowSelector: 'tbody tr',
        parentSelectors: ['item']
      },
      { id: 'title', type: 'SelectorText', selector: '.t', parentSelectors: ['item'] }
    ]
  });

  const engine = new ScraperEngine(sm, {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0,
    fetcher: makeFetcher({
      'https://shop.test/list': `
        <ul>
          <li>
            <em class="t">Prod A</em>
            <table><thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody><tr><td>Weight</td><td>1kg</td></tr></tbody></table>
          </li>
        </ul>`
    })
  });
  await engine.start();

  assert.equal(engine.results.length, 1);
  assert.equal(engine.results[0].title, 'Prod A', 'table rows carry the full sibling record');
  // SelectorTable maps data cells through the captured header row: Key/Value.
  assert.equal(engine.results[0].Key, 'Weight');
  assert.equal(engine.results[0].Value, '1kg');
});

// ---------------------------------------------------------------------------
// 4b. SelectorLink linkFromScript was a no-op option (fell back to href)
// ---------------------------------------------------------------------------

test('linkFromScript resolves URLs from onclick window.open handlers', () => {
  const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
  const dom = new JSDOM(`
    <a id="s1" onclick="window.open('/product/42?src=btn','_blank')">open</a>
    <a id="s2" href="/normal">plain</a>
    <a id="s3" data-url="/data-url-target">dupe</a>
  `);
  const doc = dom.window.document;
  const engine = new SelectorEngine({ baseUrl: 'https://shop.test/list' });

  const scripted = engine.extract(doc, new Selector({
    id: 'l', type: 'SelectorLink', selector: '#s1', linkType: 'linkFromScript', parentSelectors: ['_root']
  }));
  assert.equal(scripted.href, 'https://shop.test/product/42?src=btn');
  assert.equal(scripted.text, 'open');

  // Falls back to href when the element has no script handler.
  const plain = engine.extract(doc, new Selector({
    id: 'l2', type: 'SelectorLink', selector: '#s2', linkType: 'linkFromScript', parentSelectors: ['_root']
  }));
  assert.equal(plain.href, 'https://shop.test/normal');
});

// ---------------------------------------------------------------------------
// 5. getElementVisibleText fast-path parity
// ---------------------------------------------------------------------------

test('SelectorEngine text extraction: fast path and clone path return the same text', () => {
  const dom = new JSDOM(`
    <div id="plain"> hello <b>world</b> </div>
    <div id="rich"> hello <br>world <script>var evil=1;</script><style>.x{}</style></div>
  `);
  const doc = dom.window.document;
  const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
  const engine = new SelectorEngine({ baseUrl: 'https://x.test/' });

  const plain = engine.extract(doc, new Selector({ id: 'p', type: 'SelectorText', selector: '#plain', parentSelectors: ['_root'] }));
  const rich = engine.extract(doc, new Selector({ id: 'r', type: 'SelectorText', selector: '#rich', parentSelectors: ['_root'] }));

  assert.equal(plain, 'hello world');
  // <br> becomes a newline, script/style contents are stripped, no leftovers.
  assert.equal(rich, 'hello\nworld');
  assert.ok(!rich.includes('evil') && !rich.includes('.x'), 'script/style never leak into extracted text');
});

// ---------------------------------------------------------------------------
// 6. Gallery ZIP skips failed downloads
// ---------------------------------------------------------------------------

test('gallery ZIP skips images whose fetch fails instead of packing error pages', async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = read('dashboard/dashboard.html');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = dom.window;
  win.TextEncoder = TextEncoder;
  if (typeof win.CSS === 'undefined') {
    win.CSS = { escape: (str) => String(str).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  }

  const alerts = [];
  win.alert = (msg) => alerts.push(String(msg));
  win.URL.createObjectURL = () => 'blob:stub';
  win.URL.revokeObjectURL = () => {};

  const db = {
    sitemap_ziper: {
      _id: 'ziper', name: 'ziper', startUrl: ['https://img.test/'], selectors: []
    },
    data_ziper: {
      sitemapId: 'ziper',
      records: [
        { image: 'https://img.test/a.jpg' },
        { image: 'https://img.test/missing.jpg' }
      ]
    }
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
  // One image resolves, the other returns an HTTP error page.
  win.fetch = async (url) => {
    if (String(url).includes('missing')) {
      return { ok: false, status: 404, arrayBuffer: async () => new TextEncoder().encode('<html>404</html>').buffer };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };

  const scripts = scriptSrcs(html);
  for (const src of scripts) {
    const rel = src.startsWith('../') ? src.replace(/^(\.\.\/)+/, '') : path.posix.join('dashboard', src);
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(el);
  }
  await sleep(150);

  // Patch SimpleZip.build AFTER dashboard.js loaded (script order above).
  win.eval(`window.__wsCapturedZipFiles = null;
    const origBuild = SimpleZip.build;
    SimpleZip.build = async (files) => { window.__wsCapturedZipFiles = files.map(f => f.name); return new Uint8Array([80,75,3,4]); };`);

  // Open the sitemap, jump to the gallery, click "Download ZIP".
  const row = Array.from(win.document.querySelectorAll('#tbody-sitemaps tr')).find((tr) => tr.textContent.includes('ziper'));
  assert.ok(row, 'seeded sitemap listed');
  row.querySelector('.sitemap-open-link').click();
  await sleep(60);
  win.document.getElementById('nav-sitemap-gallery').click();
  await sleep(60);
  win.document.getElementById('btn-gallery-zip-all').click();
  await sleep(300);

  const files = win.eval('window.__wsCapturedZipFiles');
  assert.ok(files, 'SimpleZip.build was invoked');
  // JSON round-trip: cross-realm arrays must not be compared by prototype.
  assert.equal(JSON.stringify(files), JSON.stringify(['img-001.jpg']), 'only the successfully fetched image is packed');
  assert.ok(alerts.some((a) => /1/.test(a) && /2/.test(a)), 'user is warned about the failed file');
  win.close();
});
