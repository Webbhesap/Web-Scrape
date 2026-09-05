/**
 * P3.10 — "robots.txt yerel okuyucu (opsiyonel anahtar) ve tarama başlığı
 * seçicileri" (Plan.md roadmap item 10):
 *
 * - lib/robots.js: dependency-free robots.txt parser (User-agent groups,
 *   Allow/Disallow, `*` wildcards, `$` anchors, most-specific-agent and
 *   longest-path-wins semantics) + tolerant fetchRules.
 * - ScraperEngine: opt-in `respectRobots` key — disallowed pages are skipped
 *   (not visited, no page budget, logged) when the sitemap opts in; OFF by
 *   default so existing crawls are byte-identical.
 * - Page-title selector ("tarama başlığı seçicisi"): a per-sitemap CSS
 *   selector whose matched element's text is stored on EVERY record under a
 *   configurable field name.
 * - Sitemap meta form: the optional robots key + the title selector controls
 *   round-trip through storage.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const Robots = require('../chrome-edge/lib/robots.js');
const ScraperEngine = require('../chrome-edge/src/engine/ScraperEngine.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');

// ---------------------------------------------------------------------------
// robots.txt parser
// ---------------------------------------------------------------------------
test('P3.10 - robots parser: allow/disallow, wildcards, anchors, agent groups', () => {
  const text = [
    '# comment line',
    'User-agent: *',
    'Disallow: /private/',
    'Allow: /private/public-page',
    'Disallow: /tmp/*',
    'Disallow: /exact$',
    'Disallow:',
    '',
    'User-agent: MyBot',
    'Disallow: /'
  ].join('\n');
  const rules = Robots.parse(text);
  assert.ok(rules, 'parses the body');

  assert.equal(Robots.isAllowed('https://s.test/public', rules, '*'), true);
  assert.equal(Robots.isAllowed('https://s.test/private/x', rules, '*'), false, 'disallowed prefix');
  assert.equal(Robots.isAllowed('https://s.test/private/public-page', rules, '*'), true, 'longer Allow wins');
  assert.equal(Robots.isAllowed('https://s.test/tmp/a/b', rules, '*'), false, 'wildcard *');
  assert.equal(Robots.isAllowed('https://s.test/tmpa', rules, '*'), true, 'prefix alone is fine');
  assert.equal(Robots.isAllowed('https://s.test/exact', rules, '*'), false, '$ anchor matches');
  assert.equal(Robots.isAllowed('https://s.test/exact2', rules, '*'), true, '$ anchor rejects longer');

  // Most-specific agent group wins over *.
  assert.equal(Robots.isAllowed('https://s.test/anything', rules, 'MyBot 2.0'), false);
  assert.equal(Robots.isAllowed('https://s.test/anything', rules, 'OtherBot'), true);
  // Query strings are part of the matched path.
  assert.equal(Robots.isAllowed('https://s.test/private/x?ref=1', rules, '*'), false);
});

test('P3.10 - robots parser edge cases + tolerant fetchRules', async () => {
  assert.equal(Robots.parse(''), null);
  assert.equal(Robots.parse('   \n  '), null, 'blank body -> null');
  assert.equal(Robots.parse('Disallow: /nope'), null, 'rules before any User-agent line are ignored');

  const bare = Robots.parse('User-agent: *\n');
  assert.ok(bare, 'a bare agent group still parses');
  assert.equal(Robots.isAllowed('https://s.test/x', bare, '*'), true);

  // null rules / odd URLs never block.
  assert.equal(Robots.isAllowed('not-a-url', null, '*'), true);
  assert.equal(Robots.isAllowed('file:///local/x', null, '*'), true);

  const okFetch = async () => ({ ok: true, text: async () => 'User-agent: *\nDisallow: /admin' });
  const r1 = await Robots.fetchRules('https://s.test', okFetch);
  assert.equal(Robots.isAllowed('https://s.test/admin/x', r1, '*'), false, 'fetched rules enforced');
  assert.equal(await Robots.fetchRules('https://s.test', async () => ({ ok: false })), null, 'non-2xx -> null');
  assert.equal(await Robots.fetchRules('https://s.test', async () => { throw new Error('CORS'); }), null, 'error -> null');
});

// ---------------------------------------------------------------------------
// engine integration
// ---------------------------------------------------------------------------
const PAGES = {
  'https://site.test/ok': '<html><head><title>OK page</title></head><body><h1>OK Header</h1><p class="txt">fine</p></body></html>',
  'https://site.test/private/x': '<html><body><p class="txt">secret</p></body></html>'
};
const ROBOTSTXT = 'User-agent: *\nDisallow: /private/';

const makeDoc = (html) => new JSDOM(html).window.document;

function makeEngine(sitemap, engineOptions) {
  const engine = new ScraperEngine(sitemap, Object.assign({
    requestInterval: 0,
    pageLoadDelay: 0,
    maxPages: 10,
    concurrency: 1,
    requestRetries: 0,
    fetcher: async (url) => {
      if (!(url in PAGES)) throw new Error('no page for ' + url);
      return { document: makeDoc(PAGES[url]), url };
    }
  }, engineOptions));
  const errors = [];
  engine.on('error', (e) => errors.push(e));
  return { engine, errors };
}

async function withRobotsFetch(fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://site.test/robots.txt')) {
      return { ok: true, text: async () => ROBOTSTXT };
    }
    throw new Error('unexpected network fetch: ' + url);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('P3.10 - engine skips robots-disallowed pages only when opted in', async () => {
  const sitemap = new Sitemap({
    _id: 'rt_on', name: 'RT On',
    startUrl: ['https://site.test/ok', 'https://site.test/private/x'],
    selectors: [{ id: 'txt', type: 'SelectorText', selector: '.txt', parentSelectors: ['_root'] }],
    options: {
      respectRobots: true,
      pageTitle: { enabled: true, selector: 'h1', field: 'pageHeader' }
    }
  });
  // Model normalizes the optional keys.
  assert.equal(sitemap.options.respectRobots, true);
  assert.equal(sitemap.options.pageTitle.selector, 'h1');
  assert.equal(sitemap.options.robotsUserAgent, '*');

  await withRobotsFetch(async () => {
    const { engine, errors } = makeEngine(sitemap, {
      respectRobots: true,
      pageTitle: sitemap.options.pageTitle
    });
    await engine.start();

    assert.equal(engine.results.length, 1, 'only the allowed page produced records');
    const rec = engine.results[0];
    assert.equal(rec.txt, 'fine');
    assert.equal(rec.pageHeader, 'OK Header', 'page-title selector value on the record');
    assert.ok(!engine.visitedUrls.has('https://site.test/private/x'), 'blocked page not marked visited');
    assert.equal(engine.pagesVisited, 1, 'blocked page spent no page budget');
    assert.ok(
      errors.some((e) => e && String(e.error || '').includes('robots.txt')),
      'the skip is logged for transparency: ' + JSON.stringify(errors)
    );
  });
});

test('P3.10 - robots mode is opt-in: default sitemap crawls everything, title uses defaults', async () => {
  const sitemap = new Sitemap({
    _id: 'rt_off', name: 'RT Off',
    startUrl: ['https://site.test/ok', 'https://site.test/private/x'],
    selectors: [{ id: 'txt', type: 'SelectorText', selector: '.txt', parentSelectors: ['_root'] }],
    // no options at all -> defaults
  });
  assert.equal(sitemap.options.respectRobots, false, 'default is OFF');
  assert.deepEqual(sitemap.options.pageTitle, { enabled: false, selector: 'title', field: 'pageTitle' });

  await withRobotsFetch(async () => {
    const { engine } = makeEngine(sitemap, {
      // respectRobots left at its default (false), title enabled via defaults shape
      pageTitle: { enabled: true, selector: 'title', field: 'pageTitle' }
    });
    await engine.start();

    assert.equal(engine.results.length, 2, 'both pages scraped when the key is off');
    assert.ok(engine.visitedUrls.has('https://site.test/private/x'), 'private page crawled');
    const okRec = engine.results.find((r) => r.txt === 'fine');
    assert.equal(okRec.pageTitle, 'OK page', 'default selector is <title>');
  });
});

// ---------------------------------------------------------------------------
// UI: sitemap meta form round-trips the two new optional keys
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..', 'chrome-edge');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bootDashboard() {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/dashboard/dashboard.html',
    pretendToBeVisual: true
  });
  const win = dom.window;
  if (typeof win.TextEncoder === 'undefined') win.TextEncoder = TextEncoder;

  const db = {};
  win.chrome = {
    runtime: { getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: {
      local: {
        QUOTA_BYTES: 104857600,
        getBytesInUse: (keys, cb) => cb(0),
        get: (keys, cb) => {
          if (keys == null) return cb({ ...db });
          if (typeof keys === 'string') return cb(db[keys] !== undefined ? { [keys]: db[keys] } : {});
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys)).forEach((k) => { if (db[k] !== undefined) out[k] = db[k]; });
          return cb(out);
        },
        set: (obj, cb) => { Object.assign(db, obj); if (cb) cb(); },
        remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete db[k]); if (cb) cb(); }
      }
    }
  };
  win.alert = (m) => { win.__alerts = win.__alerts || []; win.__alerts.push(String(m)); };
  win.confirm = () => true;

  const SCRIPTS = [
    'lib/csv.js', 'lib/xlsx.js', 'lib/icons.js', 'lib/transforms.js',
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/engine/CssSelectorGenerator.js', 'src/engine/SelectorEngine.js',
    'src/engine/DataFlattener.js', 'lib/robots.js', 'src/engine/ScraperEngine.js',
    'src/storage/Storage.js', 'src/export/Exporter.js', 'src/ui/SelectorGraph.js',
    'lib/i18n.js', 'lib/datamode.js', 'lib/undo_stack.js',
    'lib/sitemap_templates.js', 'lib/download_manager.js', 'lib/zip.js', 'dashboard/dashboard.js'
  ];
  for (const rel of SCRIPTS) {
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(el);
  }
  return { win, db };
}

test('P3.10 - sitemap meta form persists robots key + title selector', async () => {
  const { win } = bootDashboard();
  const doc = win.document;

  doc.getElementById('btn-sitemaps-create').click();
  await sleep(30);
  doc.getElementById('field-sitemap-id').value = 'rt_ui';
  doc.getElementById('field-sitemap-urls').value = 'https://ui.test/page';

  // The new controls exist and default OFF.
  const robotsChk = doc.getElementById('field-sitemap-robots');
  const titleChk = doc.getElementById('field-sitemap-title-enabled');
  assert.ok(robotsChk && titleChk, 'controls present in the form');
  assert.equal(robotsChk.checked, false, 'robots off by default');
  assert.equal(titleChk.checked, false, 'title capture off by default');
  assert.equal(doc.getElementById('field-sitemap-title-selector').value, 'title');

  robotsChk.checked = true;
  titleChk.checked = true;
  doc.getElementById('field-sitemap-title-selector').value = 'h1.article-header';
  doc.getElementById('field-sitemap-title-field').value = 'articleHeader';

  doc.getElementById('form-sitemap-meta').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(80);

  const stored = await win.AppStorage.getSitemap('rt_ui');
  assert.ok(stored, 'sitemap saved');
  assert.equal(stored.options.respectRobots, true, 'robots key persisted');
  // Property-wise compare: the stored object comes from the jsdom vm realm,
  // whose Object.prototype differs from Node's (strict deepEqual would fail
  // on the prototype alone).
  const pt = stored.options.pageTitle;
  assert.equal(pt.enabled, true, 'title capture persisted');
  assert.equal(pt.selector, 'h1.article-header', 'selector persisted');
  assert.equal(pt.field, 'articleHeader', 'field persisted');

  win.close();
});
