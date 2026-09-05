/**
 * Third review round — regression tests for the code-review findings.
 *
 * Every test here locks a concrete defect that was found by reading the whole
 * tree (static analysis + measurement), not a hypothetical one. Each was
 * verified RED against the pre-fix code before being turned GREEN.
 *
 *  1. ScraperEngine       — duplicate `concurrency` key in the option defaults
 *  2. scraper_content     — clickMore clicked a persistent "load more" button
 *                           exactly ONCE; clickOnce clicked only the first of
 *                           N buttons; clickElementUniquenessType was dead
 *  3. lib/robots          — URIError on malformed percent-encoding escaped and
 *                           aborted the whole crawl; duplicated decision loop
 *                           compiled every path regex twice; a literal `$`
 *                           inside a rule path never matched
 *  4. number parsing      — four independent parsers disagreed: the same cell
 *                           read as 1.234 through a transform and 1234
 *                           through a CSV export (1000x apart)
 *  5. Sitemap             — normalizeImported dropped columnTypes, so an
 *                           export -> import round trip reset every column
 *  6. Selector            — transform normalization depended on a bare global,
 *                           i.e. on script load order
 *  7. SelectorEngine      — queryFirst ran the full shadow-DOM merge before
 *                           the cheap querySelector on the hottest path
 *  8. DataFlattener       — push(...childRows) blew the stack on large sets
 *  9. Exporter.toXML      — recordFields() called per row => quadratic export
 * 10. DownloadManager     — uniqueName() rebuilt a Set per URL => quadratic add
 * 11. lib/zip             — >65535 entries silently produced a corrupt archive
 * 12. background.js       — dead Storage.js import read the WHOLE store on
 *                           every service-worker wake
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TextTransforms = require('../chrome-edge/lib/transforms.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');
const Robots = require('../chrome-edge/lib/robots.js');
const SimpleZip = require('../chrome-edge/lib/zip.js');
const DownloadManager = require('../chrome-edge/lib/download_manager.js');
const DataFlattener = require('../chrome-edge/src/engine/DataFlattener.js');
const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const { Selector } = require('../chrome-edge/src/models/Selector.js');

// ---------------------------------------------------------------------------
// 1. ScraperEngine option defaults
// ---------------------------------------------------------------------------

test('Review3 - ScraperEngine declares `concurrency` exactly once', () => {
  // A duplicated key in an object literal is silently resolved by "last one
  // wins", so the first definition (and its comment) was pure noise that
  // invited edits to the dead copy. ESLint flags it as an error.
  const src = fs.readFileSync(path.join(ROOT, 'src/engine/ScraperEngine.js'), 'utf8');
  const ctor = src.slice(src.indexOf('this.options = Object.assign({'), src.indexOf('}, options);'));
  const hits = ctor.match(/^\s*concurrency:/gm) || [];
  assert.equal(hits.length, 1, `expected one concurrency default, found ${hits.length}`);

  // And the option still reaches the worker pool.
  const engine = new ScraperEngine(new Sitemap({ _id: 'c', startUrl: ['https://a.test/'], selectors: [] }), { concurrency: 4 });
  assert.equal(engine.options.concurrency, 4);
});

// ---------------------------------------------------------------------------
// 2. Content script click semantics
// ---------------------------------------------------------------------------

function bootContentScript(pageHtml) {
  const dom = new JSDOM(pageHtml, { runScripts: 'dangerously', url: 'https://click.test/page' });
  const win = dom.window;
  // jsdom has no layout engine: make visibility checks behave like a browser.
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.parentElement; }
  });
  win.HTMLElement.prototype.scrollIntoView = function () { /* no-op */ };
  win.chrome = {
    runtime: {
      onMessage: { addListener: (fn) => { win.__wsListener = fn; } },
      sendMessage: () => {}
    }
  };
  const el = win.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(ROOT, 'content/scraper_content.js'), 'utf8');
  win.document.body.appendChild(el);
  return win;
}

function runClickAction(win, clickConfig) {
  return new Promise((resolve) => {
    win.__wsListener(
      { type: 'EXECUTE_PAGE_ACTIONS', actions: { click: clickConfig } },
      {},
      (resp) => resolve(resp)
    );
  });
}

