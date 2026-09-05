/**
 * Tor "Select button does nothing" regression tests — the RECOVERY flow.
 *
 * Scenario: the user has website access granted, but the target tab was
 * opened BEFORE the grant, so:
 *   - browser.scripting.executeScript rejects ("Missing host permission"),
 *   - and the manifest content scripts never ran on it, so tabs.sendMessage
 *     has no receiving end.
 *
 * Historic behaviour: an alert and a dead end — the button appeared broken.
 * Fixed behaviour: the dashboard asks once, reloads the tab, waits for the
 * 'complete' load event, and retries the injection. The picker then starts
 * normally.
 *
 * Uses the same harness shape as picker_e2e.test.js, but the PAGE starts
 * STALE (no content scripts) and only gains them when the tab is reloaded.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const TOR = path.resolve(__dirname, '..', 'tor');

const DASHBOARD_SCRIPTS = [
  'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
  'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js',
  'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js',
  'src/engine/ScraperEngine.js',
  'src/storage/Storage.js',
  'src/export/Exporter.js',
  'src/ui/SelectorGraph.js',
  'lib/i18n.js', 'lib/zip.js',
  'lib/undo_stack.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
];

const PAGE_HTML = `<!DOCTYPE html><html><body>
  <ul class="products">
    <li class="product"><h3 class="title">A</h3></li>
    <li class="product"><h3 class="title">B</h3></li>
  </ul>
</body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadScript(win, baseDir, rel) {
  const code = fs.readFileSync(path.join(baseDir, rel), 'utf8');
  const el = win.document.createElement('script');
  el.textContent = code;
  win.document.body.appendChild(el);
}

/**
 * Boots a STALE tab (no content scripts yet) + the TOR dashboard, wired so
 * that reloading the tab runs the manifest content scripts and unlocks the
 * scripting API — exactly what a real permission-grant reload does.
 */
function bootStaleTab({ confirmAnswer = true } = {}) {
  const bus = {
    pageListeners: [],
    extListeners: [],
    sentToTabs: [],
    executeScriptCalls: 0,
    sendMessageCalls: 0,
    sendMessageRejections: 0,
    reloads: 0,
    onUpdatedListeners: []
  };

  // ---------------- PAGE (stale tab) ----------------
  const pageDom = new JSDOM(PAGE_HTML, {
    runScripts: 'dangerously',
    url: 'https://tor-test.example.com/products',
    pretendToBeVisual: true
  });
  const pageWin = pageDom.window;
  pageWin.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  if (typeof pageWin.TextEncoder === 'undefined') pageWin.TextEncoder = TextEncoder;

  // Firefox-shaped page runtime: the content scripts use browser.runtime.
  pageWin.browser = {
    runtime: {
      getURL: (p) => 'moz-extension://web-scraper@x/' + p,
      lastError: null,
      sendMessage: (msg) => {
        for (const L of bus.extListeners.slice()) {
          try { L(msg, { tab: { id: 42 } }, () => {}); } catch (e) { /* isolate */ }
        }
        return Promise.resolve();
      },
      onMessage: { addListener: (L) => bus.pageListeners.push(L) }
    }
  };

  function installContentScripts() {
    loadScript(pageWin, TOR, 'content/selector_picker.js');
    loadScript(pageWin, TOR, 'content/scraper_content.js');
  }

  // ---------------- DASHBOARD (tor build) ----------------
  const dashboardHtml = fs.readFileSync(path.join(TOR, 'dashboard', 'dashboard.html'), 'utf8');
  const dashDom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'moz-extension://web-scraper@x/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const dashWin = dashDom.window;
  if (typeof dashWin.TextEncoder === 'undefined') dashWin.TextEncoder = TextEncoder;

  // A persisting storage mock (same shape as picker_e2e) — an empty-backed
  // one would hide sitemaps the dashboard just saved.
  const db = {};
  const storageApi = {
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
      set: (obj, cb) => {
        Object.assign(db, obj);
        if (cb) setTimeout(() => cb(), 0);
        return Promise.resolve();
      },
      remove: (keys, cb) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]);
        if (cb) setTimeout(() => cb(), 0);
        return Promise.resolve();
      }
    }
  };

  const alerts = [];
  const confirms = [];
  dashWin.alert = (m) => alerts.push(typeof m === 'string' ? m : String(m));
  dashWin.confirm = (m) => { confirms.push(typeof m === 'string' ? m : String(m)); return confirmAnswer; };

  const tabFixture = {
    id: 42,
    url: 'https://tor-test.example.com/products',
    status: 'complete',
    lastAccessed: Date.now()
  };

  const runtimeApi = {
    getURL: (p) => 'moz-extension://web-scraper@x/' + p,
    lastError: null,
    sendMessage: (msg) => {
      for (const L of bus.extListeners.slice()) {
        try { L(msg, {}, () => {}); } catch (e) { /* isolate */ }
      }
      return Promise.resolve();
    },
    onMessage: { addListener: (L) => bus.extListeners.push(L) }
  };

  const tabsApi = {
    query: (q) => {
      if (q && q.lastFocusedWindow) {
        return Promise.resolve([{ id: 42, url: tabFixture.url, active: true, lastAccessed: Date.now() }]);
      }
      if (q && (q.windowId || (q.active && q.currentWindow))) return Promise.resolve([]);
      return Promise.resolve([tabFixture]);
    },
    get: (id) => Promise.resolve({ ...tabFixture, id }),
    getCurrent: () => Promise.resolve({ id: 7, url: 'moz-extension://web-scraper@x/dashboard/dashboard.html' }),
    reload: (id) => {
      bus.reloads++;
      // Re-navigation runs the manifest content scripts at document_idle.
      installContentScripts();
      bus.onUpdatedListeners.forEach((fn) => fn(id, { status: 'complete' }));
      return Promise.resolve();
    },
    onUpdated: {
      addListener: (fn) => bus.onUpdatedListeners.push(fn),
      removeListener: () => {}
    },
    sendMessage: (id, msg) => {
      bus.sendMessageCalls++;
      if (bus.pageListeners.length === 0) {
        bus.sendMessageRejections++;
        return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
      }
      const promises = bus.pageListeners.slice().map((L) => {
        try { return Promise.resolve(L(msg, {}, () => {})); } catch (e) { return Promise.reject(e); }
      });
      return Promise.all(promises).then((rs) => rs.find((r) => r !== undefined));
    }
  };

  const scriptingApi = {
    executeScript: () => {
      bus.executeScriptCalls++;
      if (bus.reloads === 0) {
        return Promise.reject(new Error('Missing host permission for the tab'));
      }
      return Promise.resolve([{ result: null }]);
    },
    insertCSS: () => Promise.resolve()
  };

  dashWin.browser = {
    runtime: runtimeApi,
    tabs: tabsApi,
    scripting: scriptingApi,
    permissions: {
      request: () => Promise.resolve(true),
      contains: () => Promise.resolve(true)
    },
    storage: storageApi,
    downloads: { download: () => Promise.resolve(1) }
  };

  for (const rel of DASHBOARD_SCRIPTS) loadScript(dashWin, TOR, rel);

  return { bus, pageWin, dashWin, alerts, confirms };
}

