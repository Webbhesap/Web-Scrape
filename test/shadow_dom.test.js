/**
 * Ö2 — Shadow DOM piercing tests.
 * Engine-level piercing, the sitemap option round-trip, the dashboard
 * checkbox wiring, and the picker's scoped piercing query.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');
const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pageWithShadow() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div class="light">Light Text</div>
    <my-widget></my-widget>
  </body></html>`, { runScripts: 'dangerously', url: 'https://example.com/' });
  const doc = dom.window.document;
  const widget = doc.querySelector('my-widget');
  const root = widget.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <div class="card">
      <h3 class="title">Shadow Title</h3>
      <span class="price">9,99 €</span>
      <img class="thumb" src="/img/a.png">
      <inner-widget></inner-widget>
    </div>`;
  const inner = root.querySelector('inner-widget');
  const innerRoot = inner.attachShadow({ mode: 'open' });
  innerRoot.innerHTML = '<p class="deep">Nested Deep</p>';
  return { dom, doc, root, innerRoot };
}

test('Shadow DOM - engine finds elements inside (nested) shadow roots', () => {
  const { doc } = pageWithShadow();
  const engine = new SelectorEngine(); // shadowDom defaults to true
  engine.setBaseUrl('https://example.com/');

  assert.equal(engine.extractText(doc, { type: 'SelectorText', selector: '.title' }), 'Shadow Title');
  assert.equal(engine.extractText(doc, { type: 'SelectorText', selector: '.deep' }), 'Nested Deep');
  assert.equal(
    engine.extractElementAttribute(doc, { type: 'SelectorElementAttribute', selector: '.thumb', extractAttribute: 'src' }),
    '/img/a.png',
    'attribute extraction returns the raw attribute value'
  );
  assert.equal(
    engine.extractImage(doc, { type: 'SelectorImage', selector: '.thumb' }),
    'https://example.com/img/a.png',
    'image extraction resolves the URL against the page base'
  );
  const cards = engine.extractElement(doc, { type: 'SelectorElement', selector: '.card' });
  assert.equal(cards.length, 1);
});

test('Shadow DOM - light DOM results stay untouched', () => {
  const { doc } = pageWithShadow();
  const engine = new SelectorEngine();
  assert.equal(engine.extractText(doc, { type: 'SelectorText', selector: '.light' }), 'Light Text');
});

test('Shadow DOM - shadowDom:false restores legacy behaviour', () => {
  const { doc } = pageWithShadow();
  const legacy = new SelectorEngine({ shadowDom: false });
  assert.equal(legacy.extractText(doc, { type: 'SelectorText', selector: '.title' }), '');
  assert.equal(legacy.extractText(doc, { type: 'SelectorText', selector: '.light' }), 'Light Text');
});

test('Shadow DOM - invalid selectors still degrade to empty, not crashes', () => {
  const { doc } = pageWithShadow();
  const engine = new SelectorEngine();
  assert.deepEqual(engine.queryAll(doc, '///bad-selector///'), []);
  assert.equal(engine.queryFirst(doc, '///bad-selector///'), null);
});

test('Shadow DOM - sitemap option round-trip + engine inheritance', async () => {
  const on = new Sitemap({ _id: 'on', name: 'on', startUrl: ['https://example.com/'], selectors: [] });
  assert.equal(on.options.shadowDom, true, 'default on');
  assert.equal(on.toJSON().options.shadowDom, true, 'serialized');

  const off = new Sitemap({ _id: 'off', name: 'off', startUrl: ['https://example.com/'], selectors: [], options: { shadowDom: false } });
  assert.equal(off.options.shadowDom, false);
  assert.equal(off.toJSON().options.shadowDom, false);

  const engine = new ScraperEngine(off, { fetcher: async () => ({ document: null, url: 'x' }) });
  assert.equal(engine.selectorEngine.shadowDom, false, 'ScraperEngine propagates the option');
});

test('Shadow DOM - full crawl extracts from shadow roots through ScraperEngine', async () => {
  const { doc } = pageWithShadow();
  const sm = new Sitemap({
    _id: 'shadow crawl', name: 'shadow crawl',
    startUrl: ['https://example.com/'],
    selectors: [
      { id: 'title', type: 'SelectorText', selector: '.title', parentSelectors: ['_root'] }
    ]
  });
  const engine = new ScraperEngine(sm, {
    requestInterval: 0,
    pageLoadDelay: 0,
    fetcher: async () => ({ document: doc, url: 'https://example.com/' })
  });
  const finished = new Promise((res) => engine.on('finish', res));
  await engine.start();
  const summary = await finished;
  assert.equal(summary.totalRecords, 1);
  assert.equal(summary.results[0].title, 'Shadow Title');
});

test('Shadow DOM - picker ELEMENT_PREVIEW counts matches inside shadow roots', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', {
    runScripts: 'dangerously',
    url: 'https://example.com/list',
    pretendToBeVisual: true
  });
  const win = dom.window;
  win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;

  const pickerMessages = [];
  win.chrome = {
    runtime: {
      getURL: (p) => p,
      sendMessage: (m) => { pickerMessages.push(m); },
      onMessage: {
        addListener: (L) => {
          win.__pickerListener = L;
        }
      }
    }
  };

  const code = fs.readFileSync(path.join(ROOT, 'content', 'selector_picker.js'), 'utf8');
  const el = win.document.createElement('script');
  el.textContent = code;
  win.document.body.appendChild(el);

  // Build shadow content
  const host = win.document.getElementById('host');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<li class="item">1</li><li class="item">2</li>';

  // Simulate the dashboard asking for an element preview.
  let response = null;
  const result = win.__pickerListener({ type: 'ELEMENT_PREVIEW', selector: '.item' }, {}, (r) => { response = r; });
  await Promise.resolve(result || Promise.resolve());
  await sleep(30);
  assert.ok(response, 'listener responded');
  assert.equal(response.count, 2, 'both shadow items counted');
  win.__WebScraperPicker.stop();
});

test('Shadow DOM - dashboard checkbox persists the option', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const page = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = page.window;
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;
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
  const scripts = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js',
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
  await sleep(80);

  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  assert.equal(doc.getElementById('field-sitemap-shadow').checked, true, 'defaults to on');
  doc.getElementById('field-sitemap-shadow').checked = false;
  doc.getElementById('field-sitemap-id').value = 'shadow sim';
  doc.getElementById('field-sitemap-urls').value = 'https://example.com/';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(80);

  const stored = await win.AppStorage.getSitemap('shadow_sim');
  assert.ok(stored, 'sitemap stored');
  assert.equal(stored.options.shadowDom, false, 'option persisted off');

  // Re-open the metadata editor — checkbox must reflect the stored value.
  doc.getElementById('nav-sitemap-meta').click();
  await sleep(30);
  assert.equal(doc.getElementById('field-sitemap-shadow').checked, false, 'checkbox reloads from storage');
});
