/**
 * P1.1 — "Discard initial elements" (Plan.md 2.9 / roadmap P1.1).
 *
 * The checkbox existed in the click-selector form and persisted on the model,
 * but nothing in the execution path ever honoured it. Now:
 *   content script: before clicking, tags every element matching the
 *                   sitemap's SelectorElement containers with
 *                   data-ws-initial (they are the "already loaded" content);
 *   ScraperEngine:  with options.discardInitialElements it drops container
 *                   matches carrying that tag (top-level AND nested), and
 *                   removes the tags after the page is processed so they
 *                   never leak into scraped HTML or the live page.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

function loadScript(win, rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const el = win.document.createElement('script');
  el.textContent = code;
  win.document.body.appendChild(el);
}

/** jsdom has no layout engine: make visibility checks behave like a browser. */
function polyfillLayout(win) {
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.parentElement; }
  });
  win.HTMLElement.prototype.scrollIntoView = function () { /* no-op in jsdom */ };
}

function runEngine(sitemap, doc, options = {}) {
  const engine = new ScraperEngine(sitemap, Object.assign({
    requestInterval: 0,
    pageLoadDelay: 0,
    maxPages: 1,
    fetcher: async () => ({ document: doc, url: 'https://lazy.test/page' })
  }, options));
  return new Promise((resolve, reject) => {
    engine.on('finish', (summary) => resolve(summary));
    engine.on('error', (err) => {
      if (err && err.message && /No valid start URLs/.test(err.message)) return;
    });
    engine.start().catch(reject);
  });
}

function makeLazyPageHtml() {
  // 2 cards were in the initial HTML; the content script tagged them.
  // 1 card was appended by the "load more" click after the tag snapshot.
  return `<!DOCTYPE html><html><body>
    <div class="card" data-ws-initial="1"><span class="name">Initial A</span></div>
    <div class="card" data-ws-initial="1"><span class="name">Initial B</span></div>
    <div class="card"><span class="name">Lazy Loaded</span></div>
    <button class="load-more">Load more</button>
  </body></html>`;
}

test('Content script - marks pre-click container matches with data-ws-initial', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div class="card"><span>One</span></div>
    <div class="card"><span>Two</span></div>
    <button id="more" class="load-more">Load more</button>
    <script>
      document.getElementById('more').addEventListener('click', () => {
        const d = document.createElement('div');
        d.className = 'card';
        d.textContent = 'Three (lazy)';
        document.body.appendChild(d);
      });
    <\/script>
  </body></html>`, { runScripts: 'dangerously', url: 'https://lazy.test/page' });
  const win = dom.window;
  polyfillLayout(win);

  const responses = [];
  win.chrome = {
    runtime: {
      onMessage: {
        addListener: (fn) => { win.__wsContentListener = fn; }
      },
      sendMessage: () => {}
    }
  };
  loadScript(win, 'content/scraper_content.js');
  assert.ok(win.__wsContentListener, 'content script registered its message listener');

  await new Promise((resolve) => {
    win.__wsContentListener(
      {
        type: 'EXECUTE_PAGE_ACTIONS',
        actions: {
          click: {
            clickElementSelector: 'button.load-more',
            clickType: 'clickOnce',
            clickDelay: 10,
            maxClicks: 2,
            discardInitialElements: true,
            initialSelectors: ['.card']
          }
        }
      },
      {},
      (resp) => { responses.push(resp); resolve(); }
    );
  });

  assert.equal(responses.length, 1, 'action response sent');
  assert.equal(responses[0].success, true, 'actions succeeded');

  const cards = Array.from(win.document.querySelectorAll('.card'));
  assert.equal(cards.length, 3, 'the click really appended a new card');
  assert.equal(cards[0].getAttribute('data-ws-initial'), '1', 'initial card tagged');
  assert.equal(cards[1].getAttribute('data-ws-initial'), '1', 'initial card tagged');
  assert.equal(cards[2].hasAttribute('data-ws-initial'), false, 'click-loaded card NOT tagged');
});

test('Content script - without the flag nothing is tagged', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div class="card">A</div>
    <button class="load-more">More</button>
  </body></html>`, { runScripts: 'dangerously', url: 'https://lazy.test/page' });
  const win = dom.window;
  polyfillLayout(win);
  win.chrome = { runtime: { onMessage: { addListener: (fn) => { win.__wsContentListener = fn; } }, sendMessage: () => {} } };
  loadScript(win, 'content/scraper_content.js');

  await new Promise((resolve) => {
    win.__wsContentListener(
      { type: 'EXECUTE_PAGE_ACTIONS', actions: { click: { clickElementSelector: 'button.load-more', clickType: 'clickOnce', clickDelay: 10 } } },
      {},
      () => resolve()
    );
  });
  assert.equal(win.document.querySelector('.card').hasAttribute('data-ws-initial'), false, 'no tagging when the option is off');
});

