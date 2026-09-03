const test = require('node:test');
const assert = require('node:assert/strict');

test('AppStorage - Chrome Storage Local Integration & No Deadlock', async () => {
  // Mock Chrome extension environment
  global.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        _store: {},
        get: function (keys, cb) {
          if (!keys) return cb(this._store);
          if (typeof keys === 'string') {
            const out = {};
            if (this._store[keys] !== undefined) out[keys] = this._store[keys];
            return cb(out);
          }
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach(k => { if (this._store[k] !== undefined) out[k] = this._store[k]; });
            return cb(out);
          }
          cb(this._store);
        },
        set: function (items, cb) {
          Object.assign(this._store, items);
          if (cb) cb();
        },
        remove: function (keys, cb) {
          if (Array.isArray(keys)) keys.forEach(k => delete this._store[k]);
          else delete this._store[keys];
          if (cb) cb();
        }
      }
    }
  };

  // Re-require fresh module
  delete require.cache[require.resolve('../chrome-edge/src/storage/Storage.js')];
  const AppStorage = require('../chrome-edge/src/storage/Storage.js');

  const initialList = await AppStorage.getAllSitemaps();
  assert.ok(Array.isArray(initialList));
  assert.ok(initialList.length >= 2); // Seeded default sitemaps

  // Save new sitemap
  const saved = await AppStorage.saveSitemap({
    _id: 'trendyol_magaza',
    name: 'Trendyol Mağaza',
    startUrl: ['https://trendyol.com/magaza']
  });
  assert.equal(saved._id, 'trendyol_magaza');

  // Fetch it
  const fetched = await AppStorage.getSitemap('trendyol_magaza');
  assert.ok(fetched);
  assert.equal(fetched.name, 'Trendyol Mağaza');

  // Save scraped data
  const sampleData = [{ title: 'Ürün 1', price: '100 TL' }, { title: 'Ürün 2', price: '200 TL' }];
  await AppStorage.saveScrapedData('trendyol_magaza', sampleData);

  const data = await AppStorage.getScrapedData('trendyol_magaza');
  assert.equal(data.length, 2);
  assert.equal(data[0].title, 'Ürün 1');

  // Delete sitemap
  await AppStorage.deleteSitemap('trendyol_magaza');
  const deleted = await AppStorage.getSitemap('trendyol_magaza');
  assert.equal(deleted, null);
});
