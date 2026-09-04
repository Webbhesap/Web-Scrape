/**
 * Ö1 — Text transforms + default value tests.
 * Unit tests for lib/transforms.js, engine integration through
 * SelectorEngine, model persistence through Selector, and the dashboard
 * form round-trip.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const TextTransforms = require('../chrome-edge/lib/transforms.js');
const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
const { Selector } = require('../chrome-edge/src/models/Selector.js');
const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

// ---------------------------------------------------------------------------
// Unit: transforms module
// ---------------------------------------------------------------------------

test('Transforms - trim / case transforms', () => {
  assert.equal(TextTransforms.applyTransforms('  Hello World  ', [{ type: 'trim' }]), 'Hello World');
  assert.equal(TextTransforms.applyTransforms('Hello', [{ type: 'lowercase' }]), 'hello');
  assert.equal(TextTransforms.applyTransforms('Hello', [{ type: 'uppercase' }]), 'HELLO');
  assert.equal(
    TextTransforms.applyTransforms('istanbul webscraper', [{ type: 'capitalize' }]),
    'Istanbul Webscraper'
  );
});

test('Transforms - chain order is respected', () => {
  const out = TextTransforms.applyTransforms('  Product XYZ  ', [
    { type: 'trim' },
    { type: 'lowercase' },
    { type: 'capitalize' }
  ]);
  assert.equal(out, 'Product Xyz');
});

test('Transforms - localized number parsing', () => {
  assert.equal(TextTransforms.applyTransforms('1.234,56', [{ type: 'number' }]), 1234.56);
  assert.equal(TextTransforms.applyTransforms('$1,234.56', [{ type: 'number' }]), 1234.56);
  assert.equal(TextTransforms.applyTransforms('1.234,56 TL', [{ type: 'number' }]), 1234.56);
  assert.equal(TextTransforms.applyTransforms('45,90 €', [{ type: 'number' }]), 45.9);
  assert.equal(TextTransforms.applyTransforms('-12', [{ type: 'number' }]), -12);
  assert.equal(TextTransforms.applyTransforms('1 000 000', [{ type: 'number' }]), 1000000);
  // Not a number at all: value must survive untouched
  assert.equal(TextTransforms.applyTransforms('free shipping', [{ type: 'number' }]), 'free shipping');
});

test('Transforms - regexReplace with capture groups', () => {
  assert.equal(
    TextTransforms.applyTransforms('Price: 12.99 USD', [
      { type: 'regexReplace', find: 'Price:\\s*([\\d.]+)\\s*USD', replace: '$1 dollars' }
    ]),
    '12.99 dollars'
  );
  // Invalid user regex must not throw or eat the value
  assert.equal(
    TextTransforms.applyTransforms('keep me', [{ type: 'regexReplace', find: '([bad', replace: 'x' }]),
    'keep me'
  );
});

test('Transforms - default value fills only empties', () => {
  assert.equal(TextTransforms.postProcess('', { defaultValue: 'N/A' }), 'N/A');
  assert.equal(TextTransforms.postProcess(undefined, { defaultValue: 'N/A' }), 'N/A');
  assert.equal(TextTransforms.postProcess(null, { defaultValue: 'N/A' }), 'N/A');
  assert.equal(TextTransforms.postProcess('real', { defaultValue: 'N/A' }), 'real');
  assert.equal(TextTransforms.postProcess(0, { defaultValue: 'N/A' }), 0);
  // Full pipeline: trim then default
  assert.equal(TextTransforms.postProcess('   ', { transforms: [{ type: 'trim' }], defaultValue: '—' }), '—');
});

test('Transforms - normalizeTransforms drops invalid entries', () => {
  const out = TextTransforms.normalizeTransforms([
    { type: 'trim' },
    { type: 'nope' },
    { type: 'regexReplace' },
    { type: 'regexReplace', find: 'a', replace: 'b' },
    null
  ]);
  assert.deepEqual(out, [{ type: 'trim' }, { type: 'regexReplace', find: 'a', replace: 'b', flags: 'g' }]);
});

// ---------------------------------------------------------------------------
// Engine integration
// ---------------------------------------------------------------------------

function dom() {
  return new JSDOM(`<div id="app">
    <span class="price"> 1.234,56 TL </span>
    <span class="empty"></span>
    <span class="name">ahmet yilmaz</span>
    <a class="link" href="/p/1">Product One</a>
  </div>`);
}

test('SelectorEngine - text selector applies transforms + default value', () => {
  const engine = new SelectorEngine();
  const doc = dom().window.document;

  const price = engine.extractText(doc, {
    type: 'SelectorText', selector: '.price', multiple: false,
    transforms: [{ type: 'trim' }, { type: 'number' }]
  });
  assert.equal(price, 1234.56);

  const empty = engine.extractText(doc, {
    type: 'SelectorText', selector: '.empty', multiple: false,
    defaultValue: 'no data'
  });
  assert.equal(empty, 'no data');

  const name = engine.extractText(doc, {
    type: 'SelectorText', selector: '.name', multiple: false,
    transforms: [{ type: 'capitalize' }]
  });
  assert.equal(name, 'Ahmet Yilmaz');
});

test('SelectorEngine - multiple text extraction transforms every item', () => {
  const engine = new SelectorEngine();
  const d = new JSDOM('<i>a</i><i>b</i>').window.document;
  const out = engine.extractText(d, {
    type: 'SelectorText', selector: 'i', multiple: true,
    transforms: [{ type: 'uppercase' }]
  });
  assert.deepEqual(out, ['A', 'B']);
});

test('SelectorEngine - link selector transforms the text, keeps the URL intact', () => {
  const engine = new SelectorEngine();
  engine.setBaseUrl('https://example.com/');
  const doc = dom().window.document;
  const out = engine.extractLink(doc, {
    type: 'SelectorLink', selector: '.link', multiple: false,
    transforms: [{ type: 'uppercase' }]
  });
  assert.equal(out.href, 'https://example.com/p/1');
  assert.equal(out.text, 'PRODUCT ONE');
});

test('SelectorEngine - attribute selector with regexReplace and default', () => {
  const engine = new SelectorEngine();
  const d = new JSDOM('<div data-id="user_42"></div><div class="none"></div>').window.document;
  const out = engine.extractElementAttribute(d, {
    type: 'SelectorElementAttribute', selector: '[data-id]', extractAttribute: 'data-id',
    transforms: [{ type: 'regexReplace', find: 'user_', replace: '' }, { type: 'number' }]
  });
  assert.equal(out, 42);

  const missing = engine.extractElementAttribute(d, {
    type: 'SelectorElementAttribute', selector: '.nothing', extractAttribute: 'data-id',
    defaultValue: '?'
  });
  assert.equal(missing, '?');
});

test('Selector model - persists transforms and defaultValue through toJSON', () => {
  const sel = new Selector({
    id: 'price', type: 'SelectorText', selector: '.price',
    transforms: [{ type: 'trim' }, { type: 'number' }, { type: 'bogus' }],
    defaultValue: '0'
  });
  assert.deepEqual(sel.transforms, [{ type: 'trim' }, { type: 'number' }]);
  assert.equal(sel.defaultValue, '0');
  const json = sel.toJSON();
  assert.deepEqual(json.transforms, [{ type: 'trim' }, { type: 'number' }]);
  assert.equal(json.defaultValue, '0');
  // Round-trip
  const clone = new Selector(json);
  assert.deepEqual(clone.transforms, sel.transforms);
  // Empty transforms/default must not pollute the JSON
  const plain = new Selector({ id: 'x', type: 'SelectorText', selector: 'a' });
  assert.equal(plain.toJSON().transforms, undefined);
  assert.equal(plain.toJSON().defaultValue, undefined);
});

// ---------------------------------------------------------------------------
// Dashboard form round-trip
// ---------------------------------------------------------------------------

test('Dashboard - transforms editor round-trip', async () => {
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
          const compute = async () => {
            if (keys == null) return { ...db };
            if (typeof keys === 'string') return db[keys] !== undefined ? { [keys]: db[keys] } : {};
            const out = {};
            (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => { if (db[k] !== undefined) out[k] = db[k]; });
            return out;
          };
          const p = compute();
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
    'lib/i18n.js', 'lib/zip.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(el);
  }
  await new Promise((r) => setTimeout(r, 80));

  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await new Promise((r) => setTimeout(r, 30));
  doc.getElementById('field-sitemap-id').value = 'transforms sim';
  doc.getElementById('field-sitemap-urls').value = 'https://example.com/';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 80));

  doc.getElementById('btn-add-selector').click();
  await new Promise((r) => setTimeout(r, 30));

  // Add two transforms + default value through the editor
  doc.getElementById('field-selector-id').value = 'price';
  doc.getElementById('field-selector-css').value = '.price';
  doc.getElementById('field-transform-type').value = 'trim';
  doc.getElementById('btn-add-transform').click();
  doc.getElementById('field-transform-type').value = 'number';
  doc.getElementById('btn-add-transform').click();
  doc.getElementById('field-selector-default').value = 'N/A';
  await new Promise((r) => setTimeout(r, 20));

  const rowsBefore = doc.querySelectorAll('#transforms-list > div');
  assert.equal(rowsBefore.length, 2, 'two transform rows rendered');

  doc.getElementById('form-selector-edit').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 80));

  // Re-open the selector and verify persistence in the form
  const editBtn = doc.querySelector('#tbody-selectors .action-edit');
  assert.ok(editBtn, 'saved selector appears in the list');
  editBtn.click();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(doc.querySelectorAll('#transforms-list > div').length, 2, 'transforms reload');
  assert.equal(doc.getElementById('field-selector-default').value, 'N/A', 'default value reloads');

  const Sitemap = win.Sitemap;
  assert.equal(typeof Sitemap, 'function', 'Sitemap constructor available');
  const sm = new Sitemap({ _id: 'transforms sim', name: 'transforms sim', startUrl: ['https://example.com/'], selectors: [] });
  assert.equal(sm._id, 'transforms_sim', 'sitemap instance constructs and slugifies');
  const stored = await win.AppStorage.getSitemap('transforms_sim');
  assert.ok(stored, 'sitemap stored');
  const saved = (stored.selectors || []).find((x) => x.id === 'price');
  assert.ok(saved, 'selector persisted');
  assert.equal(JSON.stringify(saved.transforms), JSON.stringify([{ type: 'trim' }, { type: 'number' }]));
  assert.equal(saved.defaultValue, 'N/A');
});
