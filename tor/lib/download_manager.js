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
   */
  function uniqueName(existing, name) {
    const taken = new Set(existing || []);
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
    const usedNames = [];   // every name ever assigned (collision guard)
    let cancelled = false;
    let running = 0;
    const listeners = [];

    function notify() {
      const summary = getSummary();
      listeners.forEach((fn) => {
        try { fn(summary); } catch (e) { /* listener errors must not break the queue */ }
      });
    }

    function add(urls) {
      (urls || []).forEach((url) => {
        let name = nameFromUrl(url);
        name = uniqueName(usedNames, name);
        usedNames.push(name);
        items.push({ id: nextId++, url: url, name: name, status: 'pending', error: null, bytes: null });
      });
      notify();
      return items.length;
    }

    function getSummary() {
      const count = (status) => items.filter((it) => it.status === status).length;
      const total = items.length;
      const done = count('done');
      const failed = count('failed');
      const downloading = count('downloading');
      const pending = count('pending');
      return {
        total: total,
        done: done,
        failed: failed,
        downloading: downloading,
        pending: pending,
        finished: done + failed,
        inProgress: downloading + pending,
        percent: total ? Math.round(((done + failed) / total) * 100) : 0,
        failedItems: items.filter((it) => it.status === 'failed').map((it) => ({ url: it.url, name: it.name, error: it.error }))
      };
    }

    function cancel() {
      cancelled = true;
      items.forEach((it) => {
        if (it.status === 'pending') it.status = 'cancelled';
      });
      notify();
    }

    function retryFailed() {
      cancelled = false;
      let retried = 0;
      items.forEach((it) => {
        if (it.status === 'failed' || it.status === 'cancelled') {
          it.status = 'pending';
          it.error = null;
          retried++;
        }
      });
      notify();
      return retried;
    }

    async function process() {
      while (!cancelled) {
        const item = items.find((it) => it.status === 'pending');
        if (!item) break;
        if (running >= concurrency) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          continue;
        }
        running++;
        item.status = 'downloading';
        notify();
        (async () => {
          try {
            if (!fetchImpl) throw new Error('no fetch implementation');
            const bytes = await fetchImpl(item.url);
            if (cancelled && item.status === 'downloading') {
              item.status = 'cancelled';
            } else {
              item.bytes = bytes;
              item.status = 'done';
            }
          } catch (e) {
            item.status = 'failed';
            item.error = e && e.message ? e.message : String(e);
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
