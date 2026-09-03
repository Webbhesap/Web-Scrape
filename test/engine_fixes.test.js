/**
 * Regression tests for engine-level fixes:
 * - SelectorXPath execution through SelectorEngine.extract()
 * - ScraperEngine restart state reset (queue / endTime)
 * - Queue-level deduplication of enqueued URLs
 * - Pagination maxPages limit
 * - CSV quoteChar regex safety
 * - UrlRangeExpander runaway range cap
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const Sitemap = require('../src/models/Sitemap.js');
const { Selector } = require('../src/models/Selector.js');
const SelectorEngine = require('../src/engine/SelectorEngine.js');
const ScraperEngine = require('../src/engine/ScraperEngine.js');
const CSV = require('../lib/csv.js');
const UrlRangeExpander = require('../src/engine/UrlRangeExpander.js');

test('SelectorEngine - SelectorXPath extracts text, attributes, multiples and regex', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="item" data-id="A-101"><span class="name">Alpha</span></div>
      <div class="item" data-id="B-202"><span class="name">Beta</span></div>
    </body></html>
  `);
  const doc = dom.window.document;
  const engine = new SelectorEngine({ baseUrl: 'https://x.test/' });

  // Single text
  const single = engine.extract(doc, new Selector({
    id: 'first_name', type: 'SelectorXPath', selector: '//span[@class="name"]', parentSelectors: ['_root']
  }));
  assert.equal(single, 'Alpha');

  // Multiple text
  const multi = engine.extract(doc, new Selector({
    id: 'names', type: 'SelectorXPath', selector: '//span[@class="name"]', multiple: true, parentSelectors: ['_root']
  }));
  assert.deepEqual(multi, ['Alpha', 'Beta']);

  // Attribute extraction
  const attrs = engine.extract(doc, new Selector({
    id: 'ids', type: 'SelectorXPath', selector: '//div[@class="item"]',
    multiple: true, extractAttribute: 'data-id', parentSelectors: ['_root']
  }));
  assert.deepEqual(attrs, ['A-101', 'B-202']);

  // Regex with capture group applied to the value
  const nums = engine.extract(doc, new Selector({
    id: 'nums', type: 'SelectorXPath', selector: '//div[@class="item"]',
    multiple: true, extractAttribute: 'data-id', regex: '([0-9]+)', parentSelectors: ['_root']
  }));
  assert.deepEqual(nums, ['101', '202']);

  // Missing node → empty string / empty array
  assert.equal(engine.extract(doc, new Selector({
    id: 'none', type: 'SelectorXPath', selector: '//h9', parentSelectors: ['_root']
  })), '');
});

test('Selector model - SelectorXPath round-trips extractAttribute through toJSON', () => {
  const sel = new Selector({
    id: 'xp', type: 'SelectorXPath', selector: '//a', extractAttribute: 'href', parentSelectors: ['_root']
  });
  const json = sel.toJSON();
  assert.equal(json.extractAttribute, 'href');
  const clone = sel.clone();
  assert.equal(clone.extractAttribute, 'href');
});

function makeFetcher(pages) {
  return async (url) => {
    const html = pages[url];
    if (!html) throw new Error('404: ' + url);
    const dom = new JSDOM(html, { url });
    return { document: dom.window.document, url };
  };
}

test('ScraperEngine - restarting the same engine resets queue and results', async () => {
  const pages = {
    'https://a.test/': '<html><body><h1 class="t">Hello</h1></body></html>'
  };
  const sitemap = new Sitemap({
    _id: 'restart', startUrl: ['https://a.test/'],
    selectors: [{ id: 't', type: 'SelectorText', selector: 'h1.t', parentSelectors: ['_root'] }]
  });
  const engine = new ScraperEngine(sitemap, { requestInterval: 0, pageLoadDelay: 0, fetcher: makeFetcher(pages) });

  await engine.start();
  assert.equal(engine.results.length, 1);

  await engine.start(); // second run must not accumulate old queue/results
  assert.equal(engine.results.length, 1, 'second run should produce exactly one record again');
  assert.equal(engine.pagesVisited, 1);
});

test('ScraperEngine - duplicate links are only enqueued once', async () => {
  const pages = {
    'https://d.test/': `
      <html><body>
        <a class="lnk" href="https://d.test/detail">One</a>
        <a class="lnk" href="https://d.test/detail">Two</a>
        <a class="lnk" href="https://d.test/detail">Three</a>
      </body></html>`,
    'https://d.test/detail': '<html><body><h1 class="h">Detail</h1></body></html>'
  };
  const sitemap = new Sitemap({
    _id: 'dedupe', startUrl: ['https://d.test/'],
    selectors: [
      { id: 'lnk', type: 'SelectorLink', selector: 'a.lnk', multiple: true, parentSelectors: ['_root'] },
      { id: 'h', type: 'SelectorText', selector: 'h1.h', parentSelectors: ['lnk'] }
    ]
  });
  const engine = new ScraperEngine(sitemap, { requestInterval: 0, pageLoadDelay: 0, fetcher: makeFetcher(pages) });
  await engine.start();
  assert.equal(engine.pagesVisited, 2, 'detail page must be visited exactly once');
});

test('ScraperEngine - pagination respects per-selector maxPages', async () => {
  const pages = {};
  for (let i = 1; i <= 10; i++) {
    const next = i < 10 ? `<a class="next" href="https://p.test/page/${i + 1}">Next</a>` : '';
    pages[`https://p.test/page/${i}`] = `
      <html><body><span class="val">Item ${i}</span>${next}</body></html>`;
  }
  const sitemap = new Sitemap({
    _id: 'pag', startUrl: ['https://p.test/page/1'],
    selectors: [
      { id: 'pager', type: 'SelectorPagination', selector: 'a.next', maxPages: 3, parentSelectors: ['_root'] },
      { id: 'val', type: 'SelectorText', selector: 'span.val', parentSelectors: ['_root'] }
    ]
  });
  const engine = new ScraperEngine(sitemap, { requestInterval: 0, pageLoadDelay: 0, fetcher: makeFetcher(pages) });
  await engine.start();
  assert.equal(engine.pagesVisited, 3, 'should stop after maxPages pages');
  assert.equal(engine.results.length, 3);
});

test('CSV - custom quoteChar with regex special characters does not throw', () => {
  const rows = [{ a: 'x$y', b: 'plain' }];
  const out = CSV.unparse(rows, { quoteChar: '$', escapeChar: '$' });
  assert.ok(out.includes('$x$$y$'), 'value containing the quote char must be quoted and escaped');
});

test('UrlRangeExpander - runaway numeric range is capped instead of freezing', () => {
  const urls = UrlRangeExpander.expandUrl('https://x.test/p/[1-99999999]');
  assert.ok(urls.length <= 100000, 'expansion must be capped');
  assert.equal(urls[0], 'https://x.test/p/1');
});
