/**
 * P4.12 (part 2) — property-based tests.
 *
 * No external property-test dependency (the project stays 100% offline and
 * zero-runtime-dep): a tiny seeded-PRNG harness runs each property over many
 * generated inputs deterministically, so failures reproduce with the same
 * seed on every machine/CI run.
 *
 * Properties covered:
 *  - CSV: unparse → parse round-trips arbitrary records (commas, quotes,
 *    newlines, CRLF, Unicode, empty fields)
 *  - number normalization: parseColumnNumber(String(n)) === n
 *  - robots: null rules (or an unparseable URL) never blocks
 *  - sitemap diff: compareSitemaps(x, x) is ALWAYS identical (reflexivity)
 *  - transforms: trim / lowercase / uppercase / capitalize are idempotent
 *  - id slugging: slugify is idempotent
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const CSV = require('../chrome-edge/lib/csv.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');
const Robots = require('../chrome-edge/lib/robots.js');
const SitemapDiff = require('../chrome-edge/lib/sitemap_diff.js');
const TextTransforms = require('../chrome-edge/lib/transforms.js');
const Sitemap = require('../chrome-edge/src/models/Sitemap.js');

// ---------------------------------------------------------------------------
// minimal deterministic harness
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const rand = (rnd, n) => Math.floor(rnd() * n);
const pick = (rnd, arr) => arr[rand(rnd, arr.length)];
const randInt = (rnd, lo, hi) => lo + rand(rnd, hi - lo + 1);

/**
 * prop(name, fn, cases?)          — fn(rnd) generates AND checks one case
 * prop(name, gen, check, cases?)  — gen(rnd) -> value, check(value, i)
 */
function prop(name, a, b, cases = 200) {
  test(name, () => {
    const rnd = mulberry32(0xC0FFEE ^ hashString(name));
    if (typeof b === 'undefined') {
      for (let i = 0; i < cases; i++) a(rnd);
    } else {
      for (let i = 0; i < cases; i++) b(a(rnd), i);
    }
  });
}

// ---------------------------------------------------------------------------
// generators
// ---------------------------------------------------------------------------
const FIELD_CHARS = ['a', 'b', 'c', 'price', 'ürün', 'x,y', 'q"u', 'n\nl', 'tab\there'];
const VALUE_CHARS = ['', 'plain', 'with,comma', 'with"quote', 'multi\nline', 'crlf\r\nline',
  'üçü buşuk', '  spaces  ', '1.234,56', '<b>html</b>', 'tab\there', 'back\\slash', '€$£₺'];

const genFieldName = (rnd) => pick(rnd, FIELD_CHARS) + String(randInt(rnd, 0, 9));
const genValue = (rnd) => pick(rnd, VALUE_CHARS);

// A CSV table has ONE header: the field set is chosen once and shared by
// every row (exactly what scraped records look like — same selectors per
// page), which is what makes the round-trip lossless.
const genTable = (rnd) => {
  const nRows = randInt(rnd, 1, 6);
  const fields = Array.from({ length: randInt(rnd, 1, 4) }, () => genFieldName(rnd));
  return Array.from({ length: nRows }, () => {
    const r = {};
    for (const f of fields) r[f] = genValue(rnd);
    return r;
  });
};

const genSitemapObj = (rnd) => {
  const types = ['SelectorText', 'SelectorLink', 'SelectorImage', 'SelectorPagination'];
  const sels = [];
  for (let i = 0; i < randInt(rnd, 0, 4); i++) {
    sels.push({
      id: 'sel' + i,
      type: pick(rnd, types),
      selector: '.' + pick(rnd, ['a', 'b', 'x.y', 'z[0]']),
      parentSelectors: i === 0 ? ['_root'] : ['sel' + randInt(rnd, 0, i - 1)],
      multiple: rnd() > 0.5,
      delay: randInt(rnd, 0, 3)
    });
  }
  return {
    _id: 's' + randInt(rnd, 0, 5),
    name: 'name' + randInt(rnd, 0, 3) + (rnd() > 0.5 ? ' Ç' : ''),
    startUrl: Array.from({ length: randInt(rnd, 0, 3) }, () => 'https://t.test/' + randInt(rnd, 0, 9)),
    selectors: sels,
    options: { shadowDom: rnd() > 0.5, respectRobots: rnd() > 0.5 },
    columnTypes: rnd() > 0.5 ? [{ name: 'price', type: 'number' }] : []
  };
};

