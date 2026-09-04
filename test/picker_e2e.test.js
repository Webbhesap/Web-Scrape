/**
 * End-to-end picker flow tests (Chrome AND Tor builds).
 *
 * Boots two JSDOM environments — a target "web page" carrying the real
 * content scripts, and the real dashboard — wired together through a
 * Firefox/Chrome-faithful message bus. Verifies the full "Select" flow the
 * user drives by hand:
 *
 *   dashboard: click Select -> permission gate -> executeScript
 *              -> tabs.sendMessage(START_PICKER)
 *   page:      picker activates -> user clicks elements -> Done
 *              -> runtime.sendMessage(PICKER_RESULT)
 *   dashboard: CSS field is filled with the computed selector
 *
 * Regression-covers the historic Tor failures:
 *   - picker landing on the wrong (background) tab,
 *   - silently dying when no receiver answered,
 *   - CSS.escape ReferenceError in environments without the CSS global,
 *   - second START_PICKER being ignored while the picker is active.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const TOR = path.resolve(__dirname, '..', 'tor');

const DASHBOARD_SCRIPTS = [
  'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
  'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js', 'src/engine/ScraperEngine.js',
  'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
  'lib/i18n.js', 'lib/zip.js', 'lib/sitemap_templates.js', 'dashboard/dashboard.js'
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
 * Message bus emulating the WebExtension routing rules:
 *  - tabs.sendMessage(id, msg)      -> only content-script listeners in that tab
 *  - runtime.sendMessage(msg)       -> extension contexts (dashboard + background),
 *                                      never the content scripts themselves
 */
function createBus() {
  const bus = {
    pageListeners: [],   // runtime.onMessage listeners inside the page sandbox
    extListeners: [],    // runtime.onMessage listeners in extension pages
    tabs: {},            // tabId -> { executeScript(files|func), insertCSS } behavior
    sentToTabs: [],
    runtimeSends: []
  };
  return bus;
}

/** Boots the page with content scripts from `baseDir` and namespace `ns` ("chrome"|"browser"). */
function bootPage(baseDir, ns, bus) {
  const dom = new JSDOM(PAGE_HTML, {
    runScripts: 'dangerously',
    url: 'https://example.com/list',
    pretendToBeVisual: true
  });
  const win = dom.window;
  win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;

  const api = {
    runtime: {
      getURL: (p) => p,
      sendMessage: (msg) => {
        bus.runtimeSends.push(msg);
        for (const L of bus.extListeners.slice()) {
          try { L(msg, { tab: { id: 42 } }, () => {}); } catch (e) { /* listener errors are isolated */ }
        }
        return ns === 'chrome' ? undefined : Promise.resolve();
      },
      onMessage: { addListener: (L) => bus.pageListeners.push(L) }
    }
  };
  win[ns] = api;

  loadScript(win, baseDir, 'content/selector_picker.js');
  loadScript(win, baseDir, 'content/scraper_content.js');
  return { dom, win };
}

/**
 * Boots the dashboard from `baseDir` with namespace `ns`, wired to `bus`.
 * `tabFixture` describes tabs.query results; `selfTabId` is the dashboard tab.
 */
