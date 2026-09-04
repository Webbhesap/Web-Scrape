/**
 * Help-dialog visibility regression tests.
 *
 * The keyboard-shortcuts overlay is hidden with the `hidden` attribute, but
 * its class rule (`.help-overlay { display: flex }`) comes from the author
 * stylesheet and therefore beats the UA-level `[hidden] { display: none }`.
 * Result: "close" set the attribute while the overlay stayed visible, so the
 * backdrop click and the close button appeared dead. The slideshow overlay
 * had already been fixed with the same `!important` guard; these tests pin
 * the generic rule and the real computed cascade in jsdom (the older tests
 * never loaded dashboard.css, so attribute-only checks could not see this).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const TOR = path.resolve(__dirname, '..', 'tor');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCss() {
  return fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.css'), 'utf8');
}

function bootWithCss() {
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

  // Inject the REAL dashboard stylesheet so getComputedStyle exercises the
  // same cascade the browser sees.
  const style = win.document.createElement('style');
  style.textContent = readCss();
  win.document.head.appendChild(style);

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

const displayOf = (win, el) => win.getComputedStyle(el).display;

test('Help dialog is VISUALLY hidden: author CSS may not beat [hidden] (computed cascade)', async () => {
  const { win } = bootWithCss();
  const doc = win.document;
  await sleep(150);
  const help = doc.getElementById('help-overlay');
  assert.ok(help, 'help overlay exists');

  // 1. On initial load the markup already carries [hidden] — it must be invisible.
  assert.equal(displayOf(win, help), 'none', 'overlay starts visually hidden despite .help-overlay display:flex');

  // 2. ? opens it — and it must actually become visible (flex).
  doc.body.dispatchEvent(keyEvent(win, { key: '?' }));
  assert.equal(help.hidden, false, 'hidden property cleared');
  assert.equal(displayOf(win, help), 'flex', 'overlay becomes visible');

  // 3. Close button must hide it in the cascade, not just via the attribute.
  doc.getElementById('btn-help-close').click();
  assert.equal(help.hidden, true, 'close button sets hidden');
  assert.equal(displayOf(win, help), 'none', 'overlay is visually closed after clicking the button');

  // 4. Backdrop click closes as well; clicking inside the dialog must not.
  doc.body.dispatchEvent(keyEvent(win, { key: 'F1' }));
  assert.equal(displayOf(win, help), 'flex', 'F1 reopens');
  help.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(displayOf(win, help), 'none', 'backdrop click closes visually');

  doc.body.dispatchEvent(keyEvent(win, { key: '?' }));
  help.querySelector('.help-dialog').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(displayOf(win, help), 'flex', 'click inside the dialog keeps it open');

  // 5. Esc closes too.
  doc.dispatchEvent(keyEvent(win, { key: 'Escape' }));
  assert.equal(displayOf(win, help), 'none', 'Esc closes visually');
  win.close();
});

test('dashboard.css declares a generic [hidden] display override (and the tor build stays in sync)', () => {
  const css = readCss();
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, 'generic [hidden] override with !important present');
  const torCss = fs.readFileSync(path.join(TOR, 'dashboard', 'dashboard.css'), 'utf8');
  assert.match(torCss, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, 'tor build carries the same guard');
});

test('help dialog close control is an icon button (svg, no text label, accessible name)', async () => {
  const { win } = bootWithCss();
  const doc = win.document;
  await sleep(150);
  const btn = doc.getElementById('btn-help-close');
  assert.ok(btn, 'close button exists');
  assert.equal(btn.getAttribute('type'), 'button', 'not a submit button');
  assert.ok(btn.querySelector('span.icon-x svg'), 'the x icon is injected into the button');
  assert.equal(btn.textContent.trim(), '', 'no visible text label');
  // AppI18n.apply() gives it a real accessible name from the dictionary.
  const name = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
  assert.ok(/close|kapat/i.test(name), `accessible name resolved (got "${name}")`);
  win.close();
});

test('hidden overlay never intercepts clicks while closed (pointer-events safety)', async () => {
  const { win } = bootWithCss();
  const doc = win.document;
  await sleep(150);
  const help = doc.getElementById('help-overlay');
  const cs = win.getComputedStyle(help);
  // display:none alone is enough in every engine; assert it anyway so a future
  // "polite" change (visibility/opacity toggling) gets caught by this test.
  assert.equal(cs.display, 'none', 'fully removed from layout when hidden');
  win.close();
});
