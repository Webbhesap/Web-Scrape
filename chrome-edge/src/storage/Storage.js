/**
 * Storage Engine for Web Scraper.
 * Uses chrome.storage.local for synchronized extension storage with IndexedDB and localStorage fallbacks.
 */
(function (root, factory) {
  const result = factory();
  if (typeof define === 'function' && define.amd) {
    define([], () => result);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = result;
  }
  if (root) root.AppStorage = result;
  if (typeof window !== 'undefined') window.AppStorage = result;
  if (typeof globalThis !== 'undefined') globalThis.AppStorage = result;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'WebScraperDB';
  // P1.4: version 2 adds the scraped_data_chunks store — records are
  // persisted in fixed-size chunks instead of one giant object, which keeps
  // large saves from failing as an all-or-nothing multi-hundred-MB put and
  // lets a quota failure roll back cleanly.
  const DB_VERSION = 2;
  const STORE_SITEMAPS = 'sitemaps';
  const STORE_DATA = 'scraped_data';
  const STORE_DATA_CHUNKS = 'scraped_data_chunks';
  const CHUNK_SIZE = 2000; // records per chunk

  const quotaError = (message) =>
    Object.assign(new Error(message || 'Storage quota exceeded'), { code: 'QUOTA_EXCEEDED' });
  const isQuotaErr = (e) =>
    Boolean(e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.name || '') + ' ' + String(e.message || ''))));

  const SAMPLE_SITEMAPS = [
    {
      _id: 'sample_ecommerce_products',
      name: 'Sample E-Commerce Store',
      startUrl: ['https://webscraper.io/test-sites/e-commerce/allinone'],
      selectors: [
        {
          id: 'category_link',
          parentSelectors: ['_root'],
          type: 'SelectorLink',
          selector: 'div.sidebar a.nav-link',
          multiple: true,
          linkType: 'linkFromHref',
          delay: 0
        },
        {
          id: 'product_card',
          parentSelectors: ['category_link', '_root'],
          type: 'SelectorElement',
          selector: 'div.product-wrapper',
          multiple: true,
          delay: 0
        },
        {
          id: 'title',
          parentSelectors: ['product_card'],
          type: 'SelectorText',
          selector: 'a.title',
          multiple: false,
          regex: '',
          delay: 0
        },
        {
          id: 'price',
          parentSelectors: ['product_card'],
          type: 'SelectorText',
          selector: 'span.price',
          multiple: false,
          regex: '',
          delay: 0
        },
        {
          id: 'description',
          parentSelectors: ['product_card'],
          type: 'SelectorText',
          selector: 'p.description',
          multiple: false,
          regex: '',
          delay: 0
        },
        {
          id: 'product_image',
          parentSelectors: ['product_card'],
          type: 'SelectorImage',
          selector: 'img.img-fluid',
          multiple: false,
          delay: 0
        }
      ]
    },
    {
      _id: 'sample_data_tables',
      name: 'Sample Tables Scraper',
      startUrl: ['https://webscraper.io/test-sites/tables'],
      selectors: [
        {
          id: 'table_data',
          parentSelectors: ['_root'],
          type: 'SelectorTable',
          selector: 'table.table',
          multiple: true,
          tableHeaderRowSelector: 'thead tr',
          tableDataRowSelector: 'tbody tr',
          columns: [
            { header: '#', name: 'id', extract: true },
            { header: 'First Name', name: 'first_name', extract: true },
            { header: 'Last Name', name: 'last_name', extract: true },
            { header: 'Username', name: 'username', extract: true }
          ],
          delay: 0
        }
      ]
    }
  ];

  class AppStorage {
    constructor() {
      this.db = null;
      this.isChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.storage.local);
      this.initPromise = this.init();
    }

    async init() {
      if (this.isChromeStorage) {
        try {
          const sitemaps = await this._rawGetAllSitemapsChrome();
          if (sitemaps.length === 0) {
            for (const s of SAMPLE_SITEMAPS) {
              await this._rawSaveSitemapChrome(s);
            }
          }
        } catch (e) {
          console.warn('Chrome storage init warning:', e);
        }
        return true;
      }

      if (typeof indexedDB !== 'undefined') {
        return new Promise((resolve) => {
          try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains(STORE_SITEMAPS)) {
                db.createObjectStore(STORE_SITEMAPS, { keyPath: '_id' });
              }
              if (!db.objectStoreNames.contains(STORE_DATA)) {
                db.createObjectStore(STORE_DATA, { keyPath: 'sitemapId' });
              }
              if (!db.objectStoreNames.contains(STORE_DATA_CHUNKS)) {
                const chunkStore = db.createObjectStore(STORE_DATA_CHUNKS, { keyPath: 'chunkKey' });
                chunkStore.createIndex('bySitemap', 'sitemapId', { unique: false });
              }
            };

            request.onsuccess = async (event) => {
              this.db = event.target.result;
              try {
                const existing = await this._rawGetAllSitemapsIDB();
                if (existing.length === 0) {
                  for (const s of SAMPLE_SITEMAPS) {
                    await this._rawSaveSitemapIDB(s);
                  }
                }
              } catch (e) {}
              resolve(this.db);
            };

            request.onerror = () => resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      }

      if (typeof localStorage !== 'undefined') {
        try {
          const list = this._rawGetAllSitemapsLocalStorage();
          if (list.length === 0) {
            for (const s of SAMPLE_SITEMAPS) {
              this._rawSaveSitemapLocalStorage(s);
            }
          }
        } catch (e) {}
      }
      return true;
    }

    // --- RAW INTERNAL STORAGE HELPERS (NO PROMISE AWAIT CYCLE) ---

    _rawGetAllSitemapsChrome() {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get(null, (all) => {
            if ((chrome.runtime && chrome.runtime.lastError) || !all) {
              resolve([]);
              return;
            }
            const sitemaps = [];
            for (const k of Object.keys(all)) {
              if (k.startsWith('sitemap_') && all[k]) {
                sitemaps.push(all[k]);
              }
            }
            resolve(sitemaps);
          });
        } catch (e) {
          resolve([]);
        }
      });
    }

    _rawSaveSitemapChrome(sitemap) {
      return new Promise((resolve) => {
        try {
          const data = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : Object.assign({}, sitemap);
          if (!data._id) {
            resolve(null);
            return;
          }
          data.name = data.name || data._id;
          data.updatedAt = data.updatedAt || new Date().toISOString();
          const key = `sitemap_${data._id}`;
          chrome.storage.local.set({ [key]: data }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('chrome.storage save warning:', chrome.runtime.lastError.message);
            }
            resolve(data);
          });
        } catch (e) {
          resolve(null);
        }
      });
    }

    _rawGetAllSitemapsIDB() {
      return new Promise((resolve) => {
        if (!this.db) {
          resolve([]);
          return;
        }
        try {
          const tx = this.db.transaction([STORE_SITEMAPS], 'readonly');
          const store = tx.objectStore(STORE_SITEMAPS);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    }

    _rawSaveSitemapIDB(sitemap) {
      return new Promise((resolve) => {
        if (!this.db) {
          resolve(null);
          return;
        }
        try {
          const data = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : Object.assign({}, sitemap);
          if (!data._id) {
            resolve(null);
            return;
          }
          data.name = data.name || data._id;
          data.updatedAt = data.updatedAt || new Date().toISOString();
          const tx = this.db.transaction([STORE_SITEMAPS], 'readwrite');
          const store = tx.objectStore(STORE_SITEMAPS);
          const req = store.put(data);
          req.onsuccess = () => resolve(data);
          req.onerror = () => resolve(data);
        } catch (e) {
          resolve(null);
        }
      });
    }

    _rawGetAllSitemapsLocalStorage() {
      const list = [];
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('ws_sitemap_')) {
            try {
              list.push(JSON.parse(localStorage.getItem(key)));
            } catch (e) {}
          }
        }
      }
      return list;
    }

    _rawSaveSitemapLocalStorage(sitemap) {
      const data = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : Object.assign({}, sitemap);
      if (!data._id) return null;
      data.name = data.name || data._id;
      data.updatedAt = data.updatedAt || new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`ws_sitemap_${data._id}`, JSON.stringify(data));
        } catch (e) {}
      }
      return data;
    }

    // --- PUBLIC ASYNC METHODS ---

    async saveSitemap(sitemap) {
      await this.initPromise;
      const data = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : Object.assign({}, sitemap);
      if (!data._id) throw new Error('Sitemap must have an _id property.');

      data.name = data.name || data._id;
      data.updatedAt = new Date().toISOString();

      if (this.isChromeStorage) {
        return this._rawSaveSitemapChrome(data);
      }

      if (this.db) {
        return this._rawSaveSitemapIDB(data);
      }

      return this._rawSaveSitemapLocalStorage(data);
    }

    async getSitemap(sitemapId) {
      await this.initPromise;
      if (!sitemapId) return null;

      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.get(`sitemap_${sitemapId}`, (res) => {
            if ((chrome.runtime && chrome.runtime.lastError) || !res) {
              resolve(null);
              return;
            }
            resolve(res[`sitemap_${sitemapId}`] || null);
          });
        });
      }

      if (this.db) {
        return new Promise((resolve) => {
          try {
            const tx = this.db.transaction([STORE_SITEMAPS], 'readonly');
            const store = tx.objectStore(STORE_SITEMAPS);
            const req = store.get(sitemapId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      }

      if (typeof localStorage !== 'undefined') {
        try {
          const item = localStorage.getItem(`ws_sitemap_${sitemapId}`);
          return item ? JSON.parse(item) : null;
        } catch (e) {
          console.warn('Corrupt sitemap entry in localStorage:', e);
          return null;
        }
      }
      return null;
    }

    async getAllSitemaps() {
      await this.initPromise;

      if (this.isChromeStorage) {
        return this._rawGetAllSitemapsChrome();
      }

      if (this.db) {
        return this._rawGetAllSitemapsIDB();
      }

      return this._rawGetAllSitemapsLocalStorage();
    }

    async deleteSitemap(sitemapId) {
      await this.initPromise;
      if (!sitemapId) return true;

      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.remove([`sitemap_${sitemapId}`, `data_${sitemapId}`], () => {
            resolve(true);
          });
        });
      }

      if (this.db) {
        await new Promise((resolve) => {
          try {
            const tx = this.db.transaction([STORE_SITEMAPS, STORE_DATA], 'readwrite');
            tx.objectStore(STORE_SITEMAPS).delete(sitemapId);
            tx.objectStore(STORE_DATA).delete(sitemapId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch (e) {
            resolve();
          }
        });
        return true;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`ws_sitemap_${sitemapId}`);
        localStorage.removeItem(`ws_data_${sitemapId}`);
      }
      return true;
    }

    // Ö8 — user sitemap templates (small payloads; extension storage or localStorage)

    async loadSitemapTemplates() {
      await this.initPromise;
      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.get('sitemap_templates', (res) => {
            resolve((res && Array.isArray(res.sitemap_templates)) ? res.sitemap_templates : []);
          });
        });
      }
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem('sitemap_templates');
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }
      return [];
    }

    async saveSitemapTemplate(template) {
      const list = await this.loadSitemapTemplates();
      const idx = list.findIndex((t) => t && t.id === template.id);
      if (idx >= 0) list[idx] = template;
      else list.push(template);
      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ sitemap_templates: list }, () => resolve(true));
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sitemap_templates', JSON.stringify(list));
      }
      return true;
    }

    async deleteSitemapTemplate(templateId) {
      const list = await this.loadSitemapTemplates();
      const next = list.filter((t) => t && t.id !== templateId);
      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ sitemap_templates: next }, () => resolve(true));
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sitemap_templates', JSON.stringify(next));
      }
      return true;
    }

    // --- P1.4: IndexedDB helpers for the chunked scraped-data layout ---
    //
    // Layout: scraped_data holds a small HEADER per sitemap
    // ({sitemapId, scrapedAt, count, records: [], chunkCount}); the records
    // themselves live in scraped_data_chunks as {chunkKey, sitemapId,
    // chunkIndex, records[]}. Each chunk is its own committed transaction,
    // so a QuotaExceeded abort costs at most one chunk and the whole pass
    // can be rolled back to the previous state.

    _idbPut(storeName, value) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          resolve(value);
          return;
        }
        let settled = false;
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        tx.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        tx.onabort = () => {
          if (settled) return;
          settled = true;
          const err = (tx && tx.error) || (req && req.error) || new Error('Transaction aborted');
          if (isQuotaErr(err)) reject(quotaError());
          else reject(Object.assign(new Error(String((err && err.message) || 'write failed')), { code: 'WRITE_FAILED' }));
        };
      });
    }

    _idbDelete(storeName, key) {
      return new Promise((resolve) => {
        if (!this.db) {
          resolve(true);
          return;
        }
        let settled = false;
        try {
          const tx = this.db.transaction([storeName], 'readwrite');
          tx.objectStore(storeName).delete(key);
          tx.oncomplete = () => {
            if (!settled) {
              settled = true;
              resolve(true);
            }
          };
          tx.onabort = () => {
            if (!settled) {
              settled = true;
              resolve(false);
            }
          };
        } catch (e) {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }
      });
    }

    _idbDeleteMany(storeName, keys) {
      if (!keys || keys.length === 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        if (!this.db) {
          resolve(true);
          return;
        }
        let settled = false;
        try {
          const tx = this.db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          for (const k of keys) store.delete(k);
          tx.oncomplete = () => {
            if (!settled) {
              settled = true;
              resolve(true);
            }
          };
          tx.onabort = () => {
            if (!settled) {
              settled = true;
              resolve(false);
            }
          };
        } catch (e) {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }
      });
    }

    _rawGetScrapedDataIDB(sitemapId) {
      return new Promise((resolve) => {
        if (!this.db) {
          resolve(null);
          return;
        }
        try {
          const tx = this.db.transaction([STORE_DATA], 'readonly');
          const req = tx.objectStore(STORE_DATA).get(sitemapId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }

    _rawGetDataChunksIDB(sitemapId) {
      return new Promise((resolve) => {
        if (!this.db) {
          resolve([]);
          return;
        }
        try {
          const tx = this.db.transaction([STORE_DATA_CHUNKS], 'readonly');
          const req = tx.objectStore(STORE_DATA_CHUNKS).index('bySitemap').getAll(sitemapId);
          req.onsuccess = () => {
            const chunks = (req.result || []).slice().sort((a, b) => a.chunkIndex - b.chunkIndex);
            resolve(chunks);
          };
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    }

    async _saveScrapedDataIDB(sitemapId, records) {
      const list = Array.isArray(records) ? records : [];
      const header = {
        sitemapId: sitemapId,
        scrapedAt: new Date().toISOString(),
        count: list.length,
        records: [],
        chunkCount: Math.ceil(list.length / CHUNK_SIZE)
      };
      const newChunks = [];
      for (let i = 0; i < header.chunkCount; i++) {
        newChunks.push({
          chunkKey: `${sitemapId}__${i}`,
          sitemapId: sitemapId,
          chunkIndex: i,
          records: list.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        });
      }

      // Capture the previous state first so a quota failure can roll back.
      const oldEntry = await this._rawGetScrapedDataIDB(sitemapId);
      const oldChunks = await this._rawGetDataChunksIDB(sitemapId);

      // Replace: drop the old chunks and header, then write the new ones.
      if (oldChunks.length || oldEntry) {
        await this._idbDeleteMany(STORE_DATA_CHUNKS, oldChunks.map((c) => c.chunkKey));
        if (oldEntry) await this._idbDelete(STORE_DATA, sitemapId);
      }

      try {
        for (const chunk of newChunks) {
          await this._idbPut(STORE_DATA_CHUNKS, chunk);
        }
        // The header goes LAST: without it, getScrapedData reports no data,
        // so a partially written set can never be read as complete.
        await this._idbPut(STORE_DATA, header);
        return header;
      } catch (e) {
        if (e && e.code !== 'QUOTA_EXCEEDED') throw e;
        // Roll back the partial pass and restore what was there before.
        await this._idbDeleteMany(STORE_DATA_CHUNKS, newChunks.map((c) => c.chunkKey));
        if (oldEntry) {
          try {
            await this._idbPut(STORE_DATA, oldEntry);
            for (const c of oldChunks) {
              await this._idbPut(STORE_DATA_CHUNKS, c);
            }
          } catch (e2) {
            // The old data itself no longer fits (other storage grew in
            // between) — nothing sane to do, but the caller already sees
            // the quota error.
            console.warn('Quota rollback of previous scraped data failed:', e2);
          }
        }
        throw e;
      }
    }

    async saveScrapedData(sitemapId, records) {
      await this.initPromise;
      const list = Array.isArray(records) ? records : [];
      const entry = {
        sitemapId: sitemapId,
        scrapedAt: new Date().toISOString(),
        count: list.length,
        records: this.db ? [] : list
      };

      if (this.isChromeStorage) {
        // chrome.storage.local: keep the monolithic entry, but pre-check
        // the quota so the failure is an explicit error, not a silent
        // lastError swallowed by the callback.
        let ok = true;
        try {
          const used = await new Promise((res) => {
            chrome.storage.local.getBytesInUse(null, (b) => res(b || 0));
          });
          const key = `data_${sitemapId}`;
          const oldRaw = await new Promise((res) => {
            chrome.storage.local.get(key, (r) => res(r ? r[key] : undefined));
          });
          const delta = JSON.stringify(entry).length - (oldRaw ? JSON.stringify(oldRaw).length : 0);
          const quota = chrome.storage.local.QUOTA_BYTES || 100 * 1024 * 1024;
          ok = used + delta <= quota;
        } catch (e) {
          ok = true; // measurement failed — let the set() attempt decide
        }
        if (!ok) throw quotaError();
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [`data_${sitemapId}`]: entry }, () => {
            const le = chrome.runtime && chrome.runtime.lastError;
            if (le && isQuotaErr(le)) {
              reject(quotaError());
              return;
            }
            resolve(entry);
          });
        });
      }

      if (this.db) {
        return this._saveScrapedDataIDB(sitemapId, list);
      }

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`ws_data_${sitemapId}`, JSON.stringify(entry));
        } catch (e) {
          if (isQuotaErr(e)) throw quotaError();
          throw e;
        }
      }
      return entry;
    }

    async getScrapedData(sitemapId) {
      await this.initPromise;
      if (!sitemapId) return [];

      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.get(`data_${sitemapId}`, (res) => {
            if ((chrome.runtime && chrome.runtime.lastError) || !res) {
              resolve([]);
              return;
            }
            const entry = res[`data_${sitemapId}`];
            resolve((entry && Array.isArray(entry.records)) ? entry.records : []);
          });
        });
      }

      if (this.db) {
        return (async () => {
          try {
            const res = await this._rawGetScrapedDataIDB(sitemapId);
            if (!res) return [];
            // Legacy monolithic entry (v1 layout): records live inline.
            if (Array.isArray(res.records) && res.records.length > 0) return res.records;
            if (res.chunkCount > 0) {
              const chunks = await this._rawGetDataChunksIDB(sitemapId);
              const out = [];
              for (const c of chunks) out.push(...c.records);
              return out;
            }
            return [];
          } catch (e) {
            return [];
          }
        })();
      }

      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`ws_data_${sitemapId}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            return parsed.records || [];
          } catch (e) {}
        }
      }
      return [];
    }

    async clearScrapedData(sitemapId) {
      await this.initPromise;
      if (!sitemapId) return true;

      if (this.isChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.remove(`data_${sitemapId}`, () => {
            resolve(true);
          });
        });
      }

      if (this.db) {
        // P1.4: remove the header AND the record chunks (otherwise a
        // cleared sitemap would leak orphaned chunks forever).
        const chunks = await this._rawGetDataChunksIDB(sitemapId);
        await this._idbDelete(STORE_DATA, sitemapId);
        await this._idbDeleteMany(STORE_DATA_CHUNKS, chunks.map((c) => c.chunkKey));
        return true;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`ws_data_${sitemapId}`);
      }
      return true;
    }
  }

  return new AppStorage();
}));
