/**
 * P1.4 — IndexedDB chunked record writes + quota overflow behavior.
 *
 * jsdom does not ship IndexedDB, so this test drives Storage.js against a
 * small in-memory fake that implements exactly the IDB surface Storage.js
 * uses (open/upgradeneeded, transactions, put/get/delete/getAll,
 * index().getAll(), oncomplete/onabort with QuotaExceededError) and can
 * enforce a byte quota.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const STORAGE_PATH = require.resolve('../chrome-edge/src/storage/Storage.js');

function makeQuotaErr() {
  const e = new Error('QuotaExceededError');
  e.name = 'QuotaExceededError';
  return e;
}

function makeFakeIDB(quotaBytes = Infinity) {
  const databases = new Map(); // name -> { stores, indexes, bytes, quota }
  const sizeOf = (v) => JSON.stringify(v).length;

  class IDBRequest {
    constructor() {
      this.result = undefined;
      this.error = null;
      this.onsuccess = null;
      this.onerror = null;
      this._fired = false;
    }
    _fire(success) {
      if (this._fired) return;
      this._fired = true;
      if (success) { if (this.onsuccess) this.onsuccess({ target: this }); }
      else { if (this.onerror) this.onerror({ target: this }); }
    }
  }

  class Transaction {
    constructor(db, storeNames, mode) {
      this._db = db;
      this.mode = mode;
      this.objectStoreNames = { contains: (n) => storeNames.includes(n) };
      this.error = null;
      this.oncomplete = null;
      this.onabort = null;
      this.onerror = null;
      this._ops = [];
      this._aborted = false;
      this._running = false;
    }

    objectStore(name) {
      const self = this;
      return {
        put: (value) => self._put(name, value),
        get: (key) => self._get(name, key),
        delete: (key) => self._del(name, key),
        getAll: () => self._getAll(name),
        index: (idxName) => self._indexGetAll(name, idxName)
      };
    }

    _put(name, value) {
      const req = new IDBRequest();
      this._ops.push(() => {
        const store = this._db.stores.get(name);
        const key = value[store.keyPath];
        const old = store.get(key);
        const delta = sizeOf(value) - (old === undefined ? 0 : sizeOf(old));
        if (this._db.bytes + delta > this._db.quota) {
          this._abort(req, makeQuotaErr());
          return;
        }
        if (old !== undefined) {
          store.delete(key);
          this._db.bytes -= sizeOf(old);
        }
        store.set(key, value);
        this._db.bytes += sizeOf(value);
        req.result = key;
        req._fire(true);
      });
      this._run();
      return req;
    }

    _get(name, key) {
      const req = new IDBRequest();
      this._ops.push(() => {
        req.result = this._db.stores.get(name).get(key);
        req._fire(true);
      });
      this._run();
      return req;
    }

    _del(name, key) {
      const req = new IDBRequest();
      this._ops.push(() => {
        const store = this._db.stores.get(name);
        const old = store.get(key);
        if (old !== undefined) {
          store.delete(key);
          this._db.bytes -= sizeOf(old);
        }
        req.result = undefined;
        req._fire(true);
      });
      this._run();
      return req;
    }

    _getAll(name) {
      const req = new IDBRequest();
      this._ops.push(() => {
        req.result = [...this._db.stores.get(name).data.values()];
        req._fire(true);
      });
      this._run();
      return req;
    }

    _indexGetAll(name, idxName) {
      const self = this;
      const def = this._db.indexes.get(name + '@' + idxName);
      return {
        getAll: (value) => {
          const req = new IDBRequest();
          self._ops.push(() => {
            req.result = [...self._db.stores.get(name).data.values()].filter((r) => r[def.path] === value);
            req._fire(true);
          });
          self._run();
          return req;
        }
      };
    }

    _run() {
      if (this._running) return;
      this._running = true;
      const step = () => {
        if (this._aborted) return;
        const op = this._ops.shift();
        if (!op) {
          setTimeout(() => { if (this.oncomplete) this.oncomplete({ target: this }); }, 0);
          return;
        }
        try {
          op();
        } catch (e) {
          this._abort(null, e);
          return;
        }
        if (!this._aborted) setTimeout(step, 0);
      };
      setTimeout(step, 0);
    }

    _abort(req, err) {
      if (this._aborted) return;
      this._aborted = true;
      this.error = err;
      if (req) req.error = err;
      setTimeout(() => {
        if (req && !req._fired) req._fire(false);
        if (this.onabort) this.onabort({ target: this });
      }, 0);
    }
  }

  const fakeDB = (name) => ({
    name,
    objectStoreNames: { contains: (n) => databases.get(name).stores.has(n) },
    transaction: (names, mode) => new Transaction(databases.get(name), names, mode),
    close() {}
  });

  return {
    _databases: databases,
    open(name, version) {
      const req = new IDBRequest();
      setTimeout(() => {
        let db = databases.get(name);
        if (!db) {
          db = { stores: new Map(), indexes: new Map(), bytes: 0, quota: quotaBytes };
          databases.set(name, db);
          const upgradeDb = {
            objectStoreNames: { contains: (n) => db.stores.has(n) },
            createObjectStore: (storeName, opts) => {
              db.stores.set(storeName, { data: new Map(), keyPath: opts && opts.keyPath });
              const fakeStore = db.stores.get(storeName);
              fakeStore.get = (k) => fakeStore.data.get(k);
              fakeStore.set = (k, v) => fakeStore.data.set(k, v);
              fakeStore.delete = (k) => fakeStore.data.delete(k);
              return {
                createIndex: (idxName, path) => {
                  db.indexes.set(storeName + '@' + idxName, { path });
                }
              };
            }
          };
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: upgradeDb } });
        }
        req.result = fakeDB(name);
        req._fire(true);
      }, 0);
      return req;
    }
  };
}

function freshStorage(fakeIDB) {
  global.indexedDB = fakeIDB;
  delete require.cache[STORAGE_PATH];
  return require(STORAGE_PATH);
}

const makeRecords = (n, prefix) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ 'web-scraper-order': String(i), name: `${prefix}-${i}`, value: 'x'.repeat(20) });
  return out;
};

test('P1.4 - large record sets are stored in chunks and read back in order', async () => {
  const storage = freshStorage(makeFakeIDB());
  const records = makeRecords(5000, 'rec');
  const header = await storage.saveScrapedData('big_one', records);
  assert.equal(header.count, 5000);
  assert.equal(header.chunkCount, 3, '5000 records => 3 chunks of 2000');
  assert.deepEqual(header.records, [], 'header itself carries no records');

  const back = await storage.getScrapedData('big_one');
  assert.equal(back.length, 5000);
  assert.equal(back[0].name, 'rec-0');
  assert.equal(back[2000].name, 'rec-2000');
  assert.equal(back[4999].name, 'rec-4999');
});

test('P1.4 - v1 monolithic entries remain readable (backward compatibility)', async () => {
  const fake = makeFakeIDB();
  const storage = freshStorage(fake);
  // Wait for init (which opens the db), then write a legacy-style entry
  // directly into the store, exactly as the old code did.
  await storage.initPromise;
  const db = fake._databases.get('WebScraperDB');
  const legacy = { sitemapId: 'legacy_v1', scrapedAt: '2024-01-01T00:00:00.000Z', count: 3, records: makeRecords(3, 'old') };
  db.stores.get('scraped_data').set('legacy_v1', legacy);
  db.bytes += JSON.stringify(legacy).length;

  const back = await storage.getScrapedData('legacy_v1');
  assert.equal(back.length, 3);
  assert.equal(back[0].name, 'old-0');
});

test('P1.4 - quota overflow rejects, keeps the previous data, leaves no orphan chunks', async () => {
  // Budget: ~350KB. The first save (~210KB) fits; the second (~1MB) does not.
  const fake = makeFakeIDB(350000);
  const storage = freshStorage(fake);

  const first = makeRecords(4000, 'fits'); // ~210KB
  await storage.saveScrapedData('quota_site', first);
  assert.equal((await storage.getScrapedData('quota_site')).length, 4000);

  const second = makeRecords(20000, 'too_big'); // ~1MB
  let rejected = null;
  try {
    await storage.saveScrapedData('quota_site', second);
  } catch (e) {
    rejected = e;
  }
  assert.ok(rejected, 'the oversized save rejected');
  assert.equal(rejected.code, 'QUOTA_EXCEEDED');

  // The previous data must be back (rollback), and no partial new chunks.
  const back = await storage.getScrapedData('quota_site');
  assert.equal(back.length, 4000, 'previous records restored after quota failure');
  assert.equal(back[0].name, 'fits-0');
  const db = fake._databases.get('WebScraperDB');
  const chunkKeys = [...db.stores.get('scraped_data_chunks').data.keys()].filter((k) => k.startsWith('quota_site__'));
  assert.equal(chunkKeys.length, 2, 'exactly the two original chunks remain (no orphans)');
});

test('P1.4 - re-saving replaces old chunks (no duplicates accumulate)', async () => {
  const fake = makeFakeIDB();
  const storage = freshStorage(fake);
  await storage.saveScrapedData('overwrite', makeRecords(3000, 'v1'));
  await storage.saveScrapedData('overwrite', makeRecords(1000, 'v2'));
  const back = await storage.getScrapedData('overwrite');
  assert.equal(back.length, 1000, 'only the newest records remain');
  assert.equal(back[0].name, 'v2-0');
  const db = fake._databases.get('WebScraperDB');
  const chunkKeys = [...db.stores.get('scraped_data_chunks').data.keys()].filter((k) => k.startsWith('overwrite__'));
  assert.equal(chunkKeys.length, 1, 'old 3000-record chunks were removed');
});

test('P1.4 - clearScrapedData removes header AND chunks', async () => {
  const fake = makeFakeIDB();
  const storage = freshStorage(fake);
  await storage.saveScrapedData('to_clear', makeRecords(3000, 'x'));
  assert.equal((await storage.getScrapedData('to_clear')).length, 3000);
  await storage.clearScrapedData('to_clear');
  assert.deepEqual(await storage.getScrapedData('to_clear'), []);
  const db = fake._databases.get('WebScraperDB');
  const chunkKeys = [...db.stores.get('scraped_data_chunks').data.keys()].filter((k) => k.startsWith('to_clear__'));
  assert.equal(chunkKeys.length, 0, 'all chunks removed');
  assert.equal(db.stores.get('scraped_data').data.has('to_clear'), false, 'header removed');
});

test('P1.4 - saving zero records is a valid (empty) state', async () => {
  const storage = freshStorage(makeFakeIDB());
  const header = await storage.saveScrapedData('empty_site', []);
  assert.equal(header.count, 0);
  assert.equal(header.chunkCount, 0);
  assert.deepEqual(await storage.getScrapedData('empty_site'), []);
});

test('P1.4 - deleteSitemap removes the record chunks too (no orphan leak)', async () => {
  // Regression: clearScrapedData() deleted the chunk records but
  // deleteSitemap() only removed the sitemap row and the data HEADER, so
  // every chunk of a deleted sitemap stayed in IndexedDB forever — storage
  // grew with each delete/re-create/re-scrape cycle and was never reclaimed.
  const fake = makeFakeIDB();
  const storage = freshStorage(fake);

  await storage.saveSitemap({ _id: 'doomed', name: 'Doomed', startUrl: ['https://x.test/'] });
  await storage.saveScrapedData('doomed', makeRecords(5000, 'gone')); // 3 chunks
  const db = fake._databases.get('WebScraperDB');
  assert.equal(
    [...db.stores.get('scraped_data_chunks').data.keys()].filter((k) => k.startsWith('doomed__')).length,
    3, 'three chunks written'
  );

  await storage.deleteSitemap('doomed');

  assert.equal(await storage.getSitemap('doomed'), null, 'sitemap row removed');
  assert.deepEqual(await storage.getScrapedData('doomed'), [], 'no data readable');
  assert.equal(db.stores.get('scraped_data').data.has('doomed'), false, 'header removed');
  assert.equal(
    [...db.stores.get('scraped_data_chunks').data.keys()].filter((k) => k.startsWith('doomed__')).length,
    0, 'every chunk removed with the sitemap'
  );
});

test('P1.4 - deleteSitemap reclaims chunks even when the header is stale', async () => {
  // A partially written pass can leave chunk records whose header claims a
  // smaller chunkCount. The key union (index report + declared count) must
  // still collect them all.
  const fake = makeFakeIDB();
  const storage = freshStorage(fake);
  await storage.initPromise;
  const db = fake._databases.get('WebScraperDB');

  // Orphan chunks with no header at all.
  db.stores.get('scraped_data_chunks').set('orphan__0', { chunkKey: 'orphan__0', sitemapId: 'orphan', chunkIndex: 0, records: makeRecords(2, 'o') });
  // A header that under-reports the chunk count.
  db.stores.get('scraped_data').set('stale', { sitemapId: 'stale', count: 4000, records: [], chunkCount: 1 });
  db.stores.get('scraped_data_chunks').set('stale__0', { chunkKey: 'stale__0', sitemapId: 'stale', chunkIndex: 0, records: [] });
  db.stores.get('scraped_data_chunks').set('stale__1', { chunkKey: 'stale__1', sitemapId: 'stale', chunkIndex: 1, records: [] });

  await storage.deleteSitemap('orphan');
  await storage.deleteSitemap('stale');

  const left = [...db.stores.get('scraped_data_chunks').data.keys()];
  assert.equal(left.filter((k) => k.startsWith('orphan__')).length, 0, 'index-found orphan removed');
  assert.equal(left.filter((k) => k.startsWith('stale__')).length, 0, 'header-under-reported chunk removed too');
});
