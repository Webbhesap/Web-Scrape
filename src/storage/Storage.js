/**
 * Storage Engine for Web Scraper.
 * IndexedDB database with chrome.storage.local and localStorage fallbacks.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'WebScraperDB';
  const DB_VERSION = 1;
  const STORE_SITEMAPS = 'sitemaps';
  const STORE_DATA = 'scraped_data';

  const SAMPLE_SITEMAPS = [
    {
      _id: 'sample-ecommerce-products',
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
      _id: 'sample-data-tables',
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
      this.isIndexedDBSupported = typeof indexedDB !== 'undefined';
      this.initPromise = this.init();
    }

    async init() {
      if (!this.isIndexedDBSupported) {
        return;
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_SITEMAPS)) {
            db.createObjectStore(STORE_SITEMAPS, { keyPath: '_id' });
          }
          if (!db.objectStoreNames.contains(STORE_DATA)) {
            db.createObjectStore(STORE_DATA, { keyPath: 'sitemapId' });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          // Seed samples if sitemaps empty
          const existing = await this.getAllSitemaps();
          if (existing.length === 0) {
            for (const s of SAMPLE_SITEMAPS) {
              await this.saveSitemap(s);
            }
          }
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.warn('IndexedDB failed to open, falling back to storage:', event.target.error);
          resolve(null);
        };
      });
    }

    async saveSitemap(sitemap) {
      await this.initPromise;
      const data = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : sitemap;
      if (!data._id) throw new Error('Sitemap must have an _id property.');

      data.updatedAt = new Date().toISOString();

      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_SITEMAPS], 'readwrite');
          const store = tx.objectStore(STORE_SITEMAPS);
          const req = store.put(data);
          req.onsuccess = () => resolve(data);
          req.onerror = () => reject(req.error);
        });
      }

      // chrome.storage fallback
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const key = `sitemap_${data._id}`;
        await chrome.storage.local.set({ [key]: data });
        return data;
      }

      // localStorage fallback
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`ws_sitemap_${data._id}`, JSON.stringify(data));
      }
      return data;
    }

    async getSitemap(sitemapId) {
      await this.initPromise;
      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_SITEMAPS], 'readonly');
          const store = tx.objectStore(STORE_SITEMAPS);
          const req = store.get(sitemapId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(`sitemap_${sitemapId}`);
        return res[`sitemap_${sitemapId}`] || null;
      }

      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(`ws_sitemap_${sitemapId}`);
        return item ? JSON.parse(item) : null;
      }
      return null;
    }

    async getAllSitemaps() {
      await this.initPromise;
      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_SITEMAPS], 'readonly');
          const store = tx.objectStore(STORE_SITEMAPS);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const all = await chrome.storage.local.get(null);
        const sitemaps = [];
        for (const k of Object.keys(all)) {
          if (k.startsWith('sitemap_')) {
            sitemaps.push(all[k]);
          }
        }
        return sitemaps;
      }

      const list = [];
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('ws_sitemap_')) {
            try {
              list.push(JSON.parse(localStorage.getItem(key)));
            } catch (e) {}
          }
        }
      }
      return list;
    }

    async deleteSitemap(sitemapId) {
      await this.initPromise;
      if (this.db) {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_SITEMAPS, STORE_DATA], 'readwrite');
          tx.objectStore(STORE_SITEMAPS).delete(sitemapId);
          tx.objectStore(STORE_DATA).delete(sitemapId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return true;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove([`sitemap_${sitemapId}`, `data_${sitemapId}`]);
        return true;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`ws_sitemap_${sitemapId}`);
        localStorage.removeItem(`ws_data_${sitemapId}`);
      }
      return true;
    }

    async saveScrapedData(sitemapId, records) {
      await this.initPromise;
      const entry = {
        sitemapId: sitemapId,
        scrapedAt: new Date().toISOString(),
        count: records.length,
        records: records
      };

      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_DATA], 'readwrite');
          const req = tx.objectStore(STORE_DATA).put(entry);
          req.onsuccess = () => resolve(entry);
          req.onerror = () => reject(req.error);
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [`data_${sitemapId}`]: entry });
        return entry;
      }

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`ws_data_${sitemapId}`, JSON.stringify(entry));
        } catch (e) {
          console.warn('LocalStorage quota exceeded for scraped data');
        }
      }
      return entry;
    }

    async getScrapedData(sitemapId) {
      await this.initPromise;
      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_DATA], 'readonly');
          const req = tx.objectStore(STORE_DATA).get(sitemapId);
          req.onsuccess = () => {
            const res = req.result;
            resolve(res ? res.records : []);
          };
          req.onerror = () => reject(req.error);
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(`data_${sitemapId}`);
        const entry = res[`data_${sitemapId}`];
        return entry ? entry.records : [];
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
      if (this.db) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_DATA], 'readwrite');
          const req = tx.objectStore(STORE_DATA).delete(sitemapId);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(`data_${sitemapId}`);
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
