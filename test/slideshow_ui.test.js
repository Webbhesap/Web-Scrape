/**
 * Slideshow behaviour tests.
 *
 * Covers the interactive requirements of the image slideshow overlay:
 *  - no +/- stepper buttons around the interval input
 *  - the download button saves the displayed image (not a ZIP)
 *  - the cursor is hidden together with the auto-hiding chrome
 *  - the mouse wheel steps between images
 *  - the overlay stays closed until it is explicitly opened
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

const SCRIPTS = [
  'lib/csv.js',
  'lib/xlsx.js',
  'lib/icons.js',
  'src/engine/UrlRangeExpander.js',
  'src/models/Selector.js',
  'src/models/Sitemap.js',
  'src/engine/CssSelectorGenerator.js',
  'src/engine/SelectorEngine.js',
  'src/engine/DataFlattener.js',
  'src/engine/ScraperEngine.js',
  'src/storage/Storage.js',
  'src/export/Exporter.js',
  'src/ui/SelectorGraph.js',
  'lib/i18n.js',
  'lib/zip.js',
    'lib/undo_stack.js', 'lib/sitemap_templates.js',
  'dashboard/dashboard.js'
];

const IMAGE_ROWS = [
  { title: 'A', photo: 'https://cdn.test/images/alpha-shot.jpg' },
  { title: 'B', photo: 'https://cdn.test/images/beta-shot.png' },
  { title: 'C', photo: 'https://cdn.test/images/gamma-shot.webp' }
];

/**
 * Boots dashboard.html in JSDOM with stubbed chrome/network APIs and
 * pre-seeded scraped image data, then opens the gallery view.
 */
async function bootDashboard() {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const window = dom.window;

  // JSDOM does not expose TextEncoder/TextDecoder on the window object even
  // though every supported browser does; lib/zip.js relies on it.
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
  if (typeof window.TextDecoder === 'undefined') window.TextDecoder = TextDecoder;

  const store = {
    sitemap_images: {
      _id: 'images',
      name: 'images',
      startUrl: ['https://cdn.test/'],
      selectors: []
    },
    data_images: { records: IMAGE_ROWS }
  };

  window.chrome = {
    runtime: {
      getURL: (p) => p,
      sendMessage: () => {},
      onMessage: { addListener: () => {} }
    },
    storage: {
      local: {
        get: (keys, cb) => {
          if (typeof keys === 'function') return keys({ ...store });
          if (keys === null || keys === undefined) return cb({ ...store });
          if (typeof keys === 'string') return cb(store[keys] !== undefined ? { [keys]: store[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => {
            if (store[k] !== undefined) out[k] = store[k];
          });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(store, obj); if (cb) cb(); },
        remove: (keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
          if (cb) cb();
        }
      }
    }
  };

  // Track blob URLs and anchor clicks so downloads can be asserted.
  const downloads = [];
  window.URL.createObjectURL = () => 'blob:mock-object-url';
  window.URL.revokeObjectURL = () => {};

  const fetchCalls = [];
  window.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
      blob: async () => new window.Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    };
  };

  const origClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ href: this.getAttribute('href'), download: this.getAttribute('download') });
    if (typeof origClick === 'function' && this.dataset.realClick) origClick.call(this);
  };

  for (const rel of SCRIPTS) {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(el);
  }

  // Let init()'s async storage work settle.
  await new Promise((r) => setTimeout(r, 60));

  return { dom, window, document: window.document, downloads, fetchCalls };
}

/** Opens a sitemap and its gallery via the real UI navigation path. */
async function openGalleryView(window) {
  const document = window.document;
  const link = document.querySelector('#tbody-sitemaps .sitemap-open-link');
  assert.ok(link, 'seeded sitemap row should be rendered');
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 40));

  document.getElementById('nav-sitemap-gallery')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));

  const cards = document.querySelectorAll('#gallery-grid .gallery-card img');
  assert.equal(cards.length, IMAGE_ROWS.length, 'gallery should render one card per image');
  return cards;
}

test('Slideshow - interval input has no +/- stepper buttons', async () => {
  const { dom, document } = await bootDashboard();

  assert.equal(document.getElementById('btn-interval-down'), null, '"-" stepper button must be removed');
  assert.equal(document.getElementById('btn-interval-up'), null, '"+" stepper button must be removed');
  assert.equal(document.querySelectorAll('.slideshow-dur .ss-step').length, 0, 'no .ss-step buttons should remain');

  const input = document.getElementById('slideshow-interval');
  assert.ok(input, 'interval input still exists');
  assert.equal(input.getAttribute('type'), 'number', 'interval stays a native number input with themed arrows');

  dom.window.close();
});