test('Review3 - clickMore keeps clicking a persistent "load more" button', async () => {
  // Regression: the loop tracked clicked elements by NODE IDENTITY, so on the
  // second pass the very same (still attached) button was filtered out,
  // `buttons.length === 0` ended the loop and clickMore performed exactly ONE
  // click. Measured before the fix: 2 cards instead of 4.
  const win = bootContentScript(`<!DOCTYPE html><html><body>
    <div class="card">initial</div>
    <button class="load-more">Load more</button>
    <script>
      let n = 0;
      document.querySelector('button.load-more').addEventListener('click', () => {
        if (n >= 3) return;            // the button stays, but stops loading
        n++;
        const d = document.createElement('div');
        d.className = 'card';
        d.textContent = 'lazy' + n;
        document.body.appendChild(d);
      });
    <\/script>
  </body></html>`);

  const resp = await runClickAction(win, {
    clickElementSelector: 'button.load-more',
    clickType: 'clickMore',
    clickDelay: 5,
    maxClicks: 12
  });

  assert.equal(resp.success, true, 'action reported success');
  const cards = win.document.querySelectorAll('.card').length;
  assert.equal(cards, 4, 'all three lazily loaded cards were clicked in (1 initial + 3 lazy)');
  win.close();
});

test('Review3 - clickOnce clicks EVERY matching button, not just the first', async () => {
  // Regression: clickOnce broke out of the loop after the very first click,
  // while its own UI label promises "click each button once" — so a sitemap
  // targeting N tabs only ever opened one.
  const win = bootContentScript(`<!DOCTYPE html><html><body>
    <button class="tab" data-i="1">T1</button>
    <button class="tab" data-i="2">T2</button>
    <button class="tab" data-i="3">T3</button>
    <script>
      document.querySelectorAll('button.tab').forEach((b) => {
        b.addEventListener('click', () => {
          const p = document.createElement('div');
          p.className = 'panel';
          p.textContent = 'panel-' + b.getAttribute('data-i');
          document.body.appendChild(p);
        });
      });
    <\/script>
  </body></html>`);

  await runClickAction(win, {
    clickElementSelector: 'button.tab',
    clickType: 'clickOnce',
    clickDelay: 5
  });

  const panels = Array.from(win.document.querySelectorAll('.panel')).map((p) => p.textContent);
  assert.deepEqual(panels, ['panel-1', 'panel-2', 'panel-3'], 'all three tabs opened');
  win.close();
});

test('Review3 - clickElementUniquenessType really decides what "same button" means', async () => {
  // The option was persisted on the model, exported, imported and preserved by
  // normalizeImported — but nothing ever read it, so it had zero effect. Two
  // buttons with identical TEXT but different HTML now behave differently per
  // uniqueness type.
  const page = () => `<!DOCTYPE html><html><body>
    <button class="tab" data-i="1">Open</button>
    <button class="tab" data-i="2">Open</button>
    <script>
      document.querySelectorAll('button.tab').forEach((b) => {
        b.addEventListener('click', () => {
          const p = document.createElement('div');
          p.className = 'panel';
          p.textContent = b.getAttribute('data-i');
          document.body.appendChild(p);
        });
      });
    <\/script>
  </body></html>`;

  // uniqueText: both buttons share the signature "Open" -> the second counts
  // as already clicked.
  const winText = bootContentScript(page());
  await runClickAction(winText, {
    clickElementSelector: 'button.tab', clickType: 'clickOnce', clickDelay: 5,
    clickElementUniquenessType: 'uniqueText'
  });
  assert.equal(winText.document.querySelectorAll('.panel').length, 1, 'uniqueText dedupes same-text buttons');
  winText.close();

  // uniqueHTML: outerHTML differs (data-i) -> both are distinct targets.
  const winHtml = bootContentScript(page());
  await runClickAction(winHtml, {
    clickElementSelector: 'button.tab', clickType: 'clickOnce', clickDelay: 5,
    clickElementUniquenessType: 'uniqueHTML'
  });
  assert.equal(winHtml.document.querySelectorAll('.panel').length, 2, 'uniqueHTML treats them as two buttons');
  winHtml.close();
});

test('Review3 - dashboard forwards clickElementUniquenessType to the content script', () => {
  // Without this the setting could never reach the page, whatever the content
  // script did with it.
  const src = fs.readFileSync(path.join(ROOT, 'dashboard/dashboard.js'), 'utf8');
  const start = src.indexOf('actions.click = {');
  assert.ok(start > -1, 'the click action payload exists');
  const end = src.indexOf('};', start);
  const payload = src.slice(start, end);
  assert.match(payload, /clickElementUniquenessType:\s*clickSel\.clickElementUniquenessType/,
    'the click action payload carries the uniqueness type');
  assert.match(payload, /clickElementSelector:/, 'payload still carries the selector');
  assert.match(payload, /clickType:/, 'payload still carries the click type');
  assert.match(payload, /initialSelectors:/, 'payload still carries the initial-element selectors');
});

