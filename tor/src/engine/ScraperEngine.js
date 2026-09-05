/**
 * Scraping Engine Runtime and Scheduler.
 * Coordinates crawl queue, delays, selector execution, and record assembly.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./SelectorEngine.js', './DataFlattener.js', '../../lib/robots.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const SelectorEngine = require('./SelectorEngine.js');
    const DataFlattener = require('./DataFlattener.js');
    const Robots = require('../../lib/robots.js');
    module.exports = factory(SelectorEngine, DataFlattener, Robots);
  } else {
    root.ScraperEngine = factory(root.SelectorEngine, root.DataFlattener, root.Robots);
  }
}(typeof self !== 'undefined' ? self : this, function (SelectorEngine, DataFlattener, Robots) {
  'use strict';

  class ScraperEngine {
    constructor(sitemap, options = {}) {
      this.sitemap = sitemap;
      this.options = Object.assign({
        requestInterval: 1000,
        pageLoadDelay: 1000,
        maxPages: 500,
        requestRetries: 0,        // Ö3: extra attempts per failed page (exponential backoff)
        maxDepth: 0,              // Ö3: 0 = unlimited link depth
        includeUrlPatterns: [],   // Ö3: glob list; empty = follow everything
        excludeUrlPatterns: [],   // Ö3: glob list; matching URLs are never enqueued
        // P1.3: how many pages may be in flight at once (1 = serial, the
        // historic behaviour). Capped at 8.
        concurrency: 1,
        // P1.1: when a click selector has "discard initial elements" on, the
        // content script tags pre-click container matches with
        // data-ws-initial; the engine then drops them so only click-loaded
        // content becomes a record.
        discardInitialElements: false,
        // P1.3: per-request timeout in ms (0 = disabled). A hung page used
        // to stall the whole crawl forever; now the request fails, goes
        // through the normal retry/backoff path, and eventually is logged
        // as an error while the crawl continues.
        requestTimeout: 0,
        // P3.10: optional robots.txt respect mode ("saygı modu"). OFF by
        // default — only enabled sitemaps fetch origin/robots.txt and skip
        // disallowed pages (per-sitemap key, mirrored from sitemap.options).
        respectRobots: false,
        robotsUserAgent: '*',
        fetcher: null // custom DOM fetcher function: async (url) => { document, url }
      }, options);

      this.queue = [];
      this.visitedUrls = new Set();
      this.enqueuedKeys = new Set(); // `${parentSelectorId}|${url}` — prevents duplicate queue entries
      this.results = [];
      this._robotsRules = new Map(); // P3.10: origin -> parsed rules (null = none)
      this.isRunning = false;
      this.isPaused = false;
      this.isStopped = false;
      this.startTime = null;
      this.endTime = null;
      this.pagesVisited = 0;

      this.listeners = {
        statusChange: [],
        pageStart: [],
        pageComplete: [],
        recordScraped: [],
        retry: [],
        error: [],
        finish: []
      };

      // Ö2: propagate the sitemap's shadow-DOM piercing preference.
      this.selectorEngine = new SelectorEngine({
        shadowDom: !(sitemap && sitemap.options && sitemap.options.shadowDom === false)
      });
    }

    on(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
      return this;
    }

    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => {
          try { cb(data); } catch (e) { console.error(`Error in event listener ${event}:`, e); }
        });
      }
    }

    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
    }

    /**
     * Default DOM fetcher using fetch() and DOMParser (usable in browser or node test environments with jsdom)
     * `options.signal` (P1.3) lets a per-request timeout actually cancel the
     * underlying fetch instead of merely racing it.
     */
    async defaultFetcher(url, options) {
      if (typeof window !== 'undefined' && window.DOMParser) {
        const fetchOpts = (options && options.signal) ? { signal: options.signal } : undefined;
        const response = await fetch(url, fetchOpts);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText} for ${url}`);
        }
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        return { document: doc, url: response.url || url };
      }
      throw new Error('No DOM fetcher available in this environment.');
    }

    /** Finalizes a run: normalizes results, emits finish + statusChange. */
    async _finishRun() {
      this.isRunning = false;
      this.endTime = Date.now();
      const normalized = DataFlattener.normalizeRecords(this.results);
      this.results = normalized;
      this.emit('finish', {
        totalRecords: this.results.length,
        pagesVisited: this.pagesVisited,
        elapsedMs: this.endTime - this.startTime,
        results: this.results
      });
      this.emit('statusChange', this.getStatus());
    }

    async start() {
      if (this.isRunning) return;

      this.isRunning = true;
      this.isPaused = false;
      this.isStopped = false;
      this.startTime = Date.now();
      this.endTime = null;
      this.pagesVisited = 0;
      this.results = [];
      this.queue = [];
      this.visitedUrls.clear();
      this.enqueuedKeys.clear();
      this._robotsRules = new Map();
      DataFlattener.resetOrderCounter();

      const startUrls = this.sitemap.getExpandedStartUrls();
      if (startUrls.length === 0) {
        this.emit('error', new Error('No valid start URLs found in sitemap.'));
        this.stop();
        return;
      }

      // Populate initial queue
      for (const startUrl of startUrls) {
        this.queue.push({
          url: startUrl,
          startUrl: startUrl,
          parentSelectorId: '_root',
          parentData: {},
          depth: 0
        });
      }

      this.emit('statusChange', this.getStatus());

      try {
        await this.runLoop();
      } catch (err) {
        this.emit('error', err);
      } finally {
        await this._finishRun();
      }
    }

    /**
     * P1.2 — serializes the crawl's resumable state: remaining queue,
     * visited/enqueued bookkeeping and everything scraped so far.
     * Safe to JSON.stringify (plain objects/arrays only).
     */
    exportState() {
      return {
        format: 'web-scraper-queue-state',
        version: 1,
        savedAt: new Date().toISOString(),
        sitemapId: this.sitemap && this.sitemap._id ? this.sitemap._id : null,
        pagesVisited: this.pagesVisited,
        queue: this.queue.map((j) => ({
          url: j.url,
          startUrl: j.startUrl,
          parentSelectorId: j.parentSelectorId,
          parentData: j.parentData,
          depth: j.depth,
          paginationDepth: j.paginationDepth
        })),
        visitedUrls: Array.from(this.visitedUrls),
        enqueuedKeys: Array.from(this.enqueuedKeys),
        results: this.results.slice()
      };
    }

    /**
     * P1.2 — restores a previously exported state (see exportState).
     * Throws on malformed input; never touches engine fields until the
     * whole object has validated.
     */
    importState(saved) {
      if (!saved || typeof saved !== 'object') throw new Error('Invalid state: not an object');
      if (saved.format !== 'web-scraper-queue-state') throw new Error('Invalid state: wrong format');
      const queue = Array.isArray(saved.queue) ? saved.queue : null;
      const visited = Array.isArray(saved.visitedUrls) ? saved.visitedUrls : null;
      const keys = Array.isArray(saved.enqueuedKeys) ? saved.enqueuedKeys : null;
      const results = Array.isArray(saved.results) ? saved.results : null;
      if (!queue || !visited || !keys || !results) throw new Error('Invalid state: missing fields');
      for (const job of queue) {
        if (!job || typeof job.url !== 'string' || !job.url) throw new Error('Invalid state: bad queue entry');
      }

      this.queue = queue.map((j) => ({
        url: j.url,
        startUrl: j.startUrl || j.url,
        parentSelectorId: j.parentSelectorId || '_root',
        parentData: (j.parentData && typeof j.parentData === 'object') ? j.parentData : {},
        depth: parseInt(j.depth, 10) || 0,
        paginationDepth: parseInt(j.paginationDepth, 10) || 0
      }));
      this.visitedUrls = new Set(visited);
      this.enqueuedKeys = new Set(keys);
      this.results = results.slice();
      this.pagesVisited = Math.max(0, parseInt(saved.pagesVisited, 10) || 0);
      this.endTime = null;
      return this;
    }

    /**
     * P1.2 — continues a crawl from an imported state. Unlike start() this
     * resets NOTHING: the queue, the visited set and the records collected
     * so far are honoured, and already-visited pages are not re-fetched.
     */
    async startFromState() {
      if (this.isRunning) return;
      if (this.queue.length === 0) {
        this.emit('error', new Error('Saved state has an empty queue — nothing to continue.'));
        return;
      }

      this.isRunning = true;
      this.isPaused = false;
      this.isStopped = false;
      this.startTime = Date.now();
      this.emit('statusChange', this.getStatus());

      try {
        await this.runLoop();
      } catch (err) {
        this.emit('error', err);
      } finally {
        await this._finishRun();
      }
    }

    pause() {
      if (this.isRunning && !this.isPaused) {
        this.isPaused = true;
        this.emit('statusChange', this.getStatus());
      }
    }

    resume() {
      if (this.isRunning && this.isPaused) {
        this.isPaused = false;
        this.emit('statusChange', this.getStatus());
      }
    }

    stop() {
      this.isStopped = true;
      this.isRunning = false;
      this.isPaused = false;
      this.emit('statusChange', this.getStatus());
    }

    getStatus() {
      const now = this.endTime || Date.now();
      const elapsed = this.startTime ? Math.floor((now - this.startTime) / 1000) : 0;
      let state = 'idle';
      if (this.isStopped) state = 'stopped';
      else if (this.isPaused) state = 'paused';
      else if (this.isRunning) state = 'running';
      else if (this.endTime) state = 'finished';

      return {
        state: state,
        queueSize: this.queue.length,
        pagesVisited: this.pagesVisited,
        recordsCount: this.results.length,
        elapsedSeconds: elapsed
      };
    }

    /**
     * Ö3: wildcard URL pattern matching. A pattern without any `*` is
     * treated as a substring match (surrounded with wildcards) so users can
     * simply type a domain or path fragment.
     */
    static globToRegExp(pattern) {
      let p = String(pattern).trim().toLowerCase();
      if (!p) return null;
      if (!p.includes('*')) p = `*${p}*`;
      const escaped = p.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      return new RegExp(`^${escaped}$`, 'i');
    }

    urlAllowed(url) {
      const excludes = Array.isArray(this.options.excludeUrlPatterns) ? this.options.excludeUrlPatterns : [];
      for (const pat of excludes) {
        const re = ScraperEngine.globToRegExp(pat);
        if (re && re.test(url)) return false;
      }
      const includes = Array.isArray(this.options.includeUrlPatterns) ? this.options.includeUrlPatterns : [];
      if (includes.length === 0) return true;
      return includes.some((pat) => {
        const re = ScraperEngine.globToRegExp(pat);
        return re && re.test(url);
      });
    }

    /** Exponential backoff between retry attempts, capped at 30 s. */
    retryDelayMs(attempt) {
      const base = this.options.requestInterval > 0 ? this.options.requestInterval : 1000;
      return Math.min(base * Math.pow(2, attempt), 30000);
    }

    /** Wraps the fetcher with retry/backoff and emits `retry` events. */
    async fetchWithRetry(fetcher, url) {
      const attempts = Math.max(1, (parseInt(this.options.requestRetries, 10) || 0) + 1);
      let lastErr = null;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (this.isStopped) throw new Error('Scrape stopped.');
        try {
          return await fetcher(url);
        } catch (err) {
          lastErr = err;
          if (attempt < attempts - 1) {
            this.emit('retry', { url: url, attempt: attempt + 1, ofAttempts: attempts - 1, error: (err && err.message) || String(err) });
            await this.sleep(this.retryDelayMs(attempt));
          }
        }
      }
      throw lastErr;
    }

    /**
     * P1.3 — wraps the fetcher with a per-request timeout. The rejection is
     * thrown inside fetchWithRetry, so timed-out requests go through the
     * same retry/backoff path as any other failure; after the last attempt
     * the page is logged as an error and the crawl continues.
     *
     * The fetcher also receives `{ signal }` (an AbortController signal) so a
     * timed-out request is really CANCELLED, not just raced. Without this a
     * hung page kept its background tab, its network request and its
     * tab-event listeners alive for the rest of the browser session —
     * every timeout leaked one tab.
     */
    async fetchWithTimeout(fetcher, url) {
      const timeout = parseInt(this.options.requestTimeout, 10) || 0;
      if (timeout <= 0) return fetcher(url, {});

      const controller = (typeof AbortController === 'function') ? new AbortController() : null;
      let timer = null;
      try {
        return await Promise.race([
          fetcher(url, controller ? { signal: controller.signal } : {}),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              if (controller) {
                try { controller.abort(); } catch (e) { /* already settled */ }
              }
              reject(new Error(`Request timed out after ${timeout}ms: ${url}`));
            }, timeout);
          })
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async runLoop() {
      const fetcher = this.options.fetcher || this.defaultFetcher.bind(this);
      const timedFetcher = async (url) => this.fetchWithTimeout(fetcher, url);

      // P1.3: worker pool. concurrency=1 reproduces the historic serial
      // loop exactly (no polling, same pacing, same events).
      const workers = Math.max(1, Math.min(8, parseInt(this.options.concurrency, 10) || 1));

      // Global pacing: request STARTS are at least requestInterval apart,
      // regardless of how many workers are running (the first request of a
      // run skips the delay, as before). The lock serializes the
      // wait-and-mark step so two workers waking from the same sleep cannot
      // both grab the same slot.
      let lastRequestStart = 0;
      let firstRequestStarted = false;
      let paceLock = Promise.resolve();
      const paceRequest = () => {
        const run = async () => {
          if (this.options.requestInterval <= 0) return;
          const now = Date.now();
          if (firstRequestStarted) {
            const earliest = lastRequestStart + this.options.requestInterval;
            if (earliest > now) await this.sleep(earliest - now);
          }
          firstRequestStarted = true;
          lastRequestStart = Date.now();
        };
        const out = paceLock.then(run, run);
        paceLock = out.catch(() => {});
        return out;
      };

      let inFlight = 0;
      // Pages currently holding a maxPages budget slot (reserved BEFORE the
      // fetch, released when the page is done). Counting only pagesVisited
      // would let N concurrent workers all pass the gate in the same tick
      // and overshoot the budget.
      let reserved = 0;

      const worker = async () => {
        while (!this.isStopped) {
          while (this.isPaused && !this.isStopped) {
            await this.sleep(200);
          }
          if (this.isStopped) return;

          // Nothing to do: the queue is empty and no other worker is
          // processing a page that might enqueue more work.
          if (this.queue.length === 0 && inFlight === 0) return;
          if (this.queue.length === 0) {
            // Multi-worker: wait for the in-flight page to finish and
            // possibly enqueue follow-ups.
            await this.sleep(20);
            continue;
          }

          // Drop duplicate root-URL jobs without spending a budget slot.
          const peek = this.queue[0];
          if (peek && this.visitedUrls.has(peek.url) && peek.parentSelectorId === '_root') {
            this.queue.shift();
            continue;
          }

          // maxPages gate on visited + reserved, so concurrent workers can
          // never push the run past the page budget.
          if (this.options.maxPages > 0 && (this.pagesVisited + reserved) >= this.options.maxPages) {
            if (inFlight === 0) return;
            await this.sleep(20);
            continue;
          }

          const job = this.queue.shift();
          // P3.10: robots.txt respect mode — a disallowed page is skipped
          // WITHOUT being marked visited and WITHOUT spending page budget.
          if (this.options.respectRobots && !(await this._robotsAllows(job.url))) {
            this.emit('error', { url: job.url, error: 'robots.txt: saygı modu — URL engellendi' });
            continue;
          }
          this.visitedUrls.add(job.url);
          inFlight++;
          reserved++;

          this.emit('pageStart', { url: job.url, queueLength: this.queue.length });

          // Request delay (global pacing, see paceRequest)
          await paceRequest();

          try {
            const fetchResult = await this.fetchWithRetry(timedFetcher, job.url);
            const doc = fetchResult.document;
            const currentUrl = fetchResult.url || job.url;

            this.selectorEngine.setBaseUrl(currentUrl);

            // Page load delay if configured
            if (this.options.pageLoadDelay > 0) {
              await this.sleep(this.options.pageLoadDelay);
            }

            this.pagesVisited++;

            // Execute scrape on this page for the current parent selector branch
            await this.processPageContext(doc, job, currentUrl);

            this.emit('pageComplete', { url: job.url, totalRecords: this.results.length });
            this.emit('statusChange', this.getStatus());
          } catch (err) {
            this.emit('error', { url: job.url, error: err.message || err });
          } finally {
            inFlight--;
            reserved--;
          }
        }
      };

      const pool = [];
      for (let i = 0; i < workers; i++) {
        pool.push(worker());
      }
      await Promise.all(pool);
    }

    /**
     * Wraps a flat data record as a leaf node, flattens it, stores the
     * resulting rows and emits `recordScraped` for each of them.
     */
    pushLeafRecord(data, job, currentUrl) {
      // P3.10: carry the page-title selector's value on every record.
      if (job && job._titleField) {
        data = Object.assign({}, data, { [job._titleField]: job._titleValue });
      }
      const leafNode = {
        order: DataFlattener.generateOrderKey(),
        _meta: { startUrl: job.startUrl, currentUrl: currentUrl },
        data: data
      };
      const flatRows = DataFlattener.flattenRecordTree([leafNode], {}, leafNode._meta);
      for (const r of flatRows) {
        this.results.push(r);
        this.emit('recordScraped', r);
      }
    }

    /**
     * P3.10: asks the (per-origin cached) robots policy whether the URL may
     * be crawled. Non-http(s) URLs and fetch failures always pass.
     *
     * This must NEVER throw: it is awaited on the worker's hot path, outside
     * the per-page try/catch, so an escaping exception used to reject the
     * worker promise, tear down the whole pool and end the crawl — a single
     * odd URL could abort a run of thousands of pages.
     */
    async _robotsAllows(url) {
      if (typeof Robots === 'undefined' || !Robots) return true;
      try {
        let parsed;
        try { parsed = new URL(url); } catch (e) { return true; }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
        const origin = parsed.origin;
        if (!this._robotsRules) this._robotsRules = new Map();
        let rules = this._robotsRules.get(origin);
        if (rules === undefined) {
          rules = await Robots.fetchRules(origin);
          this._robotsRules.set(origin, rules);
        }
        return Robots.isAllowed(url, rules, this.options.robotsUserAgent || '*') !== false;
      } catch (e) {
        // Robots policy is advisory — on any internal failure, allow the URL
        // rather than killing the crawl.
        return true;
      }
    }

    /**
     * P3.10: evaluates the sitemap's page-title selector ("tarama başlığı
     * seçicisi") once per page. Returns trimmed text or null.
     */
    _extractPageTitle(doc, selector) {
      try {
        if (!doc || typeof doc.querySelector !== 'function' || !selector) return null;
        const el = doc.querySelector(selector);
        if (!el) return null;
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        return text || null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Adds a job to the crawl queue unless the same (parent, url) pair has
     * already been enqueued or visited.
     */
    enqueueJob(jobSpec) {
      const key = `${jobSpec.parentSelectorId}|${jobSpec.url}`;
      if (this.enqueuedKeys.has(key) || this.visitedUrls.has(jobSpec.url)) return false;
      // Ö3: respect the link depth budget (start URLs sit at depth 0).
      if (this.options.maxDepth > 0 && (jobSpec.depth || 0) > this.options.maxDepth) return false;
      // Ö3: respect include/exclude URL patterns (never gate start URLs).
      if ((jobSpec.depth || 0) > 0 && !this.urlAllowed(jobSpec.url)) return false;
      this.enqueuedKeys.add(key);
      this.queue.push(jobSpec);
      return true;
    }

    /**
     * Extracts link objects for a Link/PopupLink selector and enqueues any
     * unvisited target pages, inheriting the given record data.
     */
    enqueueLinks(context, linkSel, job, baseRecord) {
      const linkData = this.selectorEngine.extract(context, linkSel);
      const links = Array.isArray(linkData) ? linkData : (linkData && linkData.href ? [linkData] : []);

      for (const linkObj of links) {
        if (linkObj && linkObj.href) {
          const inheritedData = Object.assign({}, baseRecord, {
            [linkSel.id]: linkObj.text,
            [`${linkSel.id}-href`]: linkObj.href
          });

          this.enqueueJob({
            url: linkObj.href,
            startUrl: job.startUrl,
            parentSelectorId: linkSel.id,
            parentData: inheritedData,
            depth: job.depth + 1
          });
        }
      }
    }

    async processPageContext(docContext, job, currentUrl) {
      const parentId = job.parentSelectorId || '_root';
      const childSelectors = this.sitemap.getDirectChildSelectors(parentId);

      // P3.10: page-title selector — evaluated once per page; every record
      // produced from this page carries the value under the chosen field.
      const pageTitleOpt = this.options.pageTitle;
      if (pageTitleOpt && pageTitleOpt.enabled && pageTitleOpt.selector) {
        job._titleValue = this._extractPageTitle(docContext, pageTitleOpt.selector);
        job._titleField = pageTitleOpt.field || 'pageTitle';
      }

      if (childSelectors.length === 0) {
        return;
      }

      // Check selector categories
      const linkSelectors = childSelectors.filter(s => s.type === 'SelectorLink' || s.type === 'SelectorPopupLink');
      const paginationSelectors = childSelectors.filter(s => s.type === 'SelectorPagination');
      const containerSelectors = childSelectors.filter(s => s.type === 'SelectorElement' || s.type === 'SelectorElementClick' || s.type === 'SelectorElementScroll');
      const dataSelectors = childSelectors.filter(s => !s.acceptsChildren && s.type !== 'SelectorPagination');

      // 1. Process Pagination (enqueue new pages)
      const pagDepth = job.paginationDepth || 0;
      for (const pagSel of paginationSelectors) {
        // Respect the per-selector page limit (0 = unlimited). The start page
        // counts as page 1, so stop once maxPages pages have been chained.
        if (pagSel.maxPages > 0 && pagDepth + 1 >= pagSel.maxPages) continue;
        const nextUrls = this.selectorEngine.extractPagination(docContext, pagSel);
        for (const nextUrl of nextUrls) {
          this.enqueueJob({
            url: nextUrl,
            startUrl: job.startUrl,
            parentSelectorId: parentId,
            parentData: Object.assign({}, job.parentData),
            depth: job.depth + 1,
            paginationDepth: pagDepth + 1
          });
        }
      }

      // 2. Process Direct Link Selectors (enqueue child pages)
      for (const linkSel of linkSelectors) {
        this.enqueueLinks(docContext, linkSel, job, job.parentData);
      }

      // 3. Process Container Selectors (Element wrappers)
      if (containerSelectors.length > 0) {
        for (const contSel of containerSelectors) {
          let elements = this.selectorEngine.extractElement(docContext, contSel);
          // P1.1: drop container matches that existed before the clicks
          // (tagged data-ws-initial by the content script) so only
          // click-loaded content is scraped.
          if (this.options.discardInitialElements) {
            elements = elements.filter((el) => !(el && el.hasAttribute && el.hasAttribute('data-ws-initial')));
          }
          const childFields = this.sitemap.getDirectChildSelectors(contSel.id);

          for (const itemElement of elements) {
            const itemRecord = Object.assign({}, job.parentData);

            // Pass 1: extract every plain data field first. Links, tables and
            // nested containers are deferred so the records they produce
            // always inherit the FULL sibling record regardless of the order
            // the selectors happen to be defined in (previously a link
            // declared before the text fields passed an incomplete parent
            // record to the child pages — order-dependent data loss).
            const childLinks = [];
            const childTables = [];
            const childContainers = [];
            for (const fieldSel of childFields) {
              if (fieldSel.type === 'SelectorLink' || fieldSel.type === 'SelectorPopupLink') {
                childLinks.push(fieldSel);
              } else if (fieldSel.type === 'SelectorTable') {
                childTables.push(fieldSel);
              } else if (fieldSel.type === 'SelectorElement') {
                childContainers.push(fieldSel);
              } else {
                itemRecord[fieldSel.id] = this.selectorEngine.extract(itemElement, fieldSel);
              }
            }

            // Pass 2: tables — each expanded row carries the full item record.
            for (const tableSel of childTables) {
              const tableRows = this.selectorEngine.extractTable(itemElement, tableSel);
              for (const tRow of tableRows) {
                this.pushLeafRecord(Object.assign({}, itemRecord, tRow), job, currentUrl);
              }
            }

            // Pass 3: nested element containers.
            for (const nestedSel of childContainers) {
              let subElements = this.selectorEngine.extractElement(itemElement, nestedSel);
              // P1.1: same initial-element filtering applies to nested
              // containers (they share the same pre-click DOM snapshot).
              if (this.options.discardInitialElements) {
                subElements = subElements.filter((el) => !(el && el.hasAttribute && el.hasAttribute('data-ws-initial')));
              }
              const subChildFields = this.sitemap.getDirectChildSelectors(nestedSel.id);
              for (const subEl of subElements) {
                const subRecord = Object.assign({}, itemRecord);
                for (const subSel of subChildFields) {
                  subRecord[subSel.id] = this.selectorEngine.extract(subEl, subSel);
                }
                this.pushLeafRecord(subRecord, job, currentUrl);
              }
            }

            // Pass 4: links — enqueue child pages with the complete record.
            for (const linkSel of childLinks) {
              this.enqueueLinks(itemElement, linkSel, job, itemRecord);
            }

            // If this item container was not forwarded to child links or
            // expanded by tables/nested containers, emit it as a leaf record.
            if (childLinks.length === 0 && childTables.length === 0 && childContainers.length === 0) {
              this.pushLeafRecord(itemRecord, job, currentUrl);
            }
          }
        }
      }

      // 4. Process Top-level Data Selectors (when no container wrappers)
      if (dataSelectors.length > 0 && containerSelectors.length === 0 && linkSelectors.length === 0) {
        const pageRecord = Object.assign({}, job.parentData);
        let hasTable = false;

        for (const dataSel of dataSelectors) {
          if (dataSel.type === 'SelectorTable') {
            hasTable = true;
            const tableRows = this.selectorEngine.extractTable(docContext, dataSel);
            for (const tRow of tableRows) {
              this.pushLeafRecord(Object.assign({}, pageRecord, tRow), job, currentUrl);
            }
          } else {
            pageRecord[dataSel.id] = this.selectorEngine.extract(docContext, dataSel);
          }
        }

        if (!hasTable) {
          this.pushLeafRecord(pageRecord, job, currentUrl);
        }
      }

      // P1.1: extraction for this page is complete — remove the initial-
      // element markers so they never leak into scraped HTML output or the
      // live page the user is looking at (tab-runner documents are shared).
      if (this.options.discardInitialElements) {
        try {
          docContext.querySelectorAll('[data-ws-initial]').forEach((el) => el.removeAttribute('data-ws-initial'));
        } catch (e) { /* document may be detached */ }
      }
    }
  }

  return ScraperEngine;
}));
