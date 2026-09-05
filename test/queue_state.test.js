/**
 * P1.2 — crawl queue state export / import (resume interrupted crawls).
 *
 * ScraperEngine.exportState()   -> plain-JSON snapshot of queue + visited +
 *                                  enqueued bookkeeping + results so far
 * ScraperEngine.importState()   -> restores it (validated, throws on junk)
 * ScraperEngine.startFromState() -> continues WITHOUT resetting anything:
 *                                  visited pages are not re-fetched.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');

const PAGES = {
  'https://shop.test/list': `<!DOCTYPE html><html><body>
    <div class="featured"><span class="fname">Featured: A</span></div>
    <div class="item"><span class="name">A</span><a class="next" href="https://shop.test/detail-1">1</a></div>
    <div class="item"><span class="name">B</span><a class="next" href="https://shop.test/detail-2">2</a></div>
  </body></html>`,
  'https://shop.test/detail-1': `<!DOCTYPE html><html><body>
    <div class="item"><span class="name">Detail One</span></div>
    <div class="detail-box"><span class="dtitle">Detail One</span></div>
  </body></html>`,
  'https://shop.test/detail-2': `<!DOCTYPE html><html><body>
    <div class="item"><span class="name">Detail Two</span></div>
    <div class="detail-box"><span class="dtitle">Detail Two</span></div>
  </body></html>`
};

function makeSitemap() {
  return new Sitemap({
    _id: 'resume_test',
    name: 'Resume test',
    startUrl: ['https://shop.test/list'],
    selectors: [
      // Container without forwarded children -> leaf record on the list page.
      { id: 'featured', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.featured', multiple: true },
      { id: 'fname', parentSelectors: ['featured'], type: 'SelectorText', selector: '.fname' },
      // Container with a link child -> forwarded, no record of its own.
      { id: 'item', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.item', multiple: true },
      { id: 'name', parentSelectors: ['item'], type: 'SelectorText', selector: '.name' },
      { id: 'more', parentSelectors: ['item'], type: 'SelectorLink', selector: 'a.next', linkType: 'linkFromHref' },
      // Leaf container on the detail pages — child of the `more` LINK,
      // because enqueued detail jobs run under the link's id (the branch the
      // detail pages are crawled under; root children never run there).
      { id: 'detail', parentSelectors: ['more'], type: 'SelectorElement', selector: '.detail-box', multiple: true },
      { id: 'dtitle', parentSelectors: ['detail'], type: 'SelectorText', selector: '.dtitle' }
    ]
  });
}

function makeFetcher() {
  const fetched = [];
  const fetcher = async (url) => {
    fetched.push(url);
    if (!PAGES[url]) throw new Error(`no mock page for ${url}`);
    const doc = new JSDOM(PAGES[url], { url }).window.document;
    return { document: doc, url };
  };
  return { fetcher, fetched };
}

function runWithStopAfter(engine, pages) {
  return new Promise((resolve) => {
    engine.on('pageComplete', () => {
      if (engine.pagesVisited >= pages) engine.stop();
    });
    engine.on('finish', (summary) => resolve(summary));
    engine.start();
  });
}

test('P1.2 - exportState captures queue, visited set and partial results', async () => {
  const { fetcher } = makeFetcher();
  const engine = new ScraperEngine(makeSitemap(), {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0, fetcher
  });

  // Visit the list page (enqueues 2 detail pages) and stop.
  await runWithStopAfter(engine, 1);

  assert.equal(engine.pagesVisited, 1, 'one page visited before the stop');
  assert.equal(engine.results.length, 1, 'one partial record (the featured item)');
  assert.equal(engine.queue.length, 2, 'two detail pages waiting in the queue');

  const saved = engine.exportState();
  assert.equal(saved.format, 'web-scraper-queue-state');
  assert.equal(saved.sitemapId, 'resume_test');
  assert.equal(saved.pagesVisited, 1);
  assert.equal(saved.results.length, 1);
  assert.equal(saved.results[0].fname, 'Featured: A');
  assert.deepEqual(saved.queue.map((j) => j.url).sort(), [
    'https://shop.test/detail-1',
    'https://shop.test/detail-2'
  ]);
  assert.ok(saved.visitedUrls.includes('https://shop.test/list'));
  assert.ok(saved.enqueuedKeys.length >= 2, 'both detail pages were enqueued');

  // Must survive a JSON roundtrip (the file format).
  const round = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(round.queue.map((j) => j.url).sort(), saved.queue.map((j) => j.url).sort());
  assert.equal(round.results[0].fname, 'Featured: A');
});

test('P1.2 - startFromState continues without re-fetching visited pages', async () => {
  const first = makeFetcher();
  const engine1 = new ScraperEngine(makeSitemap(), {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0, fetcher: first.fetcher
  });
  await runWithStopAfter(engine1, 1);
  const saved = JSON.parse(JSON.stringify(engine1.exportState()));

  // A brand-new engine resumes the saved state.
  const second = makeFetcher();
  const engine2 = new ScraperEngine(makeSitemap(), {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0, fetcher: second.fetcher
  });
  engine2.importState(saved);

  const summary = await new Promise((resolve) => {
    engine2.on('finish', (s) => resolve(s));
    engine2.startFromState();
  });

  assert.equal(summary.totalRecords, 3, '1 partial + 2 finished records');
  assert.equal(second.fetched.length, 2, 'only the two remaining pages were fetched');
  assert.ok(!second.fetched.includes('https://shop.test/list'), 'visited list page was NOT re-fetched');
  // The partial record from the first run survived the roundtrip.
  const names = summary.results.map((r) => r.fname || r.dtitle).sort();
  assert.deepEqual(names, ['Detail One', 'Detail Two', 'Featured: A']);
});

test('P1.2 - a full run without interruption is unaffected', async () => {
  const { fetcher, fetched } = makeFetcher();
  const engine = new ScraperEngine(makeSitemap(), {
    requestInterval: 0, pageLoadDelay: 0, maxPages: 0, fetcher
  });
  const summary = await new Promise((resolve) => {
    engine.on('finish', (s) => resolve(s));
    engine.start();
  });
  assert.equal(summary.totalRecords, 3);
  assert.equal(fetched.length, 3, 'all three pages fetched exactly once');
});

test('P1.2 - importState rejects malformed input without corrupting the engine', () => {
  const engine = new ScraperEngine(makeSitemap(), {});
  engine.queue.push({ url: 'x', startUrl: 'x', parentSelectorId: '_root', parentData: {}, depth: 0 });

  const beforeQueue = engine.queue.length;
  const beforeVisited = engine.visitedUrls.size;

  assert.throws(() => engine.importState(null), /Invalid state/);
  assert.throws(() => engine.importState({}), /wrong format/);
  assert.throws(() => engine.importState({ format: 'web-scraper-queue-state' }), /missing fields/);
  assert.throws(() => engine.importState({
    format: 'web-scraper-queue-state',
    queue: [{ bogus: true }], visitedUrls: [], enqueuedKeys: [], results: []
  }), /bad queue entry/);

  assert.equal(engine.queue.length, beforeQueue, 'engine untouched after rejections');
  assert.equal(engine.visitedUrls.size, beforeVisited);
});

test('P1.2 - startFromState with an empty queue reports instead of hanging', async () => {
  const engine = new ScraperEngine(makeSitemap(), {
    requestInterval: 0, pageLoadDelay: 0, fetcher: makeFetcher().fetcher
  });
  let errored = null;
  engine.on('error', (e) => { errored = e; });
  engine.importState({
    format: 'web-scraper-queue-state',
    queue: [], visitedUrls: [], enqueuedKeys: [], results: [], pagesVisited: 0
  });
  await new Promise((resolve) => {
    engine.on('finish', () => resolve());
    engine.startFromState();
    setTimeout(resolve, 500); // safety: startFromState must not hang
  });
  assert.ok(errored, 'an error was emitted');
  assert.match(String(errored && errored.message), /empty queue/i);
  assert.equal(engine.isRunning, false, 'engine is idle afterwards');
});