test('Review3 - an invalid click selector no longer throws out of the loop', async () => {
  const win = bootContentScript('<!DOCTYPE html><html><body><div class="card">a</div></body></html>');
  const resp = await runClickAction(win, {
    clickElementSelector: 'div[',        // malformed CSS
    clickType: 'clickMore', clickDelay: 5
  });
  assert.equal(resp.success, true, 'invalid selector is handled, not thrown');
  win.close();
});

// ---------------------------------------------------------------------------
// 3. robots.txt
// ---------------------------------------------------------------------------

test('Review3 - malformed percent-encoding in a URL never throws', () => {
  // decodeURIComponent('/%zz') raises URIError. isAllowed() is awaited on the
  // engine worker OUTSIDE the per-page try/catch, so that single exception
  // rejected the worker, tore down the pool and ended the crawl.
  const rules = Robots.parse('User-agent: *\nDisallow: /private\n');
  assert.doesNotThrow(() => Robots.isAllowed('https://example.com/%zz', rules, '*'));
  assert.equal(Robots.isAllowed('https://example.com/%zz', rules, '*'), true, 'undecodable path is not blocked');
  assert.equal(Robots.isAllowed('https://example.com/%E0%A4%A', rules, '*'), true, 'truncated escape is not blocked');
});

test('Review3 - a literal $ inside a rule path is escaped and matches', () => {
  // Before the fix the unescaped `$` became a mid-pattern end-anchor, so the
  // rule could never match anything and silently allowed the path.
  const rules = Robots.parse('User-agent: *\nDisallow: /price$usd\n');
  assert.equal(Robots.isAllowed('https://e.test/price$usd/x', rules, '*'), false, 'literal $ path is blocked');
  assert.equal(Robots.isAllowed('https://e.test/other', rules, '*'), true);
});

test('Review3 - longest-match and tie-break semantics survive the single-pass rewrite', () => {
  const rules = Robots.parse([
    'User-agent: *',
    'Disallow: /private',
    'Allow: /private/public',
    'Disallow: /*.pdf$'
  ].join('\n'));

  assert.equal(Robots.isAllowed('https://e.test/private/x', rules, '*'), false, 'disallowed subtree');
  assert.equal(Robots.isAllowed('https://e.test/private/public', rules, '*'), true, 'longer Allow wins');
  assert.equal(Robots.isAllowed('https://e.test/private/public/deep', rules, '*'), true, 'prefix match still allows');
  assert.equal(Robots.isAllowed('https://e.test/other', rules, '*'), true, 'unrelated path allowed');
  assert.equal(Robots.isAllowed('https://e.test/doc.pdf', rules, '*'), false, 'wildcard + $ anchor blocks');
  assert.equal(Robots.isAllowed('https://e.test/doc.pdf?v=2', rules, '*'), true, 'anchor excludes the query string');

  // Equal-length Allow/Disallow: Disallow wins (RFC 9309 §2.2.3).
  const tie = Robots.parse('User-agent: *\nAllow: /a\nDisallow: /a\n');
  assert.equal(Robots.isAllowed('https://e.test/a', tie, '*'), false, 'tie goes to Disallow');
  const tie2 = Robots.parse('User-agent: *\nDisallow: /a\nAllow: /a\n');
  assert.equal(Robots.isAllowed('https://e.test/a', tie2, '*'), false, 'tie is order independent');

  // Empty "Disallow:" is the allow-all marker.
  const empty = Robots.parse('User-agent: *\nDisallow:\n');
  assert.equal(Robots.isAllowed('https://e.test/anything', empty, '*'), true);

  // Agent selection still prefers the most specific match.
  const agents = Robots.parse('User-agent: *\nDisallow: /\n\nUser-agent: WebScraper\nAllow: /\n');
  assert.equal(Robots.isAllowed('https://e.test/x', agents, 'WebScraper/1.0'), true, 'specific agent group wins');
  assert.equal(Robots.isAllowed('https://e.test/x', agents, 'OtherBot'), false, 'falls back to *');

  assert.equal(Robots.isAllowed('https://e.test/x', null, '*'), true, 'no rules -> allowed');
  assert.equal(Robots.isAllowed('not a url', Robots.parse('User-agent: *\nDisallow: /'), '*'), true, 'bad URL -> allowed');
});

