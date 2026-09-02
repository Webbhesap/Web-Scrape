const test = require('node:test');
const assert = require('node:assert/strict');
const UrlRangeExpander = require('../src/engine/UrlRangeExpander.js');

test('UrlRangeExpander - Static Single URL', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/products');
  assert.deepEqual(result, ['https://example.com/products']);
});

test('UrlRangeExpander - Numeric Range [1-5]', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/page/[1-5]');
  assert.deepEqual(result, [
    'https://example.com/page/1',
    'https://example.com/page/2',
    'https://example.com/page/3',
    'https://example.com/page/4',
    'https://example.com/page/5'
  ]);
});

test('UrlRangeExpander - Zero-Padded Range [001-004]', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/item-[001-004].html');
  assert.deepEqual(result, [
    'https://example.com/item-001.html',
    'https://example.com/item-002.html',
    'https://example.com/item-003.html',
    'https://example.com/item-004.html'
  ]);
});

test('UrlRangeExpander - Step Range [0-30:10]', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/offset/[0-30:10]');
  assert.deepEqual(result, [
    'https://example.com/offset/0',
    'https://example.com/offset/10',
    'https://example.com/offset/20',
    'https://example.com/offset/30'
  ]);
});

test('UrlRangeExpander - Alphabetic Range [a-d]', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/category/[a-d]');
  assert.deepEqual(result, [
    'https://example.com/category/a',
    'https://example.com/category/b',
    'https://example.com/category/c',
    'https://example.com/category/d'
  ]);
});

test('UrlRangeExpander - Value Sets [books,laptops,phones]', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/[books,laptops,phones]/list');
  assert.deepEqual(result, [
    'https://example.com/books/list',
    'https://example.com/laptops/list',
    'https://example.com/phones/list'
  ]);
});

test('UrlRangeExpander - Multi-Range Cartesian Combination', () => {
  const result = UrlRangeExpander.expandUrl('https://example.com/[a-b]/page/[1-2]');
  assert.deepEqual(result, [
    'https://example.com/a/page/1',
    'https://example.com/a/page/2',
    'https://example.com/b/page/1',
    'https://example.com/b/page/2'
  ]);
});

test('UrlRangeExpander - expandStartUrls with Deduplication', () => {
  const urls = [
    'https://example.com/page/[1-2]',
    'https://example.com/page/1',
    'https://example.com/static'
  ];
  const result = UrlRangeExpander.expandStartUrls(urls);
  assert.deepEqual(result, [
    'https://example.com/page/1',
    'https://example.com/page/2',
    'https://example.com/static'
  ]);
});
