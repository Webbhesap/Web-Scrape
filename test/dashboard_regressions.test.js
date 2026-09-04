/**
 * Regression tests for defects found while auditing the dashboard controller
 * and the translation layer.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const AppI18n = require('../chrome-edge/lib/i18n.js');

// AppI18n.apply() touches the DOM on every setLang(); give it one.
// A concrete origin is required for localStorage to be available.
const i18nDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/'
});
global.document = i18nDom.window.document;
global.localStorage = i18nDom.window.localStorage;

const dashboardJs = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.js'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');

const SCRIPTS = [
  'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
  'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
  'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
  'lib/i18n.js', 'lib/zip.js',
    'lib/undo_stack.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
];

function boot(store) {
  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const window = dom.window;
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;

  const db = store || {};
  window.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: {
      local: {
        get: (keys, cb) => {
          if (typeof keys === 'function') return keys({ ...db });
          if (keys == null) return cb({ ...db });
          if (typeof keys === 'string') return cb(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => {
            if (db[k] !== undefined) out[k] = db[k];
          });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) cb(); },
        remove: (keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]);
          if (cb) cb();
        }
      }
    }
  };
  window.alert = () => {};
  window.confirm = () => true;

  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  return { dom, window, db };
}

test('Sitemap metadata - editing start URLs stores the URLs, not a function', async () => {
  // Regression: the URL normalizer returned the translation helper `t`
  // instead of the URL text for already-absolute URLs, corrupting every
  // start URL that did not need an https:// prefix.
  const db = {
    sitemap_shop: {
      _id: 'shop',
      name: 'shop',
      startUrl: ['https://old.test/a'],
      selectors: []
    }
  };
  const { dom, window } = boot(db);
  await new Promise((r) => setTimeout(r, 60));

  const document = window.document;
  document.querySelector('#tbody-sitemaps .sitemap-open-link')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 40));

  document.getElementById('nav-sitemap-meta').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  document.getElementById('field-sitemap-urls').value =
    'https://shop.test/page/1\nexample.test/no-scheme\nhttp://plain.test/x';
  document.getElementById('btn-save-sitemap-meta')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 80));

  const saved = db.sitemap_shop;
  assert.ok(Array.isArray(saved.startUrl), 'startUrl is an array');
  saved.startUrl.forEach((u) => {
    assert.equal(typeof u, 'string', `each start URL must be a string, got ${typeof u}`);
    assert.match(u, /^https?:\/\//, `each start URL must be absolute: ${u}`);
  });
  // Copy out of the JSDOM realm before comparing (cross-realm Array
  // instances are not deepStrictEqual to native ones).
  assert.deepEqual(Array.from(saved.startUrl), [
    'https://shop.test/page/1',
    'https://example.test/no-scheme',
    'http://plain.test/x'
  ], 'absolute URLs are kept verbatim and bare hosts get https://');

  dom.window.close();
});

test('Scrape log messages go through the translation layer', () => {
  // These strings existed in the dictionary but the controller still emitted
  // hardcoded English.
  assert.match(dashboardJs, /logScrape\(t\('scrapeStarting'/, 'start message is translated');
  assert.match(dashboardJs, /logScrape\(t\('scrapeVisiting'/, 'visiting message is translated');
  assert.match(dashboardJs, /logScrape\(t\('scrapeError'/, 'error message is translated');
  assert.match(dashboardJs, /logScrape\(t\('scrapeFinished'/, 'finish message is translated');
  assert.ok(!/logScrape\('Starting scraper for sitemap/.test(dashboardJs), 'no hardcoded English start message');
  assert.ok(!/Scrape finished! Total records/.test(dashboardJs), 'no hardcoded English finish message');
  assert.ok(
    !/alert\(`Previewing selector/.test(dashboardJs),
    'the standalone preview hint uses the dictionary too'
  );
});

test('i18n - Turkish and English dictionaries cover the same keys', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'i18n.js'), 'utf8');
  const enBlock = src.slice(src.indexOf('en: {'), src.indexOf('tr: {'));
  const trBlock = src.slice(src.indexOf('tr: {'));

  const keysOf = (block) => {
    const set = new Set();
    const re = /^\s{6}([A-Za-z0-9_]+):/gm;
    let m;
    while ((m = re.exec(block))) set.add(m[1]);
    return set;
  };

  const en = keysOf(enBlock);
  const tr = keysOf(trBlock);
  assert.ok(en.size > 100, 'dictionary is populated');

  const missingTr = [...en].filter((k) => !tr.has(k));
  const missingEn = [...tr].filter((k) => !en.has(k));
  assert.deepEqual(missingTr, [], 'every English key has a Turkish translation');
  assert.deepEqual(missingEn, [], 'every Turkish key has an English fallback');
});

test('i18n - every data-i18n attribute in the markup resolves to a translation', () => {
  const attrs = new Set();
  const collect = (re) => {
    let m;
    while ((m = re.exec(dashboardHtml))) attrs.add(m[1]);
  };
  collect(/data-i18n="([^"]+)"/g);
  collect(/data-i18n-title="([^"]+)"/g);
  collect(/data-i18n-placeholder="([^"]+)"/g);

  assert.ok(attrs.size > 50, 'markup is broadly translated');

  // Compare against the declared dictionary keys: some legitimate English
  // translations are identical to their key (e.g. "to", "of", "entries"),
  // so a value/key comparison would report false positives.
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'i18n.js'), 'utf8');
  const enBlock = src.slice(src.indexOf('en: {'), src.indexOf('tr: {'));
  const trBlock = src.slice(src.indexOf('tr: {'));
  const keysOf = (block) => {
    const set = new Set();
    const re = /^\s{6}([A-Za-z0-9_]+):/gm;
    let m;
    while ((m = re.exec(block))) set.add(m[1]);
    return set;
  };
  const en = keysOf(enBlock);
  const tr = keysOf(trBlock);

  assert.deepEqual([...attrs].filter((k) => !en.has(k)), [], 'no untranslated data-i18n keys in English');
  assert.deepEqual([...attrs].filter((k) => !tr.has(k)), [], 'no untranslated data-i18n keys in Turkish');

  // And every key must actually produce a non-empty string in both languages.
  for (const lang of ['en', 'tr']) {
    AppI18n.setLang(lang);
    attrs.forEach((k) => {
      const val = AppI18n.t(k);
      assert.ok(typeof val === 'string' && val.length > 0, `${lang}: "${k}" resolves to text`);
    });
  }
  AppI18n.setLang('en');
});

test('i18n - interpolation fills placeholders in both languages', () => {
  AppI18n.setLang('tr');
  const tr = AppI18n.t('scrapeFinished', { records: 12, pages: 3, time: '4.2' });
  assert.ok(tr.includes('12') && tr.includes('3') && tr.includes('4.2'), 'Turkish placeholders filled');
  assert.ok(!/\{\w+\}/.test(tr), 'no leftover placeholders');

  AppI18n.setLang('en');
  const en = AppI18n.t('scrapeVisiting', { n: 5, url: 'https://x.test' });
  assert.ok(en.includes('5') && en.includes('https://x.test'), 'English placeholders filled');
  assert.ok(!/\{\w+\}/.test(en), 'no leftover placeholders');
});

test('Slideshow download - filenames derived from image URLs are safe', async () => {
  // Exercises imageFilenameFromUrl indirectly through the download button
  // for a variety of awkward URLs.
  const rows = [
    { img: 'https://cdn.test/a/photo%20one.JPG?v=2#frag' },
    { img: 'https://cdn.test/b/no-extension' },
    { img: 'https://cdn.test/c/../weird name!.png' }
  ];
  const db = {
    sitemap_g: { _id: 'g', name: 'g', startUrl: ['https://cdn.test/'], selectors: [] },
    data_g: { records: rows }
  };
  const { dom, window } = boot(db);
  await new Promise((r) => setTimeout(r, 60));

  const downloads = [];
  window.URL.createObjectURL = () => 'blob:x';
  window.URL.revokeObjectURL = () => {};
  window.fetch = async () => ({
    ok: true, status: 200,
    blob: async () => new window.Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    arrayBuffer: async () => new ArrayBuffer(4)
  });
  window.HTMLAnchorElement.prototype.click = function () {
    downloads.push(this.getAttribute('download'));
  };

  const document = window.document;
  document.querySelector('#tbody-sitemaps .sitemap-open-link')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 40));
  document.getElementById('nav-sitemap-gallery').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));

  const cards = document.querySelectorAll('#gallery-grid .gallery-card img');
  assert.equal(cards.length, 3, 'all three image URLs are recognised');

  for (let i = 0; i < 3; i++) {
    cards[i].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    document.getElementById('btn-slide-download').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    document.getElementById('btn-slideshow-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  }

  assert.equal(downloads.length, 3, 'each image produced one download');
  downloads.forEach((name) => {
    assert.ok(name, 'a filename is always provided');
    assert.ok(!/[\/\\:*?"<>|]/.test(name), `filename must be filesystem-safe: ${name}`);
    assert.match(name, /\.[a-z0-9]{2,5}$/i, `filename must keep an extension: ${name}`);
    assert.ok(!/\.zip$/i.test(name), 'never a ZIP');
  });
  assert.equal(downloads[0], 'photo_one.JPG'.replace('JPG', 'jpg'), 'spaces/encoding cleaned, extension normalised');
  assert.match(downloads[1], /\.jpg$/, 'extension-less URLs fall back to .jpg');

  dom.window.close();
});