test('Review3 - respectRobots survives a malformed URL without aborting the crawl', async () => {
  // End-to-end version of the URIError finding: the whole run must finish and
  // the healthy pages must still produce records.
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'User-agent: *\nDisallow: /blocked\n' });
  try {
    const sitemap = new Sitemap({
      _id: 'robots_abort', name: 'R',
      startUrl: ['https://rb.test/%zz', 'https://rb.test/blocked/p', 'https://rb.test/ok'],
      selectors: [
        { id: 'box', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.box', multiple: true },
        { id: 't', parentSelectors: ['box'], type: 'SelectorText', selector: '.t' }
      ]
    });
    const html = (label) => `<!DOCTYPE html><html><body><div class="box"><span class="t">${label}</span></div></body></html>`;
    const fetched = [];
    const engine = new ScraperEngine(sitemap, {
      requestInterval: 0, pageLoadDelay: 0, maxPages: 0,
      respectRobots: true,
      fetcher: async (url) => {
        fetched.push(url);
        return { document: new JSDOM(html(url), { url }).window.document, url };
      }
    });
    const errors = [];
    engine.on('error', (e) => errors.push(e));
    const summary = await new Promise((resolve, reject) => {
      engine.on('finish', resolve);
      const guard = setTimeout(() => reject(new Error('crawl did not finish — it was aborted')), 5000);
      engine.on('finish', () => clearTimeout(guard));
      engine.start();
    });

    assert.ok(fetched.some((u) => u.includes('%zz')), 'the malformed URL was still attempted');
    assert.ok(!fetched.some((u) => u.includes('/blocked/')), 'the disallowed URL was skipped');
    assert.equal(summary.totalRecords, 2, 'malformed + allowed pages produced records');
    assert.equal(errors.filter((e) => e && /robots/.test(String(e.error))).length, 1, 'exactly one robots block was reported');
  } finally {
    global.fetch = origFetch;
  }
});

// ---------------------------------------------------------------------------
// 4. One number parser for the whole codebase
// ---------------------------------------------------------------------------

test('Review3 - transforms and the exporter parse numbers identically', () => {
  // Before: '1,234' was 1.234 for a `number` transform and 1234 for a CSV
  // export; '1.234.567' was rejected by one and accepted by the other. The
  // same cell therefore meant two different values depending on the path.
  const cases = [
    '1,234', '1.234', '1,234.56', '1.234,56', '99,90', '1,234,567.89', '12,5',
    '1.2.3', '$1,234.56', '1.234.567', '45,90 ₺', '-2 500,75', '1.234,56 TL',
    '1 000 000', 'free shipping', 'abc', '', '3.75', '+7', '0', '-0.5', '1.2345'
  ];
  for (const c of cases) {
    assert.equal(
      TextTransforms.parseNumber(c),
      Exporter.parseColumnNumber(c),
      `parser disagreement for ${JSON.stringify(c)}`
    );
  }
  // Spot-check the values that used to disagree.
  assert.equal(TextTransforms.parseNumber('1,234'), 1234, '3-digit tail is grouping');
  assert.equal(TextTransforms.parseNumber('1.234'), 1234);
  assert.equal(TextTransforms.parseNumber('1.234.567'), 1234567, 'repeated separator is grouping');
  assert.equal(TextTransforms.parseNumber('99,90'), 99.9, '2-digit tail is decimal');
  assert.equal(TextTransforms.parseNumber('1.2.3'), null, 'invalid grouping rejected');
  assert.equal(TextTransforms.parseNumber('1.234,56 TL'), 1234.56, 'trailing text tolerated');
  assert.equal(TextTransforms.parseNumber('free shipping'), null);

  // The Exporter no longer carries its own copy.
  const src = fs.readFileSync(path.join(ROOT, 'src/export/Exporter.js'), 'utf8');
  assert.match(src, /TextTransforms\.parseNumber/, 'exporter delegates to the shared parser');
  assert.ok(!/const commas = s\.split\(','\)\.length - 1;[\s\S]*decimalSep = s\.lastIndexOf/.test(src),
    'the duplicated heuristic block is gone from Exporter.js');
});

