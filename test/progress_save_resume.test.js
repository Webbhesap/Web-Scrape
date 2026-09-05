/**
 * P1.2 (dashboard level) — save a crawl mid-run, stop it, then resume from
 * the saved file through the real UI (buttons + hidden file input).
 *
 * Boots the real dashboard with the fetch fallback (no chrome.tabs in the
 * mock) and a window.fetch polyfill, drives the whole flow:
 *   create sitemap + selectors -> Start -> Save progress -> Stop
 *   -> Resume from file -> crawl finishes and records are stored.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const LIST_HTML = `<!DOCTYPE html><html><body>
  <div class="item"><span class="name">A</span><a class="next" href="https://shop.test/detail-1">1</a></div>
  <div class="item"><span class="name">B</span><a class="next" href="https://shop.test/detail-2">2</a></div>
</body></html>`;
const DETAIL_HTML = (t) => `<!DOCTYPE html><html><body>
  <div class="detail-box"><span class="dtitle">${t}</span></div>
</body></html>`;

const PAGES = {
  'https://shop.test/list': LIST_HTML,
  'https://shop.test/detail-1': DETAIL_HTML('Detail One'),
  'https://shop.test/detail-2': DETAIL_HTML('Detail Two')
};

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

  // --- fetch fallback + download plumbing polyfills (jsdom gaps) ---
  const fetched = [];
  win.fetch = async (url) => {
    fetched.push(url);
    if (!PAGES[url]) return { ok: false, status: 404, statusText: 'Not Found' };
    return { ok: true, status: 200, statusText: 'OK', url, text: async () => PAGES[url] };
  };
  const createdBlobs = [];
  win.URL.createObjectURL = (blob) => { createdBlobs.push(blob); return 'blob:fake-' + createdBlobs.length; };
  win.URL.revokeObjectURL = () => {};

  // --- chrome mock (storage only: forces the fetch fallback fetcher) ---
  const db = {};
  const chromeMock = {
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
  win.chrome = chromeMock;
  win.alert = (m) => { win.__alerts = win.__alerts || []; win.__alerts.push(String(m)); };
  win.confirm = () => true;

  const SCRIPTS = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js',
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

  return { win, db, fetched, createdBlobs };
}

async function createSitemapWithSelectors(win, id) {
  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = id;
  doc.getElementById('field-sitemap-urls').value = 'https://shop.test/list';
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);

  const addSelector = async ({ id: sid, type, css, multiple, linkType, parent }) => {
    doc.getElementById('btn-add-selector').click();
    await sleep(20);
    doc.getElementById('field-selector-id').value = sid;
    doc.getElementById('field-selector-css').value = css;
    const typeSel = doc.getElementById('field-selector-type');
    typeSel.value = type;
    typeSel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await sleep(10);
    if (multiple) doc.getElementById('field-selector-multiple').checked = true;
    if (linkType) doc.getElementById('field-link-type').value = linkType;
    const box = Array.from(doc.getElementById('parent-selectors-list').querySelectorAll('input[type="checkbox"]'))
      .find((c) => c.value === parent);
    box.checked = true;
    await new Promise((r) => {
      doc.getElementById('form-selector-edit').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
      setTimeout(r, 50);
    });
  };

  // Branch model: detail pages are crawled under the LINK id, so the
  // detail container must hang off `more`, not off the item container.
  await addSelector({ id: 'item', type: 'SelectorElement', css: '.item', multiple: true, parent: '_root' });
  await addSelector({ id: 'name', type: 'SelectorText', css: '.name', parent: 'item' });
  await addSelector({ id: 'more', type: 'SelectorLink', css: 'a.next', linkType: 'linkFromHref', parent: 'item' });
  await addSelector({ id: 'detail', type: 'SelectorElement', css: '.detail-box', multiple: true, parent: 'more' });
  await addSelector({ id: 'dtitle', type: 'SelectorText', css: '.dtitle', parent: 'detail' });
}

function waitFor(fn, timeout = 15000, label = 'condition') {
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
    }, 20);
  });
}

test('P1.2 UI - save progress mid-run, stop, resume from file completes the crawl', async () => {
  const { win, db, fetched, createdBlobs } = bootDashboard();
  const doc = win.document;

  await waitFor(() => doc.getElementById('view-sitemaps').classList.contains('active'), 5000, 'dashboard booted');
  await createSitemapWithSelectors(win, 'prog_test');
  assert.ok(db.sitemap_prog_test !== undefined, 'sitemap was saved');

  // Go to the scrape view and start the crawl (fetch fallback). The 3s
  // page delay keeps the crawl slow enough to snapshot it mid-run.
  doc.getElementById('nav-sitemap-scrape').click();
  await sleep(30);
  doc.getElementById('scrape-request-interval').value = '0';
  doc.getElementById('scrape-page-delay').value = '3000';
  doc.getElementById('btn-start-scraping').click();

  // Wait until the list page was processed and both detail pages queued.
  await waitFor(() => doc.getElementById('metric-queue').textContent === '2', 10000, 'detail pages queued');
  doc.getElementById('btn-scrape-save-progress').click();
  await sleep(50);
  assert.equal(createdBlobs.length, 1, 'progress download produced a blob');
  // jsdom's Blob has no .text(); read it through FileReader.
  const blobText = await new Promise((resolve, reject) => {
    const fr = new win.FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsText(createdBlobs[0]);
  });
  const saved = JSON.parse(blobText);
  assert.equal(saved.format, 'web-scraper-queue-state');
  assert.equal(saved.sitemapId, 'prog_test');
  // By save time the next detail page was already dequeued for processing,
  // so at least one detail page must remain in the saved queue — and every
  // queued URL must be an unvisited detail page.
  assert.ok(saved.queue.length >= 1, 'work remained in the queue at save time');
  assert.ok(saved.queue.every((j) => j.url.startsWith('https://shop.test/detail')), 'only detail pages remain queued');
  assert.ok(saved.visitedUrls.includes('https://shop.test/list'), 'list page is marked visited');

  // Stop the crawl. The engine drains its current page (the in-flight
  // detail-1) before the stop takes effect — its finish handler stores the
  // partial records, which we APPEND to on resume.
  doc.getElementById('btn-scrape-stop').click();
  await waitFor(() => doc.getElementById('scrape-status-badge').textContent.toUpperCase() === 'STOPPED', 15000, 'crawl stopped');
  // Wait for the stopped run's finish handler to persist the partial data
  // (and for isRunning to clear — the resume guard refuses a running engine).
  await waitFor(() => db.data_prog_test !== undefined, 15000, 'stopped run persisted its partial data');

  // Resume from the saved file via the hidden file input (append mode so
  // the resumed records combine with the partial data saved on stop).
  doc.getElementById('scrape-data-mode').value = 'append';
  const file = new win.File([JSON.stringify(saved)], 'prog_test_progress.json', { type: 'application/json' });
  const fileInput = doc.getElementById('file-scrape-state');
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new win.Event('change', { bubbles: true }));

  // The crawl must continue and finish with BOTH detail records present.
  await waitFor(() => {
    const entry = db.data_prog_test && (typeof db.data_prog_test === 'string' ? JSON.parse(db.data_prog_test) : db.data_prog_test);
    return entry && entry.records && entry.records.length >= 2;
  }, 25000, 'resumed crawl stored both detail records');
  const stored = typeof db.data_prog_test === 'string' ? JSON.parse(db.data_prog_test) : db.data_prog_test;
  const rows = stored.records || [];
  // The record objects come from the jsdom realm — re-wrap into a Node-realm
  // array for a clean deepStrictEqual.
  const titles = [...rows.map((r) => String(r.dtitle)).filter(Boolean)].sort();
  assert.deepEqual(titles, ['Detail One', 'Detail Two'], 'both detail pages were scraped across stop+resume');
  assert.equal(fetched.filter((u) => u === 'https://shop.test/list').length, 1, 'list page fetched exactly once (no re-fetch on resume)');

  win.close();
});

test('P1.2 UI - HTML contains the save/resume controls (dashboard + devtools panel)', () => {
  for (const rel of ['dashboard/dashboard.html', 'devtools/panel.html']) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(html.includes('id="btn-scrape-save-progress"'), `${rel}: save-progress button`);
    assert.ok(html.includes('id="btn-scrape-resume-file"'), `${rel}: resume button`);
    assert.ok(html.includes('id="file-scrape-state"'), `${rel}: hidden file input`);
  }
  const js = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.js'), 'utf8');
  assert.ok(js.includes('function saveScrapeProgress'), 'saveScrapeProgress implemented');
  assert.ok(js.includes('function resumeScrapeFromFile'), 'resumeScrapeFromFile implemented');
  assert.ok(js.includes('function buildEngineOptions'), 'engine options are shared between start and resume');
  assert.ok(js.includes('function attachEngineEvents'), 'event wiring is shared between start and resume');
  assert.ok(js.includes("startFromState()"), 'resume uses the engine continuation API');
});
