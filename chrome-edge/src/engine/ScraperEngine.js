/**
 * Scraping Engine Runtime and Scheduler.
 * Coordinates crawl queue, delays, selector execution, and record assembly.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./SelectorEngine.js', './DataFlattener.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const SelectorEngine = require('./SelectorEngine.js');
    const DataFlattener = require('./DataFlattener.js');
    module.exports = factory(SelectorEngine, DataFlattener);
  } else {
    root.ScraperEngine = factory(root.SelectorEngine, root.DataFlattener);
  }
}(typeof self !== 'undefined' ? self : this, function (SelectorEngine, DataFlattener) {
  'use strict';

  class ScraperEngine {
    constructor(sitemap, options = {}) {
      this.sitemap = sitemap;
      this.options = Object.assign({
        requestInterval: 1000,
        pageLoadDelay: 1000,
        maxPages: 500,
        concurrency: 1,
        fetcher: null // custom DOM fetcher function: async (url) => { document, url }
      }, options);

      this.queue = [];
      this.visitedUrls = new Set();
      this.enqueuedKeys = new Set(); // `${parentSelectorId}|${url}` — prevents duplicate queue entries
      this.results = [];
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
     */
    async defaultFetcher(url) {
      if (typeof window !== 'undefined' && window.DOMParser) {
        const response = await fetch(url);
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

    async runLoop() {
      const fetcher = this.options.fetcher || this.defaultFetcher.bind(this);

      while (this.queue.length > 0 && !this.isStopped) {
        while (this.isPaused && !this.isStopped) {
          await this.sleep(200);
        }
        if (this.isStopped) break;

        if (this.options.maxPages > 0 && this.pagesVisited >= this.options.maxPages) {
          break;
        }

        const job = this.queue.shift();
        if (this.visitedUrls.has(job.url) && job.parentSelectorId === '_root') {
          continue; // skip duplicate root URL
        }
        this.visitedUrls.add(job.url);

        this.emit('pageStart', { url: job.url, queueLength: this.queue.length });

        // Request delay
        if (this.options.requestInterval > 0 && this.pagesVisited > 0) {
          await this.sleep(this.options.requestInterval);
        }

        try {
          const fetchResult = await fetcher(job.url);
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
        }
      }
    }

    /**
     * Wraps a flat data record as a leaf node, flattens it, stores the
     * resulting rows and emits `recordScraped` for each of them.
     */
    pushLeafRecord(data, job, currentUrl) {
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
     * Adds a job to the crawl queue unless the same (parent, url) pair has
     * already been enqueued or visited.
     */
    enqueueJob(jobSpec) {
      const key = `${jobSpec.parentSelectorId}|${jobSpec.url}`;
      if (this.enqueuedKeys.has(key) || this.visitedUrls.has(jobSpec.url)) return false;
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
          const elements = this.selectorEngine.extractElement(docContext, contSel);
          const childFields = this.sitemap.getDirectChildSelectors(contSel.id);

          for (const itemElement of elements) {
            const itemRecord = Object.assign({}, job.parentData);
            let hasChildLink = false;
            let hasChildTable = false;

            // First pass: extract non-link data fields and check for child links/tables
            for (const fieldSel of childFields) {
              if (fieldSel.type === 'SelectorLink' || fieldSel.type === 'SelectorPopupLink') {
                hasChildLink = true;
                this.enqueueLinks(itemElement, fieldSel, job, itemRecord);
              } else if (fieldSel.type === 'SelectorTable') {
                hasChildTable = true;
                const tableRows = this.selectorEngine.extractTable(itemElement, fieldSel);
                for (const tRow of tableRows) {
                  this.pushLeafRecord(Object.assign({}, itemRecord, tRow), job, currentUrl);
                }
              } else if (fieldSel.type === 'SelectorElement') {
                // Nested element containers
                const subElements = this.selectorEngine.extractElement(itemElement, fieldSel);
                const subChildFields = this.sitemap.getDirectChildSelectors(fieldSel.id);
                for (const subEl of subElements) {
                  const subRecord = Object.assign({}, itemRecord);
                  for (const subSel of subChildFields) {
                    subRecord[subSel.id] = this.selectorEngine.extract(subEl, subSel);
                  }
                  this.pushLeafRecord(subRecord, job, currentUrl);
                }
              } else {
                itemRecord[fieldSel.id] = this.selectorEngine.extract(itemElement, fieldSel);
              }
            }

            // If this item container is not forwarded to child links or expanded by tables/nested containers, emit leaf record
            if (!hasChildLink && !hasChildTable && !childFields.some(f => f.type === 'SelectorElement')) {
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
    }
  }

  return ScraperEngine;
}));