test('Slideshow - stays closed on load and opens only on demand', async () => {
  const { dom, window, document } = await bootDashboard();
  const overlay = document.getElementById('slideshow-overlay');

  assert.ok(overlay.hasAttribute('hidden'), 'overlay must start hidden');
  assert.ok(!overlay.classList.contains('open'), 'overlay must not start open');

  const cards = await openGalleryView(window);
  assert.ok(overlay.hasAttribute('hidden'), 'opening the gallery must not open the slideshow');

  cards[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(!overlay.hasAttribute('hidden'), 'clicking a thumbnail opens the overlay');
  assert.ok(overlay.classList.contains('open'), 'overlay gets the .open class');
  assert.equal(document.getElementById('slideshow-image').src, IMAGE_ROWS[1].photo, 'shows the clicked image');

  document.getElementById('btn-slideshow-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(document.getElementById('slideshow-overlay').hasAttribute('hidden'), 'close hides the overlay again');

  dom.window.close();
});

test('Slideshow - mouse wheel navigates between images', async () => {
  const { dom, window, document } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const overlay = document.getElementById('slideshow-overlay');
  const img = document.getElementById('slideshow-image');
  assert.equal(img.src, IMAGE_ROWS[0].photo);

  const wheel = (deltaY) => {
    const ev = new window.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    overlay.dispatchEvent(ev);
    return ev;
  };

  // Wheel down -> next image, and the page must not scroll behind the overlay.
  const down = wheel(120);
  assert.equal(img.src, IMAGE_ROWS[1].photo, 'wheel down advances to the next image');
  assert.ok(down.defaultPrevented, 'wheel event is consumed by the overlay');

  await new Promise((r) => setTimeout(r, 150));
  wheel(120);
  assert.equal(img.src, IMAGE_ROWS[2].photo, 'wheel down again advances further');

  await new Promise((r) => setTimeout(r, 150));
  wheel(-120);
  assert.equal(img.src, IMAGE_ROWS[1].photo, 'wheel up goes back');

  // Wrap-around from the first image backwards.
  await new Promise((r) => setTimeout(r, 150));
  wheel(-120);
  await new Promise((r) => setTimeout(r, 150));
  wheel(-120);
  assert.equal(img.src, IMAGE_ROWS[2].photo, 'wheel wraps around at the start');

  dom.window.close();
});

test('Slideshow - rapid wheel bursts are throttled to one step', async () => {
  const { dom, window, document } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const overlay = document.getElementById('slideshow-overlay');
  for (let i = 0; i < 5; i++) {
    overlay.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
  }

  assert.equal(
    document.getElementById('slideshow-image').src,
    IMAGE_ROWS[1].photo,
    'an inertial trackpad burst advances exactly one image'
  );

  dom.window.close();
});

test('Slideshow - download button saves the displayed image, not a ZIP', async () => {
  const { dom, window, document, downloads, fetchCalls } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const btn = document.getElementById('btn-slide-download');
  assert.ok(btn, 'slideshow has a direct image download button');
  assert.equal(document.getElementById('btn-slide-zip'), null, 'the old ZIP button is gone from the slideshow');

  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(downloads.length, 1, 'exactly one download is triggered');
  assert.equal(downloads[0].download, 'beta-shot.png', 'file keeps the original image name and extension');
  assert.ok(!/\.zip$/i.test(downloads[0].download), 'download must not be a ZIP archive');
  assert.ok(
    fetchCalls.includes(IMAGE_ROWS[1].photo),
    'the currently displayed image URL is the one fetched'
  );

  dom.window.close();
});

test('Slideshow - gallery toolbar keeps its ZIP bulk actions', async () => {
  const { dom, window, document, downloads } = await bootDashboard();
  await openGalleryView(window);

  const zipAll = document.getElementById('btn-gallery-zip-all');
  assert.ok(zipAll, 'gallery still offers "Download ZIP" for bulk export');
  assert.ok(document.getElementById('btn-gallery-zip-selected'), 'gallery still offers "ZIP selected"');

  zipAll.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(downloads.length, 1, 'bulk export produces a download');
  assert.equal(downloads[0].download, 'gallery.zip', 'bulk export is still a ZIP');

  dom.window.close();
});

test('Slideshow - chrome and mouse cursor hide together after idle timeout', async () => {
  const { dom, window, document } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const overlay = document.getElementById('slideshow-overlay');
  const chromeEl = document.getElementById('slideshow-chrome');

  assert.ok(chromeEl.classList.contains('show'), 'controls are visible right after opening');
  assert.ok(!overlay.classList.contains('idle'), 'cursor is visible right after opening');

  // Auto-hide fires 2s after the last real pointer movement.
  await new Promise((r) => setTimeout(r, 2200));
  assert.ok(!chromeEl.classList.contains('show'), 'controls auto-hide when idle');
  assert.ok(overlay.classList.contains('idle'), 'cursor is hidden together with the controls');

  // Moving the mouse brings both back.
  overlay.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 200 }));
  assert.ok(chromeEl.classList.contains('show'), 'pointer movement restores the controls');
  assert.ok(!overlay.classList.contains('idle'), 'pointer movement restores the cursor');

  // A duplicate mousemove at the same coordinates (what hiding the cursor can
  // emit) must not keep the chrome alive forever.
  await new Promise((r) => setTimeout(r, 2200));
  assert.ok(overlay.classList.contains('idle'), 'idle state is reached again');

  dom.window.close();
});

test('Slideshow - closing resets the idle/cursor state and stops autoplay', async () => {
  const { dom, window, document } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const play = document.getElementById('btn-slide-play');
  play.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(play.textContent, '❚❚', 'play toggles to pause glyph');

  document.getElementById('btn-slideshow-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const overlay = document.getElementById('slideshow-overlay');
  assert.ok(overlay.hasAttribute('hidden'), 'overlay hidden after close');
  assert.ok(!overlay.classList.contains('idle'), 'idle/cursor-hiding class cleared on close');
  assert.ok(!document.getElementById('slideshow-chrome').classList.contains('show'), 'chrome hidden on close');

  // The autoplay timer must not keep advancing slides after closing.
  const before = document.getElementById('slideshow-image').src;
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(document.getElementById('slideshow-image').src, before, 'autoplay stopped');

  dom.window.close();
});

test('Slideshow - counter reflects the current position', async () => {
  const { dom, window, document } = await bootDashboard();
  const cards = await openGalleryView(window);
  cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const counter = document.getElementById('slideshow-counter');
  assert.equal(counter.textContent, '1 / 3');

  document.getElementById('btn-slide-next').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(counter.textContent, '2 / 3');

  document.getElementById('btn-slide-prev').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(counter.textContent, '1 / 3');

  dom.window.close();
});
