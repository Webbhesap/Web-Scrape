/**
 * Ö7 — gallery download manager unit tests (network fully mocked).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const DM = require('../chrome-edge/lib/download_manager.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('DownloadManager - uniqueName returns the name itself when free', () => {
  assert.equal(DM.uniqueName(['a.jpg', 'b.jpg'], 'c.jpg'), 'c.jpg');
  assert.equal(DM.uniqueName([], 'photo.png'), 'photo.png');
});

test('DownloadManager - uniqueName auto-numbers collisions preserving the extension', () => {
  assert.equal(DM.uniqueName(['photo.jpg'], 'photo.jpg'), 'photo (1).jpg');
  assert.equal(DM.uniqueName(['photo.jpg', 'photo (1).jpg'], 'photo.jpg'), 'photo (2).jpg');
  assert.equal(DM.uniqueName(['report'], 'report'), 'report (1)');
  assert.equal(DM.uniqueName(['archive.tar.gz', 'archive.tar (1).gz'], 'archive.tar.gz'), 'archive.tar (2).gz');
});

test('DownloadManager - nameFromUrl strips query/hash and decodes', () => {
  assert.equal(DM.nameFromUrl('https://x.com/img/cat.png?w=100#top'), 'cat.png');
  assert.equal(DM.nameFromUrl('https://x.com/a%20b.jpg?q=1'), 'a b.jpg');
  assert.equal(DM.nameFromUrl('https://x.com/'), 'image');
});

test('DownloadManager - queue tracks done/failed counts through the run', async () => {
  const queue = DM.createQueue({
    concurrency: 2,
    fetchImpl: async (url) => {
      if (url.includes('bad')) throw new Error('HTTP 500');
      return new Uint8Array([1, 2, 3]);
    }
  });
  queue.add(['https://x/1.jpg', 'https://x/bad.jpg', 'https://x/2.jpg', 'https://x/bad2.jpg']);
  assert.equal(queue.summary().total, 4);
  assert.equal(queue.summary().pending, 4);

  const summary = await queue.run();
  assert.equal(summary.done, 2);
  assert.equal(summary.failed, 2);
  assert.equal(summary.finished, 4);
  assert.equal(summary.percent, 100);
  assert.deepEqual(summary.failedItems.map((it) => it.error), ['HTTP 500', 'HTTP 500']);
  // bytes stored on successful items
  const ok = queue.items.filter((it) => it.status === 'done');
  assert.ok(ok.every((it) => it.bytes && it.bytes.length === 3));
});

test('DownloadManager - duplicate URLs still get distinct collision-safe names', async () => {
  const queue = DM.createQueue({ fetchImpl: async () => new Uint8Array([0]) });
  queue.add(['https://x/pic.jpg', 'https://x/pic.jpg']);
  const names = queue.items.map((it) => it.name);
  assert.deepEqual(names, ['pic.jpg', 'pic (1).jpg']);
  const summary = await queue.run();
  assert.equal(summary.done, 2);
});

test('DownloadManager - retryFailed re-enqueues only failed items', async () => {
  let failuresLeft = 1;
  const queue = DM.createQueue({
    fetchImpl: async (url) => {
      if (url.includes('flaky') && failuresLeft > 0) {
        failuresLeft--;
        throw new Error('temporarily unavailable');
      }
      return new Uint8Array([9]);
    }
  });
  queue.add(['https://x/flaky.jpg', 'https://x/stable.jpg']);
  let first = await queue.run();
  assert.equal(first.done, 1);
  assert.equal(first.failed, 1);

  const retried = queue.retryFailed();
  assert.equal(retried, 1);
  const second = await queue.run();
  assert.equal(second.done, 2);
  assert.equal(second.failed, 0);
  assert.equal(second.total, 2);
});

test('DownloadManager - cancel stops pending work', async () => {
  const queue = DM.createQueue({
    concurrency: 1,
    fetchImpl: async (url) => {
      await sleep(60);
      return new Uint8Array([1]);
    }
  });
  queue.add(['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  const progressEvents = [];
  queue.onProgress((s) => progressEvents.push(s.percent));
  const running = queue.run();
  await sleep(20); // first item is mid-flight
  queue.cancel();
  const summary = await running;
  assert.ok(summary.done <= 1, 'at most the in-flight item finishes');
  assert.equal(summary.pending, 0, 'nothing left pending after cancel');
  assert.ok(summary.failedItems.every((it) => it.url));
  // progress callbacks fired throughout
  assert.ok(progressEvents.length >= 2);
});

test('DownloadManager - progress listener observes monotonic completion', async () => {
  const queue = DM.createQueue({ concurrency: 2, fetchImpl: async () => new Uint8Array([1]) });
  queue.add(['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg']);
  const seen = [];
  queue.onProgress((s) => seen.push({ done: s.done, total: s.total }));
  await queue.run();
  assert.equal(seen[seen.length - 1].done, 3);
  assert.equal(seen[seen.length - 1].total, 3);
  assert.ok(seen.every((s) => s.total === 3));
});
