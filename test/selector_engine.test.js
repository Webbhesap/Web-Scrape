const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
const { Selector } = require('../chrome-edge/src/models/Selector.js');

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
  <body>
    <div id="content">
      <h1 class="page-title">  Sample Store Catalog  <br> 2026 </h1>
      <a href="/category/laptops" class="category-link">Laptops</a>
      <a href="https://other.com/phones" class="category-link" data-custom="cat-phones">Phones</a>

      <div class="product-card" data-sku="SKU-999">
        <h3 class="name">ThinkPad X1</h3>
        <span class="price">$1,299.99</span>
        <img src="/img/laptop.jpg" data-src="/img/laptop-hd.jpg" class="photo" alt="Laptop Photo">
        <div class="specs-html"><strong>Core:</strong> i7, 32GB RAM</div>
        <button onclick="window.open('/popup/details.html', 'pop')" class="details-popup">View Details</button>
      </div>

      <div class="tags">
        <span class="tag">Sale</span>
        <span class="tag">Featured</span>
        <span class="tag">Top Rated</span>
      </div>

      <table class="specs-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Specification</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Processor</td>
            <td>Intel Core Ultra 7</td>
          </tr>
          <tr>
            <td>Memory</td>
            <td>32GB LPDDR5x</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <a href="/catalog?page=2" class="next-page">Next</a>
      </div>
    </div>
  </body>
</html>
`;

test('SelectorEngine - Text Selector with Regex & Multiple', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  // Single Text
  const titleSel = new Selector({
    id: 'title',
    type: 'SelectorText',
    selector: 'h1.page-title',
    multiple: false
  });
  const title = engine.extract(dom.window.document, titleSel);
  assert.equal(title, 'Sample Store Catalog\n2026');

  // Text with Regex
  const priceSel = new Selector({
    id: 'price',
    type: 'SelectorText',
    selector: 'span.price',
    regex: '\\$([0-9\\.,]+)'
  });
  const price = engine.extract(dom.window.document, priceSel);
  assert.equal(price, '1,299.99');
});

test('SelectorEngine - Link Selector (Absolute URL resolution)', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const linkSel = new Selector({
    id: 'catLink',
    type: 'SelectorLink',
    selector: 'a.category-link',
    multiple: true
  });
  const links = engine.extract(dom.window.document, linkSel);
  assert.equal(links.length, 2);
  assert.equal(links[0].href, 'https://example.com/category/laptops');
  assert.equal(links[0].text, 'Laptops');
  assert.equal(links[1].href, 'https://other.com/phones');
});

test('SelectorEngine - Image Selector', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const imgSel = new Selector({
    id: 'image',
    type: 'SelectorImage',
    selector: 'img.photo',
    multiple: false
  });
  const src = engine.extract(dom.window.document, imgSel);
  assert.equal(src, 'https://example.com/img/laptop.jpg');
});

test('SelectorEngine - Table Selector', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const tableSel = new Selector({
    id: 'specs',
    type: 'SelectorTable',
    selector: 'table.specs-table',
    tableHeaderRowSelector: 'thead tr',
    tableDataRowSelector: 'tbody tr'
  });
  const rows = engine.extract(dom.window.document, tableSel);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { Feature: 'Processor', Specification: 'Intel Core Ultra 7' });
  assert.deepEqual(rows[1], { Feature: 'Memory', Specification: '32GB LPDDR5x' });
});

test('SelectorEngine - Element Attribute Selector', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const attrSel = new Selector({
    id: 'sku',
    type: 'SelectorElementAttribute',
    selector: 'div.product-card',
    extractAttribute: 'data-sku'
  });
  const sku = engine.extract(dom.window.document, attrSel);
  assert.equal(sku, 'SKU-999');
});

test('SelectorEngine - Grouped Selector', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const groupSel = new Selector({
    id: 'tags',
    type: 'SelectorGrouped',
    selector: 'div.tags span.tag',
    delimiter: ' | '
  });
  const tags = engine.extract(dom.window.document, groupSel);
  assert.equal(tags, 'Sale | Featured | Top Rated');
});

test('SelectorEngine - Pagination Selector', () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: 'https://example.com/catalog' });
  const engine = new SelectorEngine({ baseUrl: 'https://example.com/catalog' });

  const pageSel = new Selector({
    id: 'pagination',
    type: 'SelectorPagination',
    selector: 'a.next-page'
  });
  const nextUrls = engine.extractPagination(dom.window.document, pageSel);
  assert.deepEqual(nextUrls, ['https://example.com/catalog?page=2']);
});
