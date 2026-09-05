/**
 * Boots the GENERATED tor/background.js event page in a strict
 * Firefox/Tor-style environment: the promise-based `browser.*` namespace
 * WITHOUT the Chromium-only `contextMenus` API.
 *
 * Regression: the unguarded `browser.contextMenus.onClicked.addListener`
 * threw a TypeError while the event page loaded, aborting the script
 * BEFORE the runtime.onMessage router was registered — so picker results
 * and OPEN_DASHBOARD messages had no background handler at all on Tor.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TOR_BG = path.join(__dirname, '..', 'tor', 'background.js');

/** Builds a Firefox-shaped browser mock; `withContextMenus` toggles the API. */
function makeBrowserMock(withContextMenus) {
  const calls = {
    installedListeners: [],
    messageListeners: [],
    menuCreates: [],
    menuClickListeners: [],
    tabsCreated: []
  };
  const mock = {
    runtime: {
      getURL: (p) => 'moz-extension://web-scraper@x/' + p,
      onInstalled: { addListener: (fn) => calls.installedListeners.push(fn) },
      onMessage: { addListener: (fn) => calls.messageListeners.push(fn) },
      sendMessage: (msg) => Promise.resolve(),
      lastError: null
    },
    tabs: {
      create: (opts) => { calls.tabsCreated.push(opts); return Promise.resolve({ id: 1 }); }
    }
  };
  if (withContextMenus) {
    mock.contextMenus = {
      create: (opts, cb) => { calls.menuCreates.push(opts); if (cb) cb(); },
      onClicked: { addListener: (fn) => calls.menuClickListeners.push(fn) }
    };
  }
  return { mock, calls };
}

function bootBackground(mock) {
  const code = fs.readFileSync(TOR_BG, 'utf8');
  // Run in a context where `browser` is the ONLY webextension global and
  // `contextMenus` exists only when the mock provides it.
  const context = vm.createContext({
    browser: mock,
    console
  });
  vm.runInContext(code, context, { filename: 'tor/background.js' });
  return context;
}

test('Tor background - event page loads with NO contextMenus API (Tor Browser)', () => {
  const { mock, calls } = makeBrowserMock(false);
  const errors = [];
  try {
    bootBackground(mock);
  } catch (e) {
    errors.push(e);
  }
  assert.deepEqual(errors, [], 'no top-level TypeError when contextMenus is missing');
  assert.equal(calls.messageListeners.length, 1,
    'runtime.onMessage router MUST still be registered (it powers picker results)');
  assert.equal(calls.menuCreates.length, 0, 'no menu created when the API is absent');
});

test('Tor background - OPEN_DASHBOARD works without contextMenus', async () => {
  const { mock, calls } = makeBrowserMock(false);
  bootBackground(mock);
  const response = await calls.messageListeners[0]({ type: 'OPEN_DASHBOARD' });
  // Field-level compare: the reply is born in a different vm realm.
  assert.equal(response.success, true);
  assert.equal(calls.tabsCreated.length, 1, 'dashboard tab opened');
});

test('Tor background - picker results are forwarded (with _forwarded flag)', async () => {
  const { mock, calls } = makeBrowserMock(false);
  const sent = [];
  mock.runtime.sendMessage = (msg) => { sent.push(msg); return Promise.resolve(); };
  bootBackground(mock);
  calls.messageListeners[0]({ type: 'PICKER_RESULT', selector: 'a.x' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.length, 1, 'forwarded once');
  assert.equal(sent[0]._forwarded, true, 'forward copy is flagged');
  assert.equal(sent[0].selector, 'a.x');
});

test('Tor background - context menu created when the API exists (Chrome-shaped host)', () => {
  const { mock, calls } = makeBrowserMock(true);
  bootBackground(mock);
  // Fire the install event — menu registration happens in onInstalled.
  calls.installedListeners.forEach((fn) => fn({ reason: 'install' }));
  assert.equal(calls.menuCreates.length, 1, 'menu registered when available');
  assert.equal(calls.menuCreates[0].id, 'ws_scrape_page');
  assert.equal(calls.menuClickListeners.length, 1, 'click handler attached');
});