test('Review3 - the number transform still behaves for the documented cases', () => {
  const apply = (v) => TextTransforms.applyTransforms(v, [{ type: 'number' }]);
  assert.equal(apply('1.234,56'), 1234.56);
  assert.equal(apply('$1,234.56'), 1234.56);
  assert.equal(apply('45,90 €'), 45.9);
  assert.equal(apply('-12'), -12);
  assert.equal(apply('1 000 000'), 1000000);
  assert.equal(apply('free shipping'), 'free shipping', 'non-numeric survives untouched');
  assert.deepEqual(apply(['1,5', 'x']), [1.5, 'x'], 'arrays are mapped element-wise');
});

// ---------------------------------------------------------------------------
// 5. columnTypes survive an import round trip
// ---------------------------------------------------------------------------

test('Review3 - normalizeImported preserves per-column types', () => {
  const original = new Sitemap({
    _id: 'ct', name: 'CT', startUrl: ['https://a.test/'],
    columnTypes: [
      { name: 'price', type: 'number' },
      { name: 'released', type: 'date', format: 'DD/MM/YYYY' },
      { name: 'junk', type: 'bogus' },
      null
    ],
    selectors: []
  });

  // Export -> import -> the types must still be there.
  const exported = JSON.parse(JSON.stringify(original.toJSON()));
  const normalized = Sitemap.normalizeImported(exported);
  assert.ok(Array.isArray(normalized.columnTypes), 'columnTypes key present after normalization');

  const back = new Sitemap(normalized);
  assert.deepEqual(back.getColumnType('price'), { name: 'price', type: 'number' });
  assert.deepEqual(back.getColumnType('released'), { name: 'released', type: 'date', format: 'DD/MM/YYYY' });
  assert.equal(back.getColumnType('junk'), null, 'invalid type dropped');
  assert.equal(back.columnTypes.length, 2, 'exactly the two valid entries survive');

  // A date entry without a format falls back to the documented default.
  const noFmt = new Sitemap(Sitemap.normalizeImported({ _id: 'd', startUrl: ['https://a.test/'], columnTypes: [{ name: 'x', type: 'date' }] }));
  assert.deepEqual(noFmt.getColumnType('x'), { name: 'x', type: 'date', format: 'YYYY-MM-DD' });

  // Missing / malformed columnTypes must not break the import.
  assert.deepEqual(Sitemap.normalizeImported({ _id: 'e', startUrl: [] }).columnTypes, []);
  assert.deepEqual(Sitemap.normalizeImported({ _id: 'f', startUrl: [], columnTypes: 'nope' }).columnTypes, []);
});

// ---------------------------------------------------------------------------
// 6. Selector transform normalization is load-order independent
// ---------------------------------------------------------------------------

test('Review3 - Selector pulls in transforms itself instead of a bare global', () => {
  // `typeof TextTransforms !== 'undefined'` made normalization depend on
  // whatever happened to be loaded first: with Selector.js alone, invalid
  // steps survived into storage and were then applied at scrape time.
  const src = fs.readFileSync(path.join(ROOT, 'src/models/Selector.js'), 'utf8');
  assert.match(src, /require\('\.\.\/\.\.\/lib\/transforms\.js'\)/, 'explicit CommonJS dependency');
  assert.ok(!/typeof TextTransforms !== 'undefined'/.test(src), 'no bare-global load-order dependency left');

  const s = new Selector({
    id: 'a', type: 'SelectorText', selector: 'h1',
    transforms: [{ type: 'BOGUS' }, { type: 'trim' }, { type: 'regexReplace' }, { type: 'regexReplace', find: 'x', replace: 'y' }]
  });
  assert.deepEqual(s.transforms, [{ type: 'trim' }, { type: 'regexReplace', find: 'x', replace: 'y', flags: 'g' }],
    'invalid steps dropped, valid ones normalized');
});

// ---------------------------------------------------------------------------
// 7. queryFirst fast path
// ---------------------------------------------------------------------------