test('Engine - discardInitialElements keeps only click-loaded container records', async () => {
  const sitemap = new Sitemap({
    _id: 'lazy_store',
    name: 'Lazy store',
    startUrl: ['https://lazy.test/page'],
    selectors: [
      { id: 'item', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.card', multiple: true },
      { id: 'name', parentSelectors: ['item'], type: 'SelectorText', selector: '.name' },
      { id: 'loadmore', parentSelectors: ['_root'], type: 'SelectorElementClick', clickElementSelector: 'button.load-more', clickType: 'clickOnce', discardInitialElements: true }
    ]
  });

  // Flag ON: only the untagged (click-loaded) card becomes a record.
  const docOn = new JSDOM(makeLazyPageHtml()).window.document;
  const sumOn = await runEngine(sitemap, docOn, { discardInitialElements: true });
  assert.equal(sumOn.totalRecords, 1, 'exactly one record: the lazy-loaded card');
  assert.equal(sumOn.results[0].name, 'Lazy Loaded');
  assert.equal(docOn.querySelectorAll('[data-ws-initial]').length, 0, 'tags are cleaned up after processing');

  // Flag OFF (default): every card becomes a record, tags untouched by us.
  const docOff = new JSDOM(makeLazyPageHtml()).window.document;
  const sumOff = await runEngine(sitemap, docOff, {});
  assert.equal(sumOff.totalRecords, 3, 'all cards scraped when the flag is off');
});

test('Engine - nested element containers are filtered too', async () => {
  const sitemap = new Sitemap({
    _id: 'nested_lazy',
    name: 'Nested lazy',
    startUrl: ['https://lazy.test/page'],
    selectors: [
      { id: 'item', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.card', multiple: true },
      { id: 'tag', parentSelectors: ['item'], type: 'SelectorElement', selector: '.tag', multiple: true },
      { id: 'tagName', parentSelectors: ['tag'], type: 'SelectorText', selector: '.t' },
      { id: 'loadmore', parentSelectors: ['_root'], type: 'SelectorElementClick', clickElementSelector: 'button.load-more', clickType: 'clickOnce', discardInitialElements: true }
    ]
  });
  const html = `<!DOCTYPE html><html><body>
    <div class="card">
      <div class="tag" data-ws-initial="1"><span class="t">old-tag</span></div>
      <div class="tag"><span class="t">new-tag</span></div>
    </div>
  </body></html>`;
  const doc = new JSDOM(html).window.document;
  const sum = await runEngine(sitemap, doc, { discardInitialElements: true });
  assert.equal(sum.totalRecords, 1, 'only the new nested tag record survives');
  assert.equal(sum.results[0].tagName, 'new-tag');
});

test('Engine - fetch mode (no clicks, no tags) is unaffected by the flag', async () => {
  const sitemap = new Sitemap({
    _id: 'plain',
    name: 'Plain',
    startUrl: ['https://lazy.test/page'],
    selectors: [
      { id: 'item', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.card', multiple: true },
      { id: 'name', parentSelectors: ['item'], type: 'SelectorText', selector: '.name' }
    ]
  });
  const html = `<!DOCTYPE html><html><body>
    <div class="card"><span class="name">A</span></div>
    <div class="card"><span class="name">B</span></div>
  </body></html>`;
  const doc = new JSDOM(html).window.document;
  const sum = await runEngine(sitemap, doc, { discardInitialElements: true });
  assert.equal(sum.totalRecords, 2, 'untagged content is kept even with the flag on');
});
