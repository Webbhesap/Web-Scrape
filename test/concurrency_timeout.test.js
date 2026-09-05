/**
 * P1.3 — concurrency worker pool + per-request timeout.
 *
 * - concurrency > 1: pages really are fetched in parallel (overlap is
 *   observable), and request pacing still spaces the request STARTS by
 *   requestInterval;
 * - requestTimeout: a fetcher that never resolves no longer stalls the
 *   crawl — it fails, retries (honouring requestRetries), and is logged
 *   while the other pages complete;
 * - concurrency=1 keeps the serial semantics all other tests rely on.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pageHtml(title) {
  return `<!DOCTYPE html><html><body><div class="box"><span class="t">${title}</span></div></body></html>`;
}

function makeSitemap(urls) {
  return new Sitemap({
    _id: 'conc_test',
    name: 'Concurrency test',
    startUrl: urls,
    selectors: [
      { id: 'box', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.box', multiple: true },
      { id: 't', parentSelectors: ['box'], type: 'SelectorText', selector: '.t' }
    ]
  });
}

function runEngine(sitemap, fetcher, options) {
  const engine = new ScraperEngine(sitemap, Object.assign(
    { requestInterval: 0, pageLoadDelay: 0, maxPages: 0 }, options, { fetcher }
  ));
  const events = { errors: [], retries: [], finished: null };
  engine.on('error', (e) => events.errors.push(e));
  engine.on('retry', (r) => events.retries.push(r));
  engine.on('finish', (s) => { events.finished = s; });
  const done = new Promise((resolve) => engine.on('finish', resolve));
  engine.start();
  return { engine, events, done };
}

test('P1.3 - concurrency=3 fetches pages in parallel', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const starts = [];
  const urls = [
    'https://par.test/1', 'https://par.test/2', 'https://par.test/3',
    'https://par.test/4', 'https://par.test/5', 'https://par.test/6'
  ];
  const fetcher = async (url) => {
    starts.push(Date.now());
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(60); // simulate network latency
    inFlight--;
    const doc = new JSDOM(pageHtml('P' + url), { url }).window.document;
    return { document: doc, url };
  };

  const t0 = Date.now();
  const { events, done } = runEngine(makeSitemap(urls), fetcher, { concurrency: 3 });
  const summary = await done;

  assert.equal(summary.totalRecords, 6, 'all six pages scraped');
  assert.equal(maxInFlight >= 2, true, 'requests overlapped (real parallelism)');
  // With 6 pages @60ms each, serial takes >=360ms; a 3-wide pool must
  // finish noticeably faster than that (allow CI jitter: < 330ms).
  assert.ok(Date.now() - t0 < 330, `pool was faster than serial (took ${Date.now() - t0}ms)`);
  assert.deepEqual(events.errors, [], 'no errors');
});

test('P1.3 - request pacing spaces starts by requestInterval even with workers', async () => {
  const starts = [];
  const urls = ['https://pace.test/1', 'https://pace.test/2', 'https://pace.test/3'];
  const fetcher = async (url) => {
    starts.push(Date.now());
    await sleep(5);
    const doc = new JSDOM(pageHtml('X'), { url }).window.document;
    return { document: doc, url };
  };
  const { done } = runEngine(makeSitemap(urls), fetcher, { concurrency: 3, requestInterval: 80 });
  await done;

  assert.equal(starts.length, 3);
  const gap1 = starts[1] - starts[0];
  const gap2 = starts[2] - starts[1];
  assert.ok(gap1 >= 70, `first gap respected pacing (${gap1}ms)`);
  assert.ok(gap2 >= 70, `second gap respected pacing (${gap2}ms)`);
});

test('P1.3 - requestTimeout fails a hung page and the crawl continues', async () => {
  const urls = ['https://hang.test/ok-1', 'https://hang.test/stuck', 'https://hang.test/ok-2'];
  const fetcher = async (url) => {
    if (url.includes('stuck')) {
      // Never resolves — a hung page.
      return new Promise(() => {});
    }
    const doc = new JSDOM(pageHtml(url), { url }).window.document;
    return { document: doc, url };
  };

  const { events, done } = runEngine(makeSitemap(urls), fetcher, {
    concurrency: 3,
    requestTimeout: 100,
    requestRetries: 0,
    requestInterval: 0
  });
  const summary = await Promise.race([
    done,
    sleep(8000).then(() => { throw new Error('crawl did not finish — timeout did not unstick it'); })
  ]);

  assert.equal(summary.totalRecords, 2, 'the two healthy pages still produced records');
  assert.equal(events.errors.length, 1, 'the hung page produced exactly one error');
  assert.match(String(events.errors[0].error), /timed out/i, 'error explains the timeout');
  assert.equal(events.errors[0].url, 'https://hang.test/stuck');
});

test('P1.3 - requestTimeout failures go through the retry path', async () => {
  const urls = ['https://retry.test/stuck'];
  const fetcher = async (url) => new Promise(() => {}); // always hangs

  const { events, done } = runEngine(makeSitemap(urls), fetcher, {
    concurrency: 1,
    requestTimeout: 80,
    requestRetries: 2,
    requestInterval: 10
  });
  const summary = await Promise.race([
    done,
    sleep(8000).then(() => { throw new Error('crawl did not finish'); })
  ]);

  assert.equal(events.retries.length, 2, 'two retries were attempted after the timeouts');
  assert.equal(summary.totalRecords, 0);
  assert.equal(events.errors.length, 1, 'one final error after exhausting retries');
  assert.match(String(events.errors[0].error), /timed out/i);
});

test('P1.3 - maxPages is honoured under concurrency (no overshoot)', async () => {
  const fetched = [];
  const urls = [
    'https://cap.test/1', 'https://cap.test/2', 'https://cap.test/3',
    'https://cap.test/4', 'https://cap.test/5'
  ];
  const fetcher = async (url) => {
    fetched.push(url);
    await sleep(20);
    const doc = new JSDOM(pageHtml(url), { url }).window.document;
    return { document: doc, url };
  };
  const { done } = runEngine(makeSitemap(urls), fetcher, { concurrency: 4, maxPages: 2 });
  const summary = await done;
  assert.equal(summary.pagesVisited, 2, 'exactly maxPages pages visited');
  assert.equal(fetched.length, 2, 'no extra fetches past the budget');
});
