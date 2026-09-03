/**
 * Runtime smoke tests for the Firefox/Tor NATIVE build in tor/.
 * Boots the generated dashboard inside JSDOM with a promise-based browser.*
 * mock (no chrome.* defined at all, like a strict Firefox environment) and
 * verifies the picker flow, the permission gate and the storage layer all
 * work through the browser.* namespace.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const TOR = path.join(ROOT, 'tor');
const dashboardHtml = fs.readFileSync(path.join(TOR, 'dashboard', 'dashboard.html'), 'utf8');

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

  const calls = { contains: 0, request: 0, executeScript: 0, sentMessages: [] };
  const db = {};

  // Strict Firefox: only the promise-based browser.* namespace exists.
  window.browser = {
    runtime: {
      getURL: (p) => p,
      sendMessage: (msg) => { calls.sentMessages.push(msg); return Promise.resolve(); },
      onMessage: { addListener: () => {} }
    },
    permissions: {
      contains: (spec) => { calls.contains++; return Promise.resolve(hasPermission); },
      request: (spec) => { calls.request++; return Promise.resolve(grantOnRequest || hasPermission); }
    },
    tabs: {
      query: (q) => Promise.resolve([{ id: 42, active: true, url: 'https://example.com/' }]),
      get: (id) => Promise.resolve({ id: 42, url: 'https://example.com/', status: 'complete' }),
      sendMessage: (id, msg) => { calls.sentMessages.push(msg); return Promise.resolve({ success: true }); },
      create: (o) => Promise.resolve({ id: 43 }),
      remove: (id) => Promise.resolve(),
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      onRemoved: { addListener: () => {}, removeListener: () => {} }
    },
    scripting: {
      executeScript: (spec) => {
        calls.executeScript++;
        return Promise.resolve([{ result: '<html></html>' }]);
      },
      insertCSS: (spec) => Promise.resolve()
    },
    storage: {
      local: {
        get: (keys) => {
          if (keys == null) return Promise.resolve({ ...db });
          if (typeof keys === 'string') {
            return Promise.resolve(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          }
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => {
            if (db[k] !== undefined) out[k] = db[k];
          });
          return Promise.resolve(out);
        },
        set: (obj) => { Object.assign(db, obj); return Promise.resolve(); },
        remove: (keys) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]);
          return Promise.resolve();
        }
      }
    }
  };

  const alerts = [];
  window.alert = (m) => alerts.push(String(m));

  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(TOR, rel), 'utf8');
    window.document.body.appendChild(el);
  }
  return { window, calls, alerts, db };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Tor native - dashboard boots with browser.* only (no chrome namespace)', async () => {
  const { window } = boot({ hasPermission: true });
  await wait(60);

  assert.equal(window.chrome, undefined, 'no chrome namespace defined');
  assert.ok(window.document.getElementById('btn-picker-select'), 'UI rendered');
});

test('Tor native - picker flow injects scripts through awaited browser.scripting', async () => {
  const { window, calls, alerts } = boot({ hasPermission: true });
  await wait(60);

  window.document.getElementById('btn-picker-select').click();
  await wait(100);

  assert.ok(calls.request >= 1, 'permission requested via promise API (silent when already granted)');
  assert.ok(calls.executeScript >= 1, 'picker script injected via browser.scripting');
  assert.ok(calls.sentMessages.some((m) => m && m.type === 'START_PICKER'), 'START_PICKER sent to the tab');
  assert.equal(alerts.length, 0, 'no error alerts in the happy path');
});

test('Tor native - picker aborts when the permission request is denied', async () => {
  const { window, calls, alerts } = boot({ hasPermission: false, grantOnRequest: false });
  await wait(60);

  window.document.getElementById('btn-picker-select').click();
  await wait(100);

  assert.ok(calls.request >= 1, 'permission requested');
  assert.equal(calls.executeScript, 0, 'no injection without the host permission');
  assert.ok(alerts.length >= 1, 'user is told the permission is required');
});

test('Tor native - storage round-trips sitemaps through browser.storage.local', async () => {
  const { window, db } = boot({ hasPermission: true });
  await wait(60);

  const saved = await window.AppStorage.saveSitemap({ _id: 'tor-test', name: 'Tor Test', selectors: [] });
  assert.equal(saved._id, 'tor-test');
  assert.ok(db['sitemap_tor-test'], 'written under the sitemap_ key in browser.storage.local');

  const loaded = await window.AppStorage.getSitemap('tor-test');
  assert.equal(loaded.name, 'Tor Test');

  const all = await window.AppStorage.getAllSitemaps();
  assert.ok(all.some((s) => s._id === 'tor-test'), 'listed by getAllSitemaps');

  await window.AppStorage.deleteSitemap('tor-test');
  assert.equal(db['sitemap_tor-test'], undefined, 'removed from browser.storage.local');
});
