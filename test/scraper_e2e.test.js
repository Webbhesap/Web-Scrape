const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');

// Mock HTML Pages
const MOCK_PAGES = {
  'https://mystore.test/catalog': `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="store-name">Tech Haven</h1>
        <div class="product-item">
          <h2 class="title">MacBook Pro</h2>
          <span class="price">$1999</span>
          <a href="https://mystore.test/products/macbook" class="detail-link">Details</a>
        </div>
        <div class="product-item">
          <h2 class="title">Dell XPS</h2>
          <span class="price">$1499</span>
          <a href="https://mystore.test/products/dell" class="detail-link">Details</a>
        </div>
      </body>
    </html>
  `,
  'https://mystore.test/products/macbook': `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="product-heading">MacBook Pro 16</h1>
        <img src="https://mystore.test/img/mbp.png" class="hero-image">
        <table class="specs">
          <thead><tr><th>Key</th><th>Val</th></tr></thead>
          <tbody>
            <tr><td>Chip</td><td>M3 Max</td></tr>
            <tr><td>RAM</td><td>64GB</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `,
  'https://mystore.test/products/dell': `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="product-heading">Dell XPS 15</h1>
        <img src="https://mystore.test/img/xps.png" class="hero-image">
        <table class="specs">
          <thead><tr><th>Key</th><th>Val</th></tr></thead>
          <tbody>
            <tr><td>Chip</td><td>Intel i9</td></tr>
            <tr><td>RAM</td><td>32GB</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `
};

test('ScraperEngine E2E - Multi-level Link Navigation, Table Extraction & Record Flattening', async () => {
  const sitemap = new Sitemap({
    _id: 'tech_haven',
    name: 'Tech Haven Scraper',
    startUrl: ['https://mystore.test/catalog'],
    selectors: [
      {
        id: 'product_card',
        parentSelectors: ['_root'],
        type: 'SelectorElement',
        selector: 'div.product-item',
        multiple: true
      },
      {
        id: 'title',
        parentSelectors: ['product_card'],
        type: 'SelectorText',
        selector: 'h2.title',
        multiple: false
      },
      {
        id: 'price',
        parentSelectors: ['product_card'],
        type: 'SelectorText',
        selector: 'span.price',
        multiple: false
      },
      {
        id: 'detail_link',
        parentSelectors: ['product_card'],
        type: 'SelectorLink',
        selector: 'a.detail-link',
        multiple: false
      },
      {
        id: 'image',
        parentSelectors: ['detail_link'],
        type: 'SelectorImage',
        selector: 'img.hero-image',
        multiple: false
      },
      {
        id: 'specs_table',
        parentSelectors: ['detail_link'],
        type: 'SelectorTable',
        selector: 'table.specs',
        multiple: true
      }
    ]
  });

  // Mock fetcher
  const mockFetcher = async (url) => {
    const html = MOCK_PAGES[url];
    if (!html) throw new Error('404 Not Found: ' + url);
    const dom = new JSDOM(html, { url });
    return { document: dom.window.document, url };
  };

  const engine = new ScraperEngine(sitemap, {
    requestInterval: 0,
    pageLoadDelay: 0,
    fetcher: mockFetcher
  });

  return new Promise((resolve, reject) => {
    engine.on('finish', (summary) => {
      try {
        assert.equal(summary.pagesVisited, 3); // catalog + 2 product pages
        assert.ok(summary.totalRecords >= 4); // 2 products x 2 table rows each = 4 records!

        const results = summary.results;
        assert.ok(results.some(r => r.title === 'MacBook Pro' && r.Key === 'Chip' && r.Val === 'M3 Max'));
        assert.ok(results.some(r => r.title === 'Dell XPS' && r.Key === 'RAM' && r.Val === '32GB'));
        assert.ok(results.every(r => r['web-scraper-start-url'] === 'https://mystore.test/catalog'));

        // Test export to CSV
        const csv = Exporter.toCSV(results);
        assert.ok(csv.includes('MacBook Pro'));
        assert.ok(csv.includes('M3 Max'));

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    engine.on('error', (err) => {
      reject(err);
    });

    engine.start();
  });
});
