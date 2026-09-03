const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const CssSelectorGenerator = require('../chrome-edge/src/engine/CssSelectorGenerator.js');

test('CssSelectorGenerator - Unique ID selector', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="main-header">Title</div></body></html>');
  const el = dom.window.document.getElementById('main-header');
  const sel = CssSelectorGenerator.getUniqueSelectorForElement(el, dom.window.document);
  assert.equal(sel, '#main-header');
});

test('CssSelectorGenerator - Unique Class selector', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><h1 class="product-title">My Product</h1><p>Desc</p></body></html>');
  const el = dom.window.document.querySelector('.product-title');
  const sel = CssSelectorGenerator.getUniqueSelectorForElement(el, dom.window.document);
  assert.ok(sel.includes('product-title'));
});

test('CssSelectorGenerator - Generalize Multiple Elements', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div class="product-wrapper item">
          <h2 class="title">Product 1</h2>
        </div>
        <div class="product-wrapper item">
          <h2 class="title">Product 2</h2>
        </div>
        <div class="product-wrapper item">
          <h2 class="title">Product 3</h2>
        </div>
      </body>
    </html>
  `);
  const elements = Array.from(dom.window.document.querySelectorAll('.product-wrapper'));
  const generalized = CssSelectorGenerator.getGeneralizedSelectorForElements(elements, dom.window.document);
  assert.ok(generalized.includes('.product-wrapper') || generalized.includes('.item'));
});

test('CssSelectorGenerator - Filters dynamic/active classes', () => {
  const dom = new JSDOM('<div class="product-card active hover open"></div>');
  const el = dom.window.document.querySelector('.product-card');
  const cleanClasses = CssSelectorGenerator.getCleanClasses(el);
  assert.deepEqual(cleanClasses, ['product-card']);
});
