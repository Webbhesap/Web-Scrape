/**
 * Ö6 — real .xlsx export + rich HTML clipboard table tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const XLSX = require('../chrome-edge/lib/xlsx.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');

const RECORDS = [
  { name: 'banana', price: 2, note: 'fresh & tasty <ok>' },
  { name: 'apple', price: 10, note: '' },
  { name: 'cherry', price: 1.5, note: '1,000 items' }
];

test('XLSX - generateXlsx produces a valid ZIP with the expected parts', async () => {
  const bytes = await XLSX.generateXlsx(RECORDS, 'Fruits');

  // ZIP magic
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  // The ZIP must open and contain every OOXML part — use Python's zipfile.
  const tmp = path.join(os.tmpdir(), `ws-xlsx-${Date.now()}.zip`);
  fs.writeFileSync(tmp, bytes);
  const names = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(${JSON.stringify(tmp)})
print('\\n'.join(z.namelist()))
assert z.testzip() is None
`]).toString().trim().split('\n');
  fs.unlinkSync(tmp);

  for (const expected of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml'
  ]) {
    assert.ok(names.includes(expected), `${expected} present in the archive`);
  }
});

test('XLSX - worksheet carries headers, typed cells and escaped content', async () => {
  const bytes = await XLSX.generateXlsx(RECORDS, 'Fruits');
  const sheetXml = extractEntry(bytes, 'xl/worksheets/sheet1.xml');

  assert.match(sheetXml, /<is><t[^>]*>name<\/t><\/is>/, 'header cell present');
  assert.match(sheetXml, /<is><t[^>]*>banana<\/t><\/is>/, 'string cell present');
  assert.match(sheetXml, /<c r="B3"><v>10<\/v><\/c>/, 'numeric cell typed as number');
  assert.match(sheetXml, /fresh &amp; tasty &lt;ok&gt;/, 'XML-escaped content');
  assert.match(sheetXml, /<cols>/, 'column widths written');
});

test('XLSX - workbook + content types wire the parts together', async () => {
  const bytes = await XLSX.generateXlsx(RECORDS, 'My Sheet');
  const workbook = extractEntry(bytes, 'xl/workbook.xml');
  assert.match(workbook, /<sheet name="My Sheet" sheetId="1" r:id="rId1"\/>/);
  const ct = extractEntry(bytes, '[Content_Types].xml');
  assert.match(ct, /spreadsheetml\.sheet\.main\+xml/);
  assert.match(ct, /spreadsheetml\.worksheet\+xml/);
});

test('XLSX - empty and null values produce empty cells without crashing', async () => {
  const bytes = await XLSX.generateXlsx([{ a: null, b: '', c: 3 }], 'Edge');
  const sheetXml = extractEntry(bytes, 'xl/worksheets/sheet1.xml');
  assert.match(sheetXml, /<c r="A2"\/>/, 'null cell is empty');
  assert.match(sheetXml, /<c r="C2"><v>3<\/v><\/c>/);
});

test('Exporter - buildHtmlTable renders a full HTML table with escapes', () => {
  const html = Exporter.buildHtmlTable(RECORDS);
  assert.match(html, /^<table><thead><tr><th>name<\/th><th>price<\/th><th>note<\/th><\/tr><\/thead><tbody>/);
  assert.match(html, /<td>banana<\/td>/);
  assert.match(html, /fresh &amp; tasty &lt;ok&gt;/);
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((body.match(/<tr>/g) || []).length, 3, 'three body rows');
});

/** Minimal ZIP reader for STORE entries (all SimpleZip output is STORE). */
function extractEntry(zipBytes, wantedName) {
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  while (offset < zipBytes.length - 4) {
    if (zipBytes[offset] === 0x50 && zipBytes[offset + 1] === 0x4b && zipBytes[offset + 2] === 0x03 && zipBytes[offset + 3] === 0x04) {
      const nameLen = zipBytes[offset + 26] | (zipBytes[offset + 27] << 8);
      const extraLen = zipBytes[offset + 28] | (zipBytes[offset + 29] << 8);
      const compSize = zipBytes[offset + 18] | (zipBytes[offset + 19] << 8) | (zipBytes[offset + 20] << 16) | (zipBytes[offset + 21] << 24);
      const name = decoder.decode(zipBytes.slice(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      if (name === wantedName) {
        return decoder.decode(zipBytes.slice(dataStart, dataStart + compSize));
      }
      offset = dataStart + compSize;
    } else {
      offset += 1;
    }
  }
  throw new Error(`entry not found: ${wantedName}`);
}