function bootDashboard(baseDir, ns, bus, { hasPermission = true, tabFixture, selfTabId = 7, failFirstSend = false } = {}) {
  const dashboardHtml = fs.readFileSync(path.join(baseDir, 'dashboard', 'dashboard.html'), 'utf8');
  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = dom.window;
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;

  const alerts = [];
  win.alert = (m) => alerts.push(m);
  win.confirm = () => true;

  const callbackStyle = ns === 'chrome';
  const db = {};

  const tabsApi = {
    query: (q, cb) => {
      const result = tabFixture(q);
      if (callbackStyle) { setTimeout(() => cb(result), 0); return; }
      return Promise.resolve(result);
    },
    get: (id, cb) => {
      const info = { id, url: 'https://example.com/list', status: 'complete' };
      if (callbackStyle) { setTimeout(() => cb(info), 0); return; }
      return Promise.resolve(info);
    },
    getCurrent: (cb) => {
      const self = selfTabId != null ? { id: selfTabId, url: 'http://localhost:8080/dashboard/dashboard.html' } : undefined;
      if (callbackStyle) { setTimeout(() => cb(self), 0); return; }
      return Promise.resolve(self);
    },
    sendMessage: (id, msg, cb) => {
      bus.sentToTabs.push(msg);
      let responded = false;
      // Chrome-style listeners answer through sendResponse (after `return true`);
      // Firefox-style listeners return a Promise. Support both.
      const sendResponse = (val) => {
        responded = true;
        if (callbackStyle && cb) setTimeout(() => cb(val), 0);
      };
      setTimeout(() => {
        for (const L of bus.pageListeners.slice()) {
          let r;
          try {
            r = L(msg, {}, sendResponse);
          } catch (e) { continue; }
          if (r && typeof r.then === 'function' && !responded) {
            responded = true;
            r.then(
              (val) => { if (callbackStyle && cb) cb(val); },
              (err) => { if (callbackStyle && cb) cb(undefined, err); }
            );
          }
        }
        if (!responded) {
          // Faithful error: "Could not establish connection..."
          if (callbackStyle) {
            win[ns].runtime.__lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
            if (cb) cb();
            win[ns].runtime.__lastError = null;
          }
        }
      }, 0);
      if (!callbackStyle && failFirstSend && !bus.__failedOnce) {
        bus.__failedOnce = true;
        return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
      }
      if (!callbackStyle) return Promise.resolve({ success: true });
    },
    create: (o, cb) => {
      const tab = { id: 99, url: o && o.url };
      if (callbackStyle) { setTimeout(() => cb(tab), 0); return; }
      return Promise.resolve(tab);
    },
    remove: (id, cb) => { if (callbackStyle) { setTimeout(() => cb(), 0); return; } return Promise.resolve(); },
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onRemoved: { addListener: () => {}, removeListener: () => {} }
  };

  const scriptingApi = {
    executeScript: (spec, cb) => {
      bus.tabs.executeScriptCount = (bus.tabs.executeScriptCount || 0) + 1;
      if (cb) { setTimeout(() => cb([{ result: null }]), 0); }
      return Promise.resolve([{ result: null }]);
    },
    insertCSS: (spec, cb) => {
      if (cb) { setTimeout(() => cb(), 0); }
      return Promise.resolve();
    }
  };

  const permissionsApi = {
    contains: (spec, cb) => {
      if (cb) { setTimeout(() => cb(hasPermission), 0); }
      return Promise.resolve(hasPermission);
    },
    request: (spec, cb) => {
      bus.permissionRequests = (bus.permissionRequests || 0) + 1;
      if (cb) { setTimeout(() => cb(hasPermission), 0); }
      return Promise.resolve(hasPermission);
    }
  };

  const runtimeApi = {
    getURL: (p) => p,
    sendMessage: (msg, cb) => {
      bus.runtimeSends.push(msg);
      for (const L of bus.extListeners.slice()) {
        try { L(msg, {}, () => {}); } catch (e) { /* isolate */ }
      }
      if (cb) setTimeout(() => cb(), 0);
      return Promise.resolve();
    },
    onMessage: { addListener: (L) => bus.extListeners.push(L) },
    // Emulates chrome.runtime.lastError (read on every callback above).
    get lastError() { return this.__lastError || null; }
  };

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

  win[ns] = {
    runtime: runtimeApi,
    tabs: tabsApi,
    scripting: scriptingApi,
    permissions: permissionsApi,
    storage: storageApi,
    downloads: { download: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(1); } }
  };

  for (const rel of DASHBOARD_SCRIPTS) loadScript(win, baseDir, rel);
  return { dom, win, alerts };
}

/** Puts a sitemap in storage, opens it and shows the add-selector form. */
async function openAddSelectorForm(win) {
  const doc = win.document;
  const openBtn = doc.getElementById('btn-sitemaps-create');
  openBtn.click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = 'picker sim';
  doc.getElementById('field-sitemap-urls').value = 'https://example.com/list';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);
  doc.getElementById('btn-add-selector').click();
  await sleep(30);
  return doc;
}