// ---------------------------------------------------------------------------
// properties
// ---------------------------------------------------------------------------
prop('CSV: unparse→parse round-trips a table (shared header) losslessly', (rnd) => {
  const rows = genTable(rnd);
  const csvText = CSV.unparse(rows, { bom: false, header: true });
  const parsed = CSV.parse(csvText, { bom: false, header: true });
  assert.deepEqual(parsed.errors, []);
  // CSV is string-typed end to end: compare the parsed table against the
  // string-normalized original. One documented exception: a row whose
  // values are ALL empty serializes as a blank line, which the parser
  // (correctly) skips — blank lines are how the trailing newline is
  // represented.
  const isEmptyRow = (r) => Object.values(r).every((v) => v === '' || v === undefined);
  const norm = (rs) => JSON.parse(JSON.stringify(
    rs.filter((r) => !isEmptyRow(r))
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === undefined ? '' : String(v)])))
  ));
  assert.deepEqual(norm(parsed.data), norm(rows), 'round-trip mismatch for ' + JSON.stringify(rows));
});

prop('number: parseColumnNumber(String(n)) === n', (rnd) => {
  const n = Math.round(rnd() * 100000) / Math.pow(10, randInt(rnd, 0, 2));
  const parsed = Exporter.parseColumnNumber(String(n));
  assert.equal(parsed, n, 'String(' + n + ') -> ' + parsed);
});

prop('robots: null rules and bad URLs never block', (rnd) => {
  const candidates = [
    'https://t.test/a?b=1#c',
    'http://t.test/2',
    'not a url',
    '',
    'file:///x/y',
    'https://' + pick(rnd, ['a', 'üç', 'with space']) + '/p'
  ];
  for (const u of candidates) {
    assert.equal(Robots.isAllowed(u, null, '*'), true, 'null rules allow ' + JSON.stringify(u));
  }
});

prop('sitemap diff: compareSitemaps(x, x) is identical (reflexivity)', (rnd) => {
  const x = genSitemapObj(rnd);
  const d = SitemapDiff.compareSitemaps(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(x)));
  assert.ok(d, 'diff produced');
  assert.equal(d.identical, true, 'self-comparison must be identical: ' + JSON.stringify(x));
  assert.deepEqual(d.summary, { added: 0, removed: 0, changed: 0, identical: true });
});

prop('transforms: trim/lowercase/uppercase/capitalize are idempotent', (rnd) => {
  const s = genValue(rnd) + pick(rnd, [' ', ' ', 'x', '']);
  for (const type of ['trim', 'lowercase', 'uppercase', 'capitalize']) {
    const once = TextTransforms.applyTransforms(s, [{ type: type }]);
    const twice = TextTransforms.applyTransforms(once, [{ type: type }]);
    assert.equal(twice, once, type + ' idempotent on ' + JSON.stringify(s));
  }
});

prop('slugify: idempotent on arbitrary strings', (rnd) => {
  const s = Array.from({ length: randInt(rnd, 1, 8) }, () => pick(rnd, ['a', 'B', 'ç', '2', ' ', '-', '_', 'İ', 'x,y'])).join('');
  const once = Sitemap.slugify(s);
  const twice = Sitemap.slugify(once);
  assert.equal(twice, once, 'slugify(' + JSON.stringify(s) + ')=' + JSON.stringify(once));
  assert.ok(!once.includes(' ') && !once.includes(','), 'no spaces/commas survive');
});
