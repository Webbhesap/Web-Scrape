/**
 * Regression tests for the Firefox/Tor "Missing host permission for the tab"
 * fix: the dashboard must verify (and if needed, request) the <all_urls>
 * host permission at runtime before injecting scripts, because Firefox MV3
 * treats host_permissions as opt-in rather than install-time granted.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const dashboardHtml = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.js'), 'utf8');

const SCRIPTS = [
  'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
  'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
  'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
  'lib/i18n.js', 'lib/zip.js', 'dashboard/dashboard.js'
];

function boot({ hasPermission, grantOnRequest }) {
  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const window = dom.window;
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;

  const calls = { contains: 0, request: 0, executeScript: 0 };
  const db = {};
  window.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    permissions: {
      contains: (spec, cb) => { calls.contains++; cb(hasPermission); },
      request: (spec, cb) => { calls.request++; cb(grantOnRequest); }
    },
    tabs: {
      query: (q, cb) => cb([{ id: 42, active: true, url: 'https://example.com/' }]),
      get: (id, cb) => cb({ id: 42, url: 'https://example.com/', status: 'complete' }),
      sendMessage: (id, msg, cb) => { if (cb) cb(); },
      create: (o, cb) => { if (cb) cb({ id: 43 }); },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      onRemoved: { addListener: () => {}, removeListener: () => {} }
    },
    scripting: {
      executeScript: (spec, cb) => { calls.executeScript++; if (cb) cb([{ result: '<html></html>' }]); },
      insertCSS: (spec, cb) => { if (cb) cb(); }
    },
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
  const alerts = [];
  window.alert = (m) => alerts.push(String(m));

  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  return { window, calls, alerts };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Host permission - picker checks permission and proceeds when granted', async () => {
  const { window, calls } = boot({ hasPermission: true, grantOnRequest: false });
  await wait(50);

  window.document.getElementById('btn-picker-select').click();
  await wait(80);

  assert.ok(calls.contains >= 1, 'permissions.contains consulted before injecting');
  assert.equal(calls.request, 0, 'no request needed when already granted');
  assert.ok(calls.executeScript >= 1, 'picker script injected');
});

test('Host permission - picker requests permission when missing and aborts on denial', async () => {
  const { window, calls, alerts } = boot({ hasPermission: false, grantOnRequest: false });
  await wait(50);

  window.document.getElementById('btn-picker-select').click();
  await wait(80);

  assert.ok(calls.request >= 1, 'permissions.request called when permission missing');
  assert.equal(calls.executeScript, 0, 'no injection without permission');
  assert.ok(alerts.length >= 1, 'user is told the permission is required');
});

test('Host permission - picker proceeds after the user grants the runtime request', async () => {
  const { window, calls } = boot({ hasPermission: false, grantOnRequest: true });
  await wait(50);

  window.document.getElementById('btn-picker-select').click();
  await wait(80);

  assert.ok(calls.request >= 1, 'permission requested');
  assert.ok(calls.executeScript >= 1, 'injection proceeds after grant');
});

test('Host permission - scraper start is also guarded', () => {
  // startScraping must await the same ensureHostPermission gate.
  assert.match(dashboardJs, /ensureHostPermission/, 'helper exists');
  const startFn = dashboardJs.slice(dashboardJs.indexOf('async function startScraping'));
  assert.ok(startFn.slice(0, 1200).includes('ensureHostPermission'), 'startScraping checks host permission before crawling');
});
