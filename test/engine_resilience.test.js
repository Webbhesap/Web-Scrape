/**
 * Ö3 — Engine resilience tests: retry with backoff, max link depth,
 * and include/exclude URL patterns.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pageDom(links) {
  const linkHtml = (links || []).map((href) => `<a href="${href}">go</a>`).join('');
  return new JSDOM(`<html><body><h1 class="t">Page</h1>${linkHtml}</body></html>`).window.document;
}

function sitemapWithLinks(chain) {
  // Link selector at the root; the text field extracts on followed pages.
  // `chain = true` makes the link selector its own parent so "next" links
  // chain across pages (the classic pagination pattern).
  return new Sitemap({
    _id: 'resilience', name: 'resilience',
    startUrl: ['https://example.com/start'],
    selectors: [
      {
        id: 'next', type: 'SelectorLink', selector: 'a',
        parentSelectors: chain ? ['_root', 'next'] : ['_root'],
        multiple: true
      },
      { id: 'title', type: 'SelectorText', selector: 'h1.t', parentSelectors: ['next'] }
    ]
  });
}

test('Resilience - failing pages are retried and then succeed', async () => {
  const sm = sitemapWithLinks(false);
  let calls = 0;
  const engine = new ScraperEngine(sm, {
    requestInterval: 1, pageLoadDelay: 0, requestRetries: 2,
    fetcher: async (url) => {
      calls++;
      if (calls <= 2) throw new Error('boom');
      // After two failures the page loads and contains one followable link.
      return { document: url.includes('start') ? pageDom(['https://example.com/sub']) : pageDom(), url };
    }
  });
  const retries = [];
  engine.on('retry', (info) => retries.push(info));
  const errors = [];
  engine.on('error', (e) => errors.push(e));
  const done = new Promise((res) => engine.on('finish', res));
  await engine.start();
  await done;
  assert.equal(retries.length, 2, 'two retry events emitted');
  assert.equal(retries[0].attempt, 1);
  assert.equal(errors.length, 0, 'no error after successful retry');
  assert.ok(engine.results.length >= 1, 'data still scraped');
});

test('Resilience - retries exhausted surface as a single error, crawl continues', async () => {
  const sm = sitemapWithLinks();
  const urls = ['https://example.com/start', 'https://example.com/ok'];
  sm.startUrl = urls;
  let fail = true;
  const engine = new ScraperEngine(sm, {
    requestInterval: 1, pageLoadDelay: 0, requestRetries: 1,
    fetcher: async (url) => {
      if (url.includes('start')) { throw new Error('always down'); }
      return { document: pageDom(), url };
    }
  });
  const errors = [];
  engine.on('error', (e) => errors.push(e));
  const done = new Promise((res) => engine.on('finish', res));
  await engine.start();
  await done;
  assert.equal(errors.length, 1, 'one final error for the dead page');
  assert.ok(errors[0].url.includes('start'));
  assert.ok(engine.pagesVisited >= 1, 'the healthy page still got scraped');
});

test('Resilience - retry backoff is exponential and capped', () => {
  const sm = sitemapWithLinks();
  const engine = new ScraperEngine(sm, { requestInterval: 1000 });
  assert.equal(engine.retryDelayMs(0), 1000);
  assert.equal(engine.retryDelayMs(1), 2000);
  assert.equal(engine.retryDelayMs(2), 4000);
  assert.equal(engine.retryDelayMs(10), 30000, 'capped at 30s');
});

test('Resilience - maxDepth limits which links get followed', async () => {
  // start links to /l1, /l1 links to /l2 — depth 1 and 2.
  const docs = {
    'https://example.com/start': pageDom(['https://example.com/l1']),
    'https://example.com/l1': pageDom(['https://example.com/l2']),
    'https://example.com/l2': pageDom([])
  };
  const visited = [];

  const run = async (maxDepth) => {
    const sm = sitemapWithLinks(true);
    const engine = new ScraperEngine(sm, {
      requestInterval: 1, pageLoadDelay: 0, maxDepth,
      fetcher: async (url) => { visited.push(url); return { document: docs[url], url }; }
    });
    const done = new Promise((res) => engine.on('finish', res));
    await engine.start();
    await done;
  };

  await run(0);
  assert.ok(visited.includes('https://example.com/l2'), 'unlimited depth follows everything');

  visited.length = 0;
  await run(1);
  assert.ok(visited.includes('https://example.com/l1'), 'depth 1 links followed');
  assert.ok(!visited.includes('https://example.com/l2'), 'depth 2 links skipped');
});

test('Resilience - include/exclude URL patterns gate the queue', async () => {
  const docs = {
    'https://example.com/start': pageDom(['https://example.com/product/1', 'https://example.com/blog/1', 'https://example.com/logout']),
    'https://example.com/product/1': pageDom([]),
    'https://example.com/blog/1': pageDom([]),
    'https://example.com/logout': pageDom([])
  };
  const visited = [];

  const sm = sitemapWithLinks(true);
  const engine = new ScraperEngine(sm, {
    requestInterval: 1, pageLoadDelay: 0,
    includeUrlPatterns: ['*/product/*'],
    excludeUrlPatterns: ['*logout*'],
    fetcher: async (url) => { visited.push(url); return { document: docs[url] || pageDom(), url }; }
  });
  const done = new Promise((res) => engine.on('finish', res));
  await engine.start();
  await done;

  assert.ok(visited.includes('https://example.com/start'), 'start URL never gated');
  assert.ok(visited.includes('https://example.com/product/1'), 'included pattern followed');
  assert.ok(!visited.includes('https://example.com/blog/1'), 'non-matching pattern skipped');
  assert.ok(!visited.includes('https://example.com/logout'), 'excluded pattern skipped');
});

test('Resilience - glob matching semantics', () => {
  const g = (pattern, url) => {
    const re = ScraperEngine.globToRegExp(pattern);
    return re ? re.test(url) : false;
  };
  // Plain fragment = substring match
  assert.equal(g('example.com', 'https://example.com/x/y'), true);
  assert.equal(g('other.com', 'https://example.com/x/y'), false);
  // Wildcards match the whole URL
  assert.equal(g('*/product/*', 'https://example.com/product/7'), true);
  assert.equal(g('*/product/*', 'https://example.com/category/7'), false);
  // Case-insensitive
  assert.equal(g('*/PRODUCT/*', 'https://example.com/product/7'), true);
  // Empty pattern never matches
  assert.equal(g('', 'https://example.com/'), false);
});