test('Review3 - queryFirst only pays for the shadow merge when the light DOM misses', () => {
  const dom = new JSDOM('<div id="host"></div><div class="light">L</div>');
  const doc = dom.window.document;
  const host = doc.getElementById('host');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span class="deep">D</span>';

  const engine = new SelectorEngine({ shadowDom: true });
  let queryAllCalls = 0;
  const realQueryAll = engine.queryAll.bind(engine);
  engine.queryAll = (ctx, sel) => { queryAllCalls++; return realQueryAll(ctx, sel); };

  // Light-DOM hit: the pierced merge must not run at all.
  const light = engine.queryFirst(doc, '.light');
  assert.ok(light && light.textContent === 'L', 'light-DOM element found');
  assert.equal(queryAllCalls, 0, 'no shadow merge for a light-DOM hit');

  // Shadow-only match: still found (behaviour preserved).
  const deep = engine.queryFirst(doc, '.deep');
  assert.ok(deep && deep.textContent === 'D', 'shadow-DOM element still pierced');
  assert.equal(queryAllCalls, 1, 'merge ran exactly once, only for the miss');

  // Light DOM keeps precedence over a shadow match of the same selector.
  shadow.innerHTML = '<span class="light">SHADOW</span>';
  const engine2 = new SelectorEngine({ shadowDom: true });
  assert.equal(engine2.queryFirst(doc, '.light').textContent, 'L', 'light DOM wins');

  // shadowDom:false never pierces.
  const engine3 = new SelectorEngine({ shadowDom: false });
  assert.equal(engine3.queryFirst(doc, '.deep'), null, 'no piercing when disabled');
  assert.ok(engine3.queryFirst(doc, '.light'), 'plain query still works');

  // Special sentinels and invalid selectors.
  assert.equal(engine3.queryFirst(doc, '_parent_'), doc);
  assert.equal(engine3.queryFirst(doc, '.'), doc);
  assert.equal(engine3.queryFirst(null, '.light'), null);
  assert.equal(engine3.queryFirst(doc, ''), null);
  assert.equal(engine3.queryFirst(doc, 'div['), null, 'invalid selector returns null');
  dom.window.close();
});

// ---------------------------------------------------------------------------
// 8. DataFlattener stack safety
// ---------------------------------------------------------------------------

test('Review3 - flattenRecordTree survives a very large sibling set', () => {
  // push(...childRows) passes every row as a separate argument: RangeError at
  // ~200k rows, which a big nested-container scrape can reach. Same defect
  // class as the already-fixed Math.min(...nums) in the stats bar.
  const children = [];
  for (let i = 0; i < 200000; i++) children.push({ order: 'o' + i, _meta: {}, data: { a: i } });
  const rows = DataFlattener.flattenRecordTree([{ order: 'root', _meta: { startUrl: 'https://a.test/' }, data: {}, children }]);
  assert.equal(rows.length, 200000, 'every child became a row');
  assert.equal(rows[0].a, 0);
  assert.equal(rows[199999].a, 199999, 'order preserved');
  assert.equal(rows[0]['web-scraper-start-url'], 'https://a.test/', 'meta inherited');
});

// ---------------------------------------------------------------------------
// 9. toXML is linear
// ---------------------------------------------------------------------------

test('Review3 - toXML computes the field union once, not once per row', () => {
  // recordFields() walks every row and key; calling it INSIDE the row loop
  // made the export quadratic (measured 500 rows = 29 ms, 1000 = 75 ms,
  // 2000 = 313 ms).
  const rows = [];
  for (let i = 0; i < 1500; i++) rows.push({ a: i, b: 'x' + i });

  const realRecordFields = Exporter.recordFields;
  let calls = 0;
  Exporter.recordFields = function (...args) { calls++; return realRecordFields.apply(this, args); };
  let xml;
  try {
    xml = Exporter.toXML(rows);
  } finally {
    Exporter.recordFields = realRecordFields;
  }

  assert.equal(calls, 1, `field union computed once (was ${calls} times, one per row)`);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<scrapedData count="1500">/);
  assert.equal((xml.match(/<record>/g) || []).length, 1500, 'one record element per row');
  assert.match(xml, /<a>0<\/a>/);
  assert.match(xml, /<b>x1499<\/b>/);
  assert.match(xml, /<\/scrapedData>\n$/);
});

test('Review3 - toXML emits the union of keys, not just the first row\'s', () => {
  const xml = Exporter.toXML([{ a: 1 }, { a: 2, b: 3 }]);
  assert.match(xml, /<b>3<\/b>/, 'a column absent from row 0 is still emitted');
  assert.match(xml, /<b><\/b>/, 'and left empty for the row that lacks it');
});

// ---------------------------------------------------------------------------
// 10. DownloadManager.add is linear
// ---------------------------------------------------------------------------

