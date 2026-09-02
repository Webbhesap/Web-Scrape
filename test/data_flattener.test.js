const test = require('node:test');
const assert = require('node:assert/strict');
const DataFlattener = require('../src/engine/DataFlattener.js');

test('DataFlattener - Flat tree leaf node conversion', () => {
  DataFlattener.resetOrderCounter();
  const tree = [
    {
      order: '1700000000-1',
      _meta: { startUrl: 'https://example.com' },
      data: {
        title: 'Laptop Pro',
        price: '$999',
        link: { text: 'View Laptop', href: 'https://example.com/laptop' }
      }
    }
  ];

  const flat = DataFlattener.flattenRecordTree(tree);
  assert.equal(flat.length, 1);
  assert.equal(flat[0]['web-scraper-order'], '1700000000-1');
  assert.equal(flat[0]['web-scraper-start-url'], 'https://example.com');
  assert.equal(flat[0].title, 'Laptop Pro');
  assert.equal(flat[0].price, '$999');
  assert.equal(flat[0].link, 'View Laptop');
  assert.equal(flat[0]['link-href'], 'https://example.com/laptop');
});

test('DataFlattener - Multi-level parent data inheritance', () => {
  DataFlattener.resetOrderCounter();
  const tree = [
    {
      _meta: { startUrl: 'https://example.com' },
      data: { category: 'Electronics' },
      children: [
        {
          order: '1700000000-1',
          data: { product: 'Phone', price: '$499' }
        },
        {
          order: '1700000000-2',
          data: { product: 'Tablet', price: '$699' }
        }
      ]
    }
  ];

  const flat = DataFlattener.flattenRecordTree(tree);
  assert.equal(flat.length, 2);
  assert.equal(flat[0].category, 'Electronics');
  assert.equal(flat[0].product, 'Phone');
  assert.equal(flat[1].category, 'Electronics');
  assert.equal(flat[1].product, 'Tablet');
});

test('DataFlattener - normalizeRecords column alignment', () => {
  const rows = [
    { 'web-scraper-order': '1', 'web-scraper-start-url': 'http://a', name: 'Item 1' },
    { 'web-scraper-order': '2', 'web-scraper-start-url': 'http://a', name: 'Item 2', price: '$10' }
  ];

  const normalized = DataFlattener.normalizeRecords(rows);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].price, '');
  assert.equal(normalized[1].price, '$10');
  assert.deepEqual(Object.keys(normalized[0]), ['web-scraper-order', 'web-scraper-start-url', 'name', 'price']);
});
