/**
 * Ö9 — global keyboard shortcuts + help dialog tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    'lib/sitemap_templates.js', 'lib/download_manager.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/zip.js',
    'lib/undo_stack.js', 'dashboard/dashboard.js'
  ];
  for (const rel of scripts) {
    const sc = win.document.createElement('script');
    sc.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(sc);
  }
  return { win, db };
}

function keyEvent(win, opts) {
  return new win.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, opts));
}

const SITEMAP = {
  _id: 'shortcutdemo', name: 'shortcutdemo',
  startUrl: ['https://example.com'],
  selectors: [
    { id: 'title', type: 'SelectorText', selector: 'h1', parentSelectors: ['_root'] }
  ],
  options: { shadowDom: true }
};

async function openSeeded(win) {
  const doc = win.document;
  await sleep(150);
  const row = Array.from(doc.querySelectorAll('#tbody-sitemaps tr'))
    .find((tr) => tr.textContent.includes('shortcutdemo'));
  assert.ok(row, 'seeded sitemap listed');
  row.querySelector('.action-scrape, .action-browse, a, button').click();
  await sleep(150);
}

test('Shortcuts - ? opens the help dialog, Esc closes it', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await sleep(150);
  const help = doc.getElementById('help-overlay');
  assert.ok(help, 'help dialog rendered');
  assert.equal(help.hidden, true, 'starts hidden');

  doc.body.dispatchEvent(keyEvent(win, { key: '?' }));
  assert.equal(help.hidden, false, '? opens the dialog');

  doc.dispatchEvent(keyEvent(win, { key: 'Escape' }));
  assert.equal(help.hidden, true, 'Esc closes the dialog');
});

test('Shortcuts - help lists global and picker shortcuts in a table', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await sleep(150);
  const rows = Array.from(doc.querySelectorAll('#help-shortcuts-body tr'));
  const kbds = rows.map((r) => (r.querySelector('kbd') || {}).textContent || '').filter(Boolean);
  for (const combo of ['Ctrl+Alt+N', 'Ctrl+Alt+S', 'Ctrl+Alt+D', 'Ctrl+Alt+G', '?', 'Esc', 'P', 'C', 'Enter']) {
    assert.ok(kbds.includes(combo), `${combo} documented`);
  }
  assert.ok(rows.some((r) => r.classList.contains('help-section')), 'picker section heading present');
});

test('Shortcuts - close button and backdrop click close, dialog click does not', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await sleep(150);
  const help = doc.getElementById('help-overlay');
  doc.body.dispatchEvent(keyEvent(win, { key: '?' }));
  assert.equal(help.hidden, false);

  doc.getElementById('btn-help-close').click();
  assert.equal(help.hidden, true, 'close button works');

  doc.body.dispatchEvent(keyEvent(win, { key: 'F1' }));
  assert.equal(help.hidden, false, 'F1 reopens');
  help.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(help.hidden, true, 'backdrop click closes');

  doc.body.dispatchEvent(keyEvent(win, { key: '?' }));
  const dialog = help.querySelector('.help-dialog');
  dialog.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(help.hidden, false, 'click inside the dialog stays open');
});

test('Shortcuts - Ctrl+Alt+N opens the create-sitemap view', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await sleep(150);
  doc.body.dispatchEvent(keyEvent(win, { key: 'n', ctrlKey: true, altKey: true }));
  await sleep(30);
  assert.ok(doc.getElementById('view-sitemap-meta').classList.contains('active'), 'meta view active');
});

test('Shortcuts - Ctrl+Alt+D and Ctrl+Alt+G switch views of the current sitemap', async () => {
  const { win } = bootDashboard(SITEMAP);
  const doc = win.document;
  await openSeeded(win);

  doc.body.dispatchEvent(keyEvent(win, { key: 'd', ctrlKey: true, altKey: true }));
  await sleep(30);
  assert.ok(doc.getElementById('view-export-data').classList.contains('active'), 'data view active');

  doc.body.dispatchEvent(keyEvent(win, { key: 'g', ctrlKey: true, altKey: true }));
  await sleep(30);
  assert.ok(doc.getElementById('view-selector-graph').classList.contains('active'), 'graph view active');
});

test('Shortcuts - Ctrl+Alt+S switches to the scrape view', async () => {
  const { win } = bootDashboard(SITEMAP);
  const doc = win.document;
  await openSeeded(win);

  doc.body.dispatchEvent(keyEvent(win, { key: 's', ctrlKey: true, altKey: true }));
  await sleep(30);
  assert.ok(doc.getElementById('view-scrape').classList.contains('active'), 'scrape view active');
});

test('Shortcuts - ? ignored while typing in a form field', async () => {
  const { win } = bootDashboard();
  const doc = win.document;
  await sleep(150);
  const help = doc.getElementById('help-overlay');

  const input = doc.getElementById('field-sitemap-urls');
  input.focus();
  input.dispatchEvent(keyEvent(win, { key: '?', bubbles: true }));
  assert.equal(help.hidden, true, 'no help while typing');

  // Ctrl+Alt+N still works from an input (standard accelerator behaviour)
  input.dispatchEvent(keyEvent(win, { key: 'n', ctrlKey: true, altKey: true, bubbles: true }));
  await sleep(30);
  assert.ok(doc.getElementById('view-sitemap-meta').classList.contains('active'), 'accelerator works from input');
});
