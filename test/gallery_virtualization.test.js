/**
 * P2.1 — gallery/viewer virtualization (Plan.md roadmap item 5:
 * "Galeri/görüntüleyici sanrellaştırma (10k+ satır/görsel)").
 *
 * Before this change the image gallery put EVERY card (img + input +
 * buttons) into the DOM at once — 10,000 images meant 10,000 card trees.
 * Now galleries above a threshold render only the rows inside the visible
 * scroll window (plus a buffer); selection state moved from the DOM
 * checkboxes into state so select-all / zip-selected keep working with
 * off-screen cards.
 *
 * Boots the real dashboard (fetch fallback) and drives the real UI:
 * create sitemap + image selector -> scrape a 1,000-image page -> open
 * the gallery -> assert the DOM stays bounded, scrolling moves the
 * window, and selection survives window re-renders.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const N_IMAGES = 1000;

function bigListHtml(n) {
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push(`<div class="item"><img class="pic" src="https://img.test/i${i}.jpg"></div>`);
  }
  return `<!DOCTYPE html><html><body>${items.join('')}</body></html>`;
}

const PAGES = {
  'https://gall.test/big': bigListHtml(N_IMAGES),
  'https://gall.test/small': bigListHtml(50)
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

  const fetched = [];
  win.fetch = async (url) => {
    fetched.push(String(url));
    if (!PAGES[url]) return { ok: false, status: 404, statusText: 'Not Found' };
    return { ok: true, status: 200, statusText: 'OK', url, text: async () => PAGES[url] };
  };
  const createdBlobs = [];
  win.URL.createObjectURL = (blob) => { createdBlobs.push(blob); return 'blob:fake-' + createdBlobs.length; };
  win.URL.revokeObjectURL = () => {};

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

async function createImageSitemap(win, id, url) {
  const doc = win.document;
  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = id;
  doc.getElementById('field-sitemap-urls').value = url;
  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(60);

  const addSelector = async ({ id: sid, type, css, multiple, parent }) => {
    doc.getElementById('btn-add-selector').click();
    await sleep(20);
    doc.getElementById('field-selector-id').value = sid;
    doc.getElementById('field-selector-css').value = css;
    const typeSel = doc.getElementById('field-selector-type');
    typeSel.value = type;
    typeSel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await sleep(10);
    if (multiple) doc.getElementById('field-selector-multiple').checked = true;
    const box = Array.from(doc.getElementById('parent-selectors-list').querySelectorAll('input[type="checkbox"]'))
      .find((c) => c.value === parent);
    box.checked = true;
    await new Promise((r) => {
      doc.getElementById('form-selector-edit').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
      setTimeout(r, 50);
    });
  };

  await addSelector({ id: 'item', type: 'SelectorElement', css: '.item', multiple: true, parent: '_root' });
  await addSelector({ id: 'pic', type: 'SelectorImage', css: 'img.pic', parent: 'item' });
}

async function scrapeSitemap(win, id) {
  const doc = win.document;
  // The freshly created sitemap is already the current one; just switch to
  // the scrape view and start.
  const navScrape = doc.getElementById('nav-sitemap-scrape');
  if (navScrape) navScrape.click();
  await sleep(40);
  doc.getElementById('btn-start-scraping').click();
  // Wait until the crawl is done: queue badge back to 0 and status idle/finished.
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const badge = doc.getElementById('scrape-status-badge');
      const queue = doc.getElementById('metric-queue');
      const done = badge && /FINISHED|IDLE|STOPPED/i.test(badge.textContent) && queue && queue.textContent === '0';
      if (done) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > 30000) { clearInterval(timer); reject(new Error('scrape did not finish in time')); }
    }, 25);
  });
  await sleep(60);
}

function openGalleryView(win) {
  const doc = win.document;
  const nav = doc.getElementById('nav-sitemap-gallery');
  nav.click();
  return sleep(60);
}

function scrollViewport(win, top) {
  const viewport = win.document.getElementById('gallery-viewport');
  viewport.scrollTop = top;
  if (viewport.onscroll) viewport.onscroll();
  return sleep(60); // let the rAF-throttled window render land
}

test('P2.1 - 1000-image gallery virtualizes: bounded DOM, scroll moves the window', async () => {
  const { win } = bootDashboard();
  const doc = win.document;

  await createImageSitemap(win, 'gall_big', 'https://gall.test/big');
  await scrapeSitemap(win, 'gall_big');
  await openGalleryView(win);

  const view = doc.getElementById('view-gallery');
  assert.ok(view.classList.contains('virtual-gallery'), 'large gallery switches to virtual mode');

  const grid = doc.getElementById('gallery-grid');
  const cards = () => grid.querySelectorAll('.gallery-card');
  assert.ok(cards().length > 0, 'the visible window has cards');
  assert.ok(cards().length < 300, `DOM stays bounded in virtual mode (${cards().length} cards for ${N_IMAGES} images)`);

  // First image rendered, last image NOT in the DOM.
  assert.ok(grid.querySelector('.gallery-card[data-gidx="0"]'), 'first card is in the initial window');
  assert.equal(grid.querySelector(`.gallery-card[data-gidx="${N_IMAGES - 1}"]`), null, 'last card is not rendered yet');

  // The grid's explicit height reflects the full dataset (scrollable extent).
  const gridH = parseInt(grid.style.height, 10);
  assert.ok(gridH > 0, 'grid height is set explicitly');

  // Scroll to the bottom: the window must contain the LAST card now.
  const viewport = doc.getElementById('gallery-viewport');
  // jsdom has no layout: scrollTop accepts any value the code can read.
  viewport.scrollTop = 10_000_000;
  if (viewport.onscroll) viewport.onscroll();
  await sleep(60);
  assert.ok(grid.querySelector(`.gallery-card[data-gidx="${N_IMAGES - 1}"]`), 'scrolling down renders the last card');
  assert.equal(grid.querySelector('.gallery-card[data-gidx="0"]'), null, 'scrolling down unmounts the first card');

  win.close();
});

test('P2.1 - selection is state-based: select-all + zip-selected see off-screen cards', async () => {
  const { win } = bootDashboard();
  const doc = win.document;

  await createImageSitemap(win, 'gall_sel', 'https://gall.test/big');
  await scrapeSitemap(win, 'gall_sel');
  await openGalleryView(win);

  // Select all — only ~a few dozen cards are in the DOM, so a DOM-counting
  // implementation could only ever see those.
  doc.getElementById('btn-gallery-select-all').click();
  await sleep(30);
  const badge = doc.getElementById('gallery-selected-badge');
  assert.ok(badge.textContent.includes(String(N_IMAGES)), `badge reports all ${N_IMAGES} selected (got: ${badge.textContent})`);

  // Every visible checkbox is checked.
  const visible = doc.querySelectorAll('#gallery-grid .gallery-select');
  assert.ok(visible.length > 0);
  visible.forEach((chk) => assert.equal(chk.checked, true, 'visible checkbox checked'));

  // Scroll far away and back: the selection must survive the re-render.
  await scrollViewport(win, 5_000_000);
  const visibleAfter = doc.querySelectorAll('#gallery-grid .gallery-select');
  assert.ok(visibleAfter.length > 0);
  visibleAfter.forEach((chk) => assert.equal(chk.checked, true, 'selection preserved across window re-render'));
  assert.ok(badge.textContent.includes(String(N_IMAGES)), 'badge still reports the full selection');

  // Deselect one visible card: badge drops by exactly one.
  const first = visibleAfter[0];
  first.click();
  first.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.ok(badge.textContent.includes(String(N_IMAGES - 1)), `deselect updates the badge (${badge.textContent})`);

  win.close();
});

test('P2.1 - small galleries (<= threshold) keep the plain paginable grid', async () => {
  const { win } = bootDashboard();
  const doc = win.document;

  await createImageSitemap(win, 'gall_small', 'https://gall.test/small');
  await scrapeSitemap(win, 'gall_small');
  await openGalleryView(win);

  const view = doc.getElementById('view-gallery');
  assert.equal(view.classList.contains('virtual-gallery'), false, 'small gallery stays in plain mode');
  const cards = doc.querySelectorAll('#gallery-grid .gallery-card');
  assert.equal(cards.length, 50, 'all 50 cards rendered directly');
  assert.equal(doc.getElementById('gallery-grid').style.height, '', 'no explicit virtual height in plain mode');

  win.close();
});