function waitFor(fn, timeout = 4000, label = 'condition') {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      let ok = false;
      try { ok = fn(); } catch (e) { ok = false; }
      if (ok) { clearInterval(timer); resolve(); }
      else if (Date.now() - startedAt > timeout) {
        clearInterval(timer);
        reject(new Error('waitFor timeout: ' + label));
      }
    }, 5);
  });
}

/** Puts a sitemap in storage, opens it and shows the add-selector form. */
async function openAddSelectorForm(win) {
  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = 'recovery sim';
  doc.getElementById('field-sitemap-urls').value = 'https://tor-test.example.com/products';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
  doc.getElementById('btn-add-selector').click();
  await sleep(30);
  return doc;
}

test('Tor Select - stale tab: reload + retry recovers the picker', async () => {
  const { bus, pageWin, dashWin, alerts, confirms } = bootStaleTab({ confirmAnswer: true });
  const doc = await openAddSelectorForm(dashWin);

  // Leave the CSS field EMPTY on purpose: a pre-filled selector would make
  // the picker start with the matches pre-selected, and the pick clicks
  // below would toggle them OFF (the picker's designed behaviour).
  doc.getElementById('field-selector-type').value = 'SelectorElement';
  doc.getElementById('btn-picker-select').click();

  // The picker must eventually start on the reloaded page.
  await waitFor(() => pageWin.__webScraperPickerActive === true, 5000, 'picker active');

  assert.equal(bus.reloads, 1, 'the stale tab was reloaded exactly once');
  assert.equal(bus.executeScriptCalls, 2, 'first injection failed, retry succeeded');
  assert.equal(bus.sendMessageCalls, 1, 'only the post-reload retry delivered the message');
  assert.equal(bus.sendMessageRejections, 0, 'the retry found the content script on the fresh page');
  assert.equal(confirms.length, 1, 'the user was asked exactly once');
  assert.ok(confirms[0].length > 10, 'confirmation explains the reason');
  assert.deepEqual(alerts, [], 'no dead-end alerts when the recovery succeeds');

  // Finish the pick — CSS must land in the form.
  const lis = pageWin.document.querySelectorAll('li.product');
  lis[0].dispatchEvent(new pageWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  lis[1].dispatchEvent(new pageWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(30);

  const doneBtn = pageWin.document.getElementById('ws-btn-done');
  if (doneBtn) doneBtn.click();
  await waitFor(() => doc.getElementById('field-selector-css').value === 'li.product', 4000, 'CSS filled');

  assert.equal(doc.getElementById('field-selector-css').value, 'li.product');
  assert.deepEqual(alerts, [], 'still no alerts after the pick');

  dashWin.close();
  pageWin.close();
});

test('Tor Select - user declines the reload: explanatory alert, no loop', async () => {
  const { bus, pageWin, dashWin, alerts, confirms } = bootStaleTab({ confirmAnswer: false });
  const doc = await openAddSelectorForm(dashWin);

  doc.getElementById('btn-picker-select').click();

  await waitFor(() => alerts.length >= 1, 4000, 'fallback alert');

  assert.equal(bus.reloads, 0, 'no reload when the user declines');
  assert.equal(confirms.length, 1, 'asked exactly once — never spammed');
  assert.ok(pageWin.__webScraperPickerActive !== true, 'picker never activated');
  assert.ok(alerts.length <= 1, 'a single explanatory alert');

  dashWin.close();
  pageWin.close();
});
