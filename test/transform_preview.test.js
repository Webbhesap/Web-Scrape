/**
 * P2.2 — "örnek veriyle dönüşüm önizleme" (Plan.md roadmap item 6):
 * the selector edit screen now has a live preview that applies the
 * pipeline being edited (regex extraction → transforms in order →
 * default for empties) to a sample value, using the same primitives the
 * engine uses — so what the preview shows is exactly what a crawl would
 * store, without running one.
 *
 * Drives the real selector-edit form in jsdom: type a sample, add a
 * regex, add a transform, change the default — the preview element must
 * update live and faithfully (capture-group extraction, number parsing,
 * invalid-regex error, default-for-empty).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

function fireInput(win, el) {
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

async function createSitemap(win, id) {
  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = id;
  doc.getElementById('field-sitemap-urls').value = 'https://tf.test/page';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
}

test('P2.2 - live transform preview applies regex, transforms and default to a sample', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await createSitemap(win, 'tf_prev');

  // Open the add-selector form (current sitemap's root is the parent).
  doc.getElementById('btn-add-selector').click();
  await sleep(30);
  doc.getElementById('field-selector-id').value = 'price';
  const typeSel = doc.getElementById('field-selector-type');
  typeSel.value = 'SelectorText';
  typeSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(20);
  doc.getElementById('field-selector-css').value = '.price';

  const preview = doc.getElementById('tf-preview-result');
  const sampleEl = doc.getElementById('tf-preview-sample');
  const regexEl = doc.getElementById('field-selector-regex');
  const defaultEl = doc.getElementById('field-selector-default');

  // 1) No regex, no transforms: the sample is echoed back verbatim.
  sampleEl.value = '  Hello World  ';
  fireInput(win, sampleEl);
  assert.equal(preview.textContent, JSON.stringify('  Hello World  '), 'raw sample echoed');

  // 2) Regex with a capture group extracts group 1 (engine semantics).
  regexEl.value = '\\$([0-9.,]+)';
  fireInput(win, regexEl);
  sampleEl.value = '  $1.234,56 TL  ';
  fireInput(win, sampleEl);
  assert.equal(preview.textContent, JSON.stringify('1.234,56'), 'capture group extracted');

  // 3) Add the "number" transform: localized number is parsed.
  doc.getElementById('field-transform-type').value = 'number';
  doc.getElementById('btn-add-transform').click();
  await sleep(20);
  assert.equal(preview.textContent, JSON.stringify('1234.56'), 'number transform parsed 1.234,56 -> 1234.56');

  // 4) Invalid regex -> explicit error, not a silent value.
  regexEl.value = '(';
  fireInput(win, regexEl);
  assert.ok(/✖/.test(preview.textContent), 'invalid regex shows an error marker');
  assert.ok(/Invalid regex/i.test(preview.textContent), 'error message is translated and present');
  regexEl.value = '\\$([0-9.,]+)';
  fireInput(win, regexEl);

  // 5) No match + default value: the default is what gets stored.
  defaultEl.value = 'N/A';
  fireInput(win, defaultEl);
  sampleEl.value = 'no price here';
  fireInput(win, sampleEl);
  assert.equal(preview.textContent, JSON.stringify('N/A'), 'default used when regex does not match');

  // 6) Transforms run IN ORDER: lowercase then uppercase -> upper wins.
  regexEl.value = '';
  fireInput(win, regexEl);
  defaultEl.value = '';
  fireInput(win, defaultEl);
  sampleEl.value = 'MiXeD Case';
  fireInput(win, sampleEl);
  doc.getElementById('field-transform-type').value = 'lowercase';
  doc.getElementById('btn-add-transform').click();
  await sleep(10);
  assert.equal(preview.textContent, JSON.stringify('mixed case'), 'lowercase applied');
  doc.getElementById('field-transform-type').value = 'uppercase';
  doc.getElementById('btn-add-transform').click();
  await sleep(10);
  assert.equal(preview.textContent, JSON.stringify('MIXED CASE'), 'second transform runs after the first');

  // 7) Removing a transform updates the preview again.
  const rows = doc.querySelectorAll('#transforms-list > div');
  rows[rows.length - 1].querySelector('button:last-child').click(); // ✕ on the last row
  await sleep(10);
  assert.equal(preview.textContent, JSON.stringify('mixed case'), 'removing the last transform reverts the preview');

  // 8) Empty sample clears the preview.
  sampleEl.value = '';
  fireInput(win, sampleEl);
  assert.equal(preview.textContent, '', 'empty sample -> empty preview');

  win.close();
});
