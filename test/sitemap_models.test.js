const test = require('node:test');
const assert = require('node:assert/strict');
const { Selector } = require('../chrome-edge/src/models/Selector.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');

test('Selector Model - Validation & Serialization', () => {
  const sel = new Selector({
    id: 'product_name',
    type: 'SelectorText',
    selector: 'h2.title',
    multiple: false,
    parentSelectors: ['_root']
  });

  const valid = sel.validate();
  assert.ok(valid.isValid);

  const json = sel.toJSON();
  assert.equal(json.id, 'product_name');
  assert.equal(json.type, 'SelectorText');
  assert.deepEqual(json.parentSelectors, ['_root']);
});

test('Selector Model - Invalid selector error detection', () => {
  const sel = new Selector({
    id: 'invalid id with spaces!',
    type: 'SelectorText',
    selector: '',
    parentSelectors: []
  });

  const valid = sel.validate();
  assert.ok(!valid.isValid);
  assert.ok(valid.errors.length >= 2);
});

test('Sitemap Model - Lifecycle & Selector hierarchy', () => {
  const sitemap = new Sitemap({
    _id: 'test_store',
    name: 'Test Store',
    startUrl: ['https://example.com/items/[1-2]'],
    selectors: [
      {
        id: 'category',
        type: 'SelectorLink',
        selector: 'a.cat',
        multiple: true,
        parentSelectors: ['_root']
      },
      {
        id: 'title',
        type: 'SelectorText',
        selector: 'h1',
        multiple: false,
        parentSelectors: ['category']
      }
    ]
  });

  const validation = sitemap.validate();
  assert.ok(validation.isValid, validation.errors.join(', '));

  assert.equal(sitemap.getRootSelectors().length, 1);
  assert.equal(sitemap.getRootSelectors()[0].id, 'category');

  assert.equal(sitemap.getDirectChildSelectors('category').length, 1);
  assert.equal(sitemap.getDirectChildSelectors('category')[0].id, 'title');

  const expandedUrls = sitemap.getExpandedStartUrls();
  assert.deepEqual(expandedUrls, ['https://example.com/items/1', 'https://example.com/items/2']);

  // Remove selector and clean children
  sitemap.removeSelector('category');
  assert.equal(sitemap.selectors.length, 1);
  assert.deepEqual(sitemap.selectors[0].parentSelectors, ['_root']); // cleaned up to _root
});

test('Sitemap Model - Drag reparent without cycles', () => {
  const sitemap = new Sitemap({
    _id: 'nest',
    startUrl: ['https://example.com'],
    selectors: [
      { id: 'card', type: 'SelectorElement', selector: '.card', parentSelectors: ['_root'] },
      { id: 'title', type: 'SelectorText', selector: 'h1', parentSelectors: ['_root'] }
    ]
  });
  assert.equal(sitemap.reparentSelector('title', 'card'), true);
  assert.deepEqual(sitemap.getSelectorById('title').parentSelectors, ['card']);
  assert.equal(sitemap.reparentSelector('card', 'title'), false);
  assert.equal(sitemap.reparentSelector('title', 'title'), false);
  sitemap.reparentSelector('title', '_root');
  assert.equal(sitemap.reorderSibling('title', 'card', false), true);
  assert.equal(sitemap.selectors[0].id, 'title');
});

test('Sitemap Model - Auto Slugification & URL Normalization', () => {
  const sitemap = new Sitemap({
    _id: 'My Special E-Commerce Store 2026!',
    startUrl: ['example.com/items', 'http://store.org']
  });

  assert.equal(sitemap._id, 'my_special_e-commerce_store_2026');
  assert.equal(sitemap.name, 'My Special E-Commerce Store 2026!');
  assert.deepEqual(sitemap.startUrl, ['https://example.com/items', 'http://store.org']);

  const valid = sitemap.validate();
  assert.ok(valid.isValid);
});
