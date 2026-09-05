const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const SelectorEngine = require('../chrome-edge/src/engine/SelectorEngine.js');
const { Selector } = require('../chrome-edge/src/models/Selector.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');

test('SelectorEngine - Popup Link Selector (onclick & data-url)', () => {
  const html = `
    <div>
      <a href="javascript:void(0)" onclick="window.open('https://example.com/popup1', 'pop')" id="btn1">Popup 1</a>
      <a href="#" data-url="https://example.com/popup2" id="btn2">Popup 2</a>
    </div>
  `;
  const dom = new JSDOM(html);
  const engine = new SelectorEngine({ baseUrl: 'https://example.com' });

  const popSel1 = new Selector({
    id: 'pop1',
    type: 'SelectorPopupLink',
    selector: '#btn1'
  });
  const res1 = engine.extract(dom.window.document, popSel1);
  assert.equal(res1.href, 'https://example.com/popup1');

  const popSel2 = new Selector({
    id: 'pop2',
    type: 'SelectorPopupLink',
    selector: '#btn2'
  });
  const res2 = engine.extract(dom.window.document, popSel2);
  assert.equal(res2.href, 'https://example.com/popup2');
});

test('SelectorEngine - HTML Selector (Inner vs Outer HTML)', () => {
  const html = `<div class="content"><p>Paragraph 1</p><p>Paragraph 2</p></div>`;
  const dom = new JSDOM(html);
  const engine = new SelectorEngine();

  const innerSel = new Selector({
    id: 'inner',
    type: 'SelectorHTML',
    selector: '.content',
    outerHTML: false
  });
  const innerResult = engine.extract(dom.window.document, innerSel);
  assert.equal(innerResult, '<p>Paragraph 1</p><p>Paragraph 2</p>');

  const outerSel = new Selector({
    id: 'outer',
    type: 'SelectorHTML',
    selector: '.content',
    outerHTML: true
  });
  const outerResult = engine.extract(dom.window.document, outerSel);
  assert.equal(outerResult, '<div class="content"><p>Paragraph 1</p><p>Paragraph 2</p></div>');
});

test('SelectorEngine - Table with Custom Column Renaming & Exclusion', () => {
  const html = `
    <table class="data">
      <thead><tr><th>Col A</th><th>Col B</th><th>Col C</th></tr></thead>
      <tbody>
        <tr><td>Val 1</td><td>Val 2</td><td>Val 3</td></tr>
        <tr><td>Val 4</td><td>Val 5</td><td>Val 6</td></tr>
      </tbody>
    </table>
  `;
  const dom = new JSDOM(html);
  const engine = new SelectorEngine();

  const tableSel = new Selector({
    id: 'myTable',
    type: 'SelectorTable',
    selector: 'table.data',
    columns: [
      { header: 'Col A', name: 'first_column', extract: true },
      { header: 'Col B', name: 'second_column', extract: false }, // Excluded!
      { header: 'Col C', name: 'third_column', extract: true }
    ]
  });

  const records = engine.extract(dom.window.document, tableSel);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], { first_column: 'Val 1', third_column: 'Val 3' });
  assert.deepEqual(records[1], { first_column: 'Val 4', third_column: 'Val 6' });
});

test('Sitemap - Full JSON Export and Re-Import Roundtrip', () => {
  const original = new Sitemap({
    _id: 'sample_ecommerce',
    name: 'Sample E-Commerce Store',
    startUrl: ['https://example.com/shop/[1-10]', 'https://example.com/specials'],
    selectors: [
      {
        id: 'category',
        type: 'SelectorLink',
        selector: '.cat-link',
        multiple: true,
        parentSelectors: ['_root']
      },
      {
        id: 'product',
        type: 'SelectorElement',
        selector: '.card',
        multiple: true,
        parentSelectors: ['category']
      },
      {
        id: 'price',
        type: 'SelectorText',
        selector: '.price',
        regex: '\\$([0-9\\.]+)',
        multiple: false,
        parentSelectors: ['product']
      }
    ]
  });

  const jsonString = Exporter.toJSON(original.toJSON());
  const imported = Sitemap.fromJSON(jsonString);

  assert.equal(imported._id, 'sample_ecommerce');
  assert.equal(imported.startUrl.length, 2);
  assert.equal(imported.selectors.length, 3);
  assert.equal(imported.getSelectorById('price').regex, '\\$([0-9\\.]+)');
  assert.deepEqual(imported.getSelectorById('price').parentSelectors, ['product']);
});

test('SelectorEngine - PopupLink honours transforms/regex/defaultValue (audit fix B1)', () => {
  const html = `
    <div>
      <a href="javascript:void(0)" onclick="window.open('https://example.com/detail', 'pop')" id="p1">  PRICE: 199 TL  </a>
      <a href="javascript:void(0)" onclick="window.open('https://example.com/missing', 'pop')" id="p2" style="display:none"></a>
      <div class="pop-multi"><a href="#" data-url="https://example.com/a" id="m1"> A </a><a href="#" data-url="https://example.com/b" id="m2"> B </a></div>
    </div>
  `;
  const dom = new JSDOM(html);
  const engine = new SelectorEngine({ baseUrl: 'https://example.com' });

  // transform + regex (capture-group extraction, the engine's contract):
  // grab the amount after "PRICE:", lowercase it
  const s1 = new Selector({
    id: 'p1',
    type: 'SelectorPopupLink',
    selector: '#p1',
    regex: '^PRICE:\\s*(.+)$',
    transforms: [{ type: 'lowercase' }]
  });
  const r1 = engine.extract(dom.window.document, s1);
  assert.equal(r1.text, '199 tl', 'regex capture + lowercase applied');
  assert.equal(r1.href, 'https://example.com/detail');

  // defaultValue when the element has no text
  const s2 = new Selector({
    id: 'p2',
    type: 'SelectorPopupLink',
    selector: '#p2',
    defaultValue: 'n/a'
  });
  const r2 = engine.extract(dom.window.document, s2);
  assert.equal(r2.text, 'n/a', 'defaultValue applied for empty popup link text');

  // multiple: transforms applied per item
  const s3 = new Selector({
    id: 'pm',
    type: 'SelectorPopupLink',
    selector: '.pop-multi a',
    multiple: true,
    transforms: [{ type: 'trim' }]
  });
  const r3 = engine.extract(dom.window.document, s3);
  assert.deepEqual(r3.map((x) => x.text), ['A', 'B'], 'per-item transforms in multiple mode');
});