test('Review3 - DownloadManager.add stays linear and collision-safe', async () => {
  // uniqueName() rebuilt a Set from the whole used-names array on EVERY url:
  // measured 2k = 58 ms, 4k = 245 ms, 8k = 1257 ms of blocked UI.
  const urls = [];
  for (let i = 0; i < 8000; i++) urls.push(`https://cdn.test/img${i}.jpg`);
  const queue = DownloadManager.createQueue({ fetchImpl: async () => new Uint8Array(1) });

  const t0 = Date.now();
  queue.add(urls);
  const elapsed = Date.now() - t0;

  assert.equal(queue.items.length, 8000);
  assert.ok(elapsed < 500, `add() of 8000 urls took ${elapsed}ms (was ~1257ms)`);
  assert.equal(new Set(queue.items.map((it) => it.name)).size, 8000, 'every name unique');

  // Duplicate URLs still get collision-safe names.
  const dup = DownloadManager.createQueue({ fetchImpl: async () => new Uint8Array(1) });
  dup.add(['https://e.test/a.jpg', 'https://e.test/a.jpg', 'https://e.test/a.jpg', 'https://e.test/b.jpg']);
  assert.deepEqual(dup.items.map((it) => it.name), ['a.jpg', 'a (1).jpg', 'a (2).jpg', 'b.jpg']);
});

test('Review3 - download queue summary stays correct through cancel and retry', async () => {
  const queue = DownloadManager.createQueue({
    concurrency: 2,
    fetchImpl: async (url) => {
      if (url.includes('bad')) throw new Error('HTTP 404');
      return new Uint8Array(3);
    }
  });
  queue.add(['https://e.test/1.jpg', 'https://e.test/bad.jpg', 'https://e.test/2.jpg', 'https://e.test/3.jpg']);

  const summary = await queue.run();
  assert.equal(summary.total, 4);
  assert.equal(summary.done, 3, 'healthy downloads completed');
  assert.equal(summary.failed, 1, 'the failing one is recorded');
  assert.equal(summary.percent, 100);
  assert.deepEqual(summary.failedItems.map((f) => f.name), ['bad.jpg']);
  assert.match(summary.failedItems[0].error, /404/);

  assert.equal(queue.retryFailed(), 1, 'one item queued for retry');
  const after = await queue.run();
  assert.equal(after.failed, 1, 'still failing (the URL is genuinely bad)');
  assert.equal(after.done, 3, 'no duplicate completions');
});

// ---------------------------------------------------------------------------
// 11. ZIP entry-count guard
// ---------------------------------------------------------------------------

test('Review3 - zip refuses more entries than the format can address', async () => {
  // The end-of-central-directory record stores the entry count as u16: past
  // 65535 files it silently wrapped and produced an archive every extractor
  // rejects, with no hint about the cause.
  const tooMany = new Array(65536).fill({ name: 'x.txt', data: new Uint8Array(1) });
  await assert.rejects(() => SimpleZip.build(tooMany), /Too many files/i);

  // A normal archive is unaffected.
  const bytes = await SimpleZip.build([
    { name: 'a.txt', data: new TextEncoder().encode('hello') },
    { name: 'dir/b.txt', data: new TextEncoder().encode('world') }
  ]);
  assert.ok(bytes instanceof Uint8Array);
  // Local file header signature + end-of-central-directory signature.
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const tail = Buffer.from(bytes.slice(bytes.length - 22)).toString('hex');
  assert.ok(tail.startsWith('504b0506'), 'EOCD present');
  assert.equal(bytes[bytes.length - 12], 2, 'entry count recorded as 2');
});

// ---------------------------------------------------------------------------
// 12. background service worker
// ---------------------------------------------------------------------------

