/**
 * Tests for export format additions (Plan.md Feature 2):
 * - Exporter.toTSV
 * - Exporter.toNDJSON
 * - Export view buttons present in the dashboard HTML
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Exporter = require('../src/export/Exporter.js');

const ROOT = path.resolve(__dirname, '..');

const SAMPLE = [
  { name: 'Widget "A"', price: '$10', note: 'has\ttab' },
  { name: 'Widget B', price: '$20', note: 'plain' }
];

test('Exporter.toTSV - produces tab separated output with proper quoting', () => {
  const tsv = Exporter.toTSV(SAMPLE, { bom: false });
  const lines = tsv.split('\r\n');
  assert.equal(lines[0], 'name\tprice\tnote');
  // Field containing a quote must be quoted+escaped; field containing a tab must be quoted.
  assert.ok(lines[1].startsWith('"Widget ""A"""\t$10\t"has\ttab"'));
  assert.equal(lines[2], 'Widget B\t$20\tplain');
});

test('Exporter.toNDJSON - one JSON object per line, parseable', () => {
  const nd = Exporter.toNDJSON(SAMPLE);
  const lines = nd.trim().split('\n');
  assert.equal(lines.length, 2);
  const parsed = lines.map(l => JSON.parse(l));
  assert.deepEqual(parsed, SAMPLE);
  assert.ok(nd.endsWith('\n'), 'NDJSON must end with a trailing newline');
});

test('Exporter.toNDJSON - empty input yields empty string', () => {
  assert.equal(Exporter.toNDJSON([]), '');
  assert.equal(Exporter.toNDJSON(null), '');
});

test('Dashboard HTML - TSV/NDJSON/copy-CSV controls exist and are wired', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.js'), 'utf8');
  assert.ok(html.includes('id="btn-download-tsv"'));
  assert.ok(html.includes('id="btn-download-ndjson"'));
  assert.ok(html.includes('id="btn-copy-data-csv"'));
  assert.ok(js.includes("downloadTSV"), 'dashboard wires TSV download');
  assert.ok(js.includes("downloadNDJSON"), 'dashboard wires NDJSON download');

  // devtools panel is generated from the dashboard and must include them too
  const panel = fs.readFileSync(path.join(ROOT, 'devtools', 'panel.html'), 'utf8');
  assert.ok(panel.includes('id="btn-download-tsv"'));
  assert.ok(panel.includes('id="btn-download-ndjson"'));
});