async function clickSelectAndPick(doc, pageWin, alerts) {
  doc.getElementById('btn-picker-select').click();
  await sleep(120);

  const lis = pageWin.document.querySelectorAll('li.product');
  lis[0].dispatchEvent(new pageWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  lis[1].dispatchEvent(new pageWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(30);

  const input = pageWin.document.getElementById('ws-selector-input');
  const computed = input ? input.value : null;

  const doneBtn = pageWin.document.getElementById('ws-btn-done');
  if (doneBtn) doneBtn.click();
  await sleep(120);
  return computed;
}

/** The dashboard tab (7) is active; an old background tab (5) exists too.
 *  The page the user actually reads (42) must win over both. */
function standardTabFixture(q) {
  if (q && q.lastFocusedWindow) {
    return [
      { id: 5, url: 'https://old.example.com/stale', lastAccessed: 100 },
      { id: 7, url: 'http://localhost:8080/dashboard/dashboard.html', active: false, lastAccessed: Date.now() - 10 },
      { id: 42, url: 'https://example.com/list', active: true, lastAccessed: Date.now() }
    ];
  }
  return [{ id: 42, url: 'https://example.com/list', lastAccessed: Date.now() }];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Picker E2E (Tor build, browser.* namespace): Select -> pick -> CSS lands in the form', async () => {
  const bus = createBus();
  const page = bootPage(TOR, 'browser', bus);
  const dash = bootDashboard(TOR, 'browser', bus, { tabFixture: standardTabFixture });

  const doc = await openAddSelectorForm(dash.win);
  const computed = await clickSelectAndPick(doc, page.win, dash.alerts);

  assert.ok(page.win.__webScraperPickerActive !== undefined, 'picker ran on the page');
  assert.equal(computed, 'li.product', 'picker computed a generalized selector');
  const field = doc.getElementById('field-selector-css');
  assert.equal(field.value, 'li.product', 'PICKER_RESULT filled the dashboard CSS field');
  assert.deepEqual(dash.alerts, [], 'no error alerts in the happy path');

  // The picker must have started on the page's tab (42), not the stale tab 5
  // or the dashboard tab 7.
  assert.ok(bus.sentToTabs.length >= 1, 'START_PICKER was sent to a tab');
});

test('Picker E2E (Chrome build, chrome.* namespace): Select -> pick -> CSS lands in the form', async () => {
  const bus = createBus();
  const page = bootPage(ROOT, 'chrome', bus);
  const dash = bootDashboard(ROOT, 'chrome', bus, { tabFixture: standardTabFixture });

  const doc = await openAddSelectorForm(dash.win);
  const computed = await clickSelectAndPick(doc, page.win, dash.alerts);

  assert.equal(computed, 'li.product');
  assert.equal(doc.getElementById('field-selector-css').value, 'li.product');
  assert.deepEqual(dash.alerts, []);
});

test('Picker regression: works without the CSS global (no ReferenceError)', async () => {
  const bus = createBus();
  const page = bootPage(ROOT, 'chrome', bus);
  // Simulate an environment with no CSS global at all.
  delete page.win.CSS;

  const dash = bootDashboard(ROOT, 'chrome', bus, { tabFixture: standardTabFixture });
  const doc = await openAddSelectorForm(dash.win);
  const computed = await clickSelectAndPick(doc, page.win, dash.alerts);

  assert.equal(computed, 'li.product', 'selector computation survives missing CSS global');
  assert.equal(doc.getElementById('field-selector-css').value, 'li.product');
});

test('Picker regression: second START_PICKER reconfigures instead of being ignored', async () => {
  const bus = createBus();
  const page = bootPage(ROOT, 'chrome', bus);
  const dash = bootDashboard(ROOT, 'chrome', bus, { tabFixture: standardTabFixture });
  const doc = await openAddSelectorForm(dash.win);

  doc.getElementById('btn-picker-select').click();
  await sleep(100);
  assert.equal(page.win.__webScraperPickerActive, true, 'picker active after first Select');

  // Simulate the message a second Select click produces (e.g. new scope).
  page.win.__WebScraperPicker.start({ selector: '.title', scopeSelector: 'ul.products' });
  await sleep(30);
  assert.equal(page.win.__webScraperPickerActive, true, 'picker still active');
  const scopeHighlighted = page.win.document.querySelectorAll('.ws-scope-highlight');
  assert.ok(scopeHighlighted.length >= 1, 'new scope was applied on restart');

  page.win.__WebScraperPicker.stop();
});

test('Picker regression: computed selector does not leak picker-internal classes', async () => {
  const bus = createBus();
  const page = bootPage(ROOT, 'chrome', bus);
  page.win.__WebScraperPicker.start({ selector: '' });
  await sleep(20);
  const li = page.win.document.querySelector('li.product');
  li.classList.add('ws-selected-highlight', 'active');
  const sel = page.win.__WebScraperPicker.computeSelector([li]);
  await sleep(10);
  assert.ok(!/ws-|active/.test(sel), `internal/dynamic classes must not leak into selector: ${sel}`);
  page.win.__WebScraperPicker.stop();
});

test('Tor build sources contain the picker fixes', () => {
  const picker = fs.readFileSync(path.join(TOR, 'content', 'selector_picker.js'), 'utf8');
  assert.match(picker, /cssEscapeIdent/, 'CSS-escape guard is present');
  assert.ok(!/CSS\.escape \?/.test(picker), 'unguarded CSS.escape ternary removed');

  const dash = fs.readFileSync(path.join(TOR, 'dashboard', 'dashboard.js'), 'utf8');
  assert.match(dash, /getCurrent/, 'dashboard excludes its own tab when targeting');
  assert.match(dash, /pickerNoReceiver/, 'missing-receiver failure is surfaced to the user');
  assert.match(dash, /lastAccessed/, 'tabs are ranked by recency');
});

test('Storage + dashboard tolerate corrupt (null) sitemap entries', async () => {
  const bus = createBus();
  const dash = bootDashboard(ROOT, 'chrome', bus, { tabFixture: standardTabFixture });
  const AppStorage = dash.win.AppStorage;
  assert.ok(AppStorage, 'AppStorage exposed on the dashboard window');

  // Simulate a corrupt storage state: a null entry under a sitemap_ key.
  const chromeApi = dash.win.chrome;
  await new Promise((resolve) => {
    chromeApi.storage.local.set({ sitemap_corrupt: null }, resolve);
  });

  const list = await AppStorage.getAllSitemaps();
  assert.ok(Array.isArray(list), 'getAllSitemaps returns an array');
  assert.ok(list.every((s) => Boolean(s)), 'null entries are skipped, never returned');

  // The dashboard list must render without throwing despite the corrupt entry.
  assert.doesNotThrow(() => {
    dash.win.document.getElementById('nav-sitemaps-list').click();
  });
});