test('Review3 - the background worker no longer loads the whole store on wake', () => {
  // importScripts('src/storage/Storage.js') instantiated AppStorage, whose
  // init() calls chrome.storage.local.get(null) — a full read + deserialize of
  // every scraped record of every sitemap — on every service-worker wake, for
  // a value the worker never used.
  const src = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  assert.ok(!/importScripts\s*\(/.test(src), 'no importScripts left in the worker');
  assert.ok(!/AppStorage/.test(src), 'worker does not reference AppStorage');
  // The message router and both listeners must survive the cleanup.
  assert.match(src, /chrome\.runtime\.onInstalled\.addListener/);
  assert.match(src, /chrome\.contextMenus\.onClicked\.addListener/);
  assert.match(src, /chrome\.runtime\.onMessage\.addListener/);
  assert.match(src, /OPEN_DASHBOARD/);
  assert.match(src, /PICKER_RESULT/);
});

// ---------------------------------------------------------------------------
// 13. maxClicks is a real, wired setting (was a phantom option)
// ---------------------------------------------------------------------------

test('Review3 - maxClicks round-trips through the model and import', () => {
  const s = new Selector({
    id: 'c', type: 'SelectorElementClick', selector: '.x',
    clickElementSelector: 'button.more', maxClicks: 7
  });
  assert.equal(s.maxClicks, 7, 'stored on the model');
  assert.equal(s.toJSON().maxClicks, 7, 'exported');
  assert.equal(new Selector(s.toJSON()).maxClicks, 7, 're-imported');
  assert.equal(new Selector(s.toJSON()).clone().maxClicks, 7, 'cloned');

  // Defaults and clamping: a hand-edited sitemap cannot ask for a runaway loop.
  assert.equal(new Selector({ id: 'd', type: 'SelectorElementClick', selector: '.x' }).maxClicks, 50, 'default 50');
  assert.equal(new Selector({ id: 'e', type: 'SelectorElementClick', selector: '.x', maxClicks: 99999 }).maxClicks, 200, 'clamped to 200');
  assert.equal(new Selector({ id: 'f', type: 'SelectorElementClick', selector: '.x', maxClicks: 0 }).maxClicks, 50, '0 falls back to the default');
  assert.equal(new Selector({ id: 'g', type: 'SelectorElementClick', selector: '.x', maxClicks: -5 }).maxClicks, 1, 'clamped to 1');

  // webscraper.io-style import keeps the field.
  const normalized = Sitemap.normalizeImported({
    _id: 'imp', startUrl: ['https://a.test/'],
    selectors: [{ id: 'k', type: 'SelectorElementClick', selector: '.x', clickElementSelector: 'b', maxClicks: 12 }]
  });
  assert.equal(normalized.selectors[0].maxClicks, 12, 'preserved by normalizeImported');

  // Non-click selectors must not grow the field.
  assert.equal('maxClicks' in new Selector({ id: 't', type: 'SelectorText', selector: '.x' }).toJSON(), false);
});

test('Review3 - maxClicks really caps the clickMore loop', async () => {
  // A button that ALWAYS adds content must still stop at the configured cap.
  const win = bootContentScript(`<!DOCTYPE html><html><body>
    <div class="card">seed</div>
    <button class="load-more">More</button>
    <script>
      document.querySelector('button.load-more').addEventListener('click', () => {
        const d = document.createElement('div');
        d.className = 'card';
        document.body.appendChild(d);
      });
    <\/script>
  </body></html>`);

  await runClickAction(win, {
    clickElementSelector: 'button.load-more',
    clickType: 'clickMore',
    clickDelay: 1,
    maxClicks: 4
  });
  // 1 seed card + at most 4 appended (the growth check may stop it earlier).
  const cards = win.document.querySelectorAll('.card').length;
  assert.ok(cards >= 2 && cards <= 5, `loop respected the cap (got ${cards} cards)`);
  win.close();
});

test('Review3 - the click UI exposes maxClicks with translations', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard/dashboard.html'), 'utf8');
  assert.match(html, /id="field-click-max-clicks"/, 'input exists');
  assert.match(html, /data-i18n="maxClicks"/, 'label is localized');
  assert.match(html, /max="200"/, 'the input carries the same ceiling as the model');

  const i18n = require('../chrome-edge/lib/i18n.js');
  for (const key of ['maxClicks', 'maxClicksHint']) {
    assert.ok(i18n.dict.en[key], `EN ${key}`);
    assert.ok(i18n.dict.tr[key], `TR ${key}`);
  }

  // The generated trees must carry the field too (panel + tor are derived).
  for (const rel of ['devtools/panel.html', '../tor/dashboard/dashboard.html']) {
    const generated = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(generated, /field-click-max-clicks/, `${rel} regenerated with the field`);
  }

  // And the dashboard reads it into the click action payload.
  const dash = fs.readFileSync(path.join(ROOT, 'dashboard/dashboard.js'), 'utf8');
  assert.match(dash, /maxClicks: clickSel\.maxClicks \|\| 50/, 'payload forwards maxClicks');
  assert.match(dash, /selData\.maxClicks = Math\.min\(200, Math\.max\(1,/, 'form value is clamped');
});
