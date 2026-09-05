/**
 * Ö7 — Gallery download manager.
 * A small, dependency-free download queue: progress tracking, failure
 * bookkeeping, retry, cancellation and collision-safe file naming.
 * All network work is injected, so the module stays unit-testable.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DownloadManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let nextId = 1;

  /** Splits "photo.jpg" -> ["photo", "jpg"]; "archive.tar.gz" -> ["archive.tar", "gz"]. */
  function splitName(name) {
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) return [name, ''];
    return [name.slice(0, dot), name.slice(dot + 1)];
  }

  /**
   * Collision-safe naming: returns `name` itself when unused, otherwise
   * "base (n).ext" with the first free n (n >= 1).
   * `existing` may be a Set (preferred — the queue keeps one and reuses it) or
   * an array (accepted for callers/tests; it is copied into a Set once).
   */
  function uniqueName(existing, name) {
    const taken = (existing instanceof Set) ? existing : new Set(existing || []);
    if (!taken.has(name)) return name;
    const [base, ext] = splitName(name);
    const suffix = ext ? '.' + ext : '';
    for (let n = 1; n < 1e6; n++) {
      const candidate = `${base} (${n})${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base} (${Date.now()})${suffix}`;
  }

  /**
   * Derives a file name from a URL: last path segment (query/hash stripped),
   * falling back to "image".
   */
  function nameFromUrl(url) {
    try {
      const u = new URL(String(url), 'https://example.invalid');
      const seg = u.pathname.split('/').filter(Boolean).pop() || '';
      return decodeURIComponent(seg) || 'image';
    } catch (e) {
      return 'image';
    }
  }

  /**
   * Creates a queue. `options.fetchImpl(url)` must resolve with the response
   * bytes (Uint8Array); it may reject to simulate a failure.
   */
  function createQueue(options) {
    const opts = options || {};
    const fetchImpl = opts.fetchImpl || null;
    const concurrency = Math.max(1, opts.concurrency || 3);

    const items = [];       // { id, url, name, status, error }
    // Every name ever assigned, as a Set: uniqueName() used to rebuild a Set
    // from a growing array on every URL, which made add() quadratic
    // (measured: 2k urls = 58 ms, 4k = 245 ms, 8k = 1257 ms of blocked UI).
    const usedNames = new Set();
    let cancelled = false;
    let running = 0;
    const listeners = [];

    // Status counters are maintained incrementally: getSummary() runs on EVERY
    // state change, so filtering the whole item list four times per
    // notification was also quadratic over a large gallery.
    const counts = { pending: 0, downloading: 0, done: 0, failed: 0, cancelled: 0 };
    const failedList = [];
    // Scan cursor for the next pending item — items.find() from index 0 on
    // every loop turn was the third quadratic pass in this module.
    let scanFrom = 0;

    function setStatus(item, status) {
      if (item.status === status) return;
      if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]--;
      if (status === 'failed') {
        failedList.push({ url: item.url, name: item.name, error: item.error });
      }
      item.status = status;
      if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    }

    function notify() {
      const summary = getSummary();
      listeners.forEach((fn) => {
        try { fn(summary); } catch (e) { /* listener errors must not break the queue */ }
      });
    }

    function add(urls) {
      (urls || []).forEach((url) => {
        const name = uniqueName(usedNames, nameFromUrl(url));
        usedNames.add(name);
        items.push({ id: nextId++, url: url, name: name, status: 'pending', error: null, bytes: null });
        counts.pending++;
      });
      notify();
      return items.length;
    }

    function getSummary() {
      const total = items.length;
      const done = counts.done;
      const failed = counts.failed;
      return {
        total: total,
        done: done,
        failed: failed,
        downloading: counts.downloading,
        pending: counts.pending,
        finished: done + failed,
        inProgress: counts.downloading + counts.pending,
        percent: total ? Math.round(((done + failed) / total) * 100) : 0,
        failedItems: failedList.map((it) => ({ url: it.url, name: it.name, error: it.error }))
      };
    }

    function cancel() {
      cancelled = true;
      items.forEach((it) => {
        if (it.status === 'pending') setStatus(it, 'cancelled');
      });
      notify();
    }

    function retryFailed() {
      cancelled = false;
      let retried = 0;
      failedList.length = 0;
      items.forEach((it) => {
        if (it.status === 'failed' || it.status === 'cancelled') {
          it.error = null;
          setStatus(it, 'pending');
          retried++;
        }
      });
      // Earlier items became pending again — restart the scan from the top.
      scanFrom = 0;
      notify();
      return retried;
    }

    /** Next pending item in O(1) amortized time (cursor, not a full scan). */
    function nextPending() {
      while (scanFrom < items.length && items[scanFrom].status !== 'pending') scanFrom++;
      if (scanFrom >= items.length) return null;
      return items[scanFrom++];
    }

    async function process() {
      while (!cancelled) {
        if (running >= concurrency) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          // A concurrent finish may have freed a slot; re-check before
          // consuming the next pending item.
          continue;
        }
        const item = nextPending();
        if (!item) break;
        running++;
        setStatus(item, 'downloading');
        notify();
        (async () => {
          try {
            if (!fetchImpl) throw new Error('no fetch implementation');
            const bytes = await fetchImpl(item.url);
            if (cancelled) {
              setStatus(item, 'cancelled');
            } else {
              item.bytes = bytes;
              setStatus(item, 'done');
            }
          } catch (e) {
            item.error = e && e.message ? e.message : String(e);
            setStatus(item, 'failed');
          } finally {
            running--;
            notify();
          }
        })();
      }
      // Wait for in-flight workers before resolving.
      while (running > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      notify();
      return getSummary();
    }

    return {
      add: add,
      items: items,
      summary: getSummary,
      cancel: cancel,
      retryFailed: retryFailed,
      run: process,
      isCancelled: () => cancelled,
      onProgress: (fn) => { listeners.push(fn); }
    };
  }

  return {
    createQueue: createQueue,
    uniqueName: uniqueName,
    nameFromUrl: nameFromUrl,
    splitName: splitName
  };
}));
