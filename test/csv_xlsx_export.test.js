const test = require('node:test');
const assert = require('node:assert/strict');
const CSV = require('../chrome-edge/lib/csv.js');
const XLSX = require('../chrome-edge/lib/xlsx.js');
const Exporter = require('../chrome-edge/src/export/Exporter.js');

test('CSV Parser & Generator - RFC 4180 with quotes, commas and newlines', () => {
  const data = [
    { id: '1', name: 'Product, with comma', description: 'Line 1\nLine 2', price: '99.99' },
    { id: '2', name: 'Product "Quotes"', description: 'Simple', price: '49.50' }
  ];

  const csv = Exporter.toCSV(data, { bom: false, delimiter: ',' });
  assert.ok(csv.includes('"Product, with comma"'));
  assert.ok(csv.includes('"Product ""Quotes"""'));
  assert.ok(csv.includes('"Line 1\nLine 2"'));

  const parsed = CSV.parse(csv);
  assert.equal(parsed.data.length, 2);
  assert.equal(parsed.data[0].name, 'Product, with comma');
  assert.equal(parsed.data[1].name, 'Product "Quotes"');
});

test('CSV Generator - Custom Semicolon Delimiter and BOM', () => {
  const data = [{ a: '1', b: '2' }];
  const csv = Exporter.toCSV(data, { delimiter: ';', bom: true });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('a;b'));
  assert.ok(csv.includes('1;2'));
});

test('XLSX / Excel XML Generator - Generates valid XML Spreadsheet', () => {
  const data = [
    { Product: 'Laptop', Price: 1200.5, InStock: true, Notes: 'Fast & Reliable <5ms>' }
  ];

  const xml = Exporter.toExcel(data, 'Products');
  assert.ok(xml.includes('<?xml version="1.0"'));
  assert.ok(xml.includes('<Worksheet ss:Name="Products">'));
  assert.ok(xml.includes('<Data ss:Type="Number">1200.5</Data>'));
  assert.ok(xml.includes('Fast &amp; Reliable &lt;5ms&gt;'));
});

test('CSV parse() honors options.quoteChar (round-trip parity with unparse)', () => {
  // Regression: unparse() read options.quoteChar but parse() hard-coded '"',
  // so a CSV written with a custom quote character could not be read back.
  const rows = [
    { n: 'elma, armut', q: 'icinde "tirnak" var' },
    { n: 'duz', q: 'satir\nsonu' }
  ];

  for (const quoteChar of ['"', "'", '`', '\u00ab']) {
    const text = CSV.unparse(rows, { quoteChar });
    assert.ok(text.includes(quoteChar), `unparse should quote with ${quoteChar}`);
    assert.deepEqual(CSV.parse(text, { quoteChar }).data, rows,
      `round-trip must survive quoteChar=${quoteChar}`);
  }

  // Default behaviour is unchanged: bare '"' still parses, doubled quotes still
  // unescape, and embedded delimiters/newlines stay inside one cell.
  const classic = 'a,b\r\n"x,y","he said ""hi"""\r\n"multi\r\nline",z\r\n';
  assert.deepEqual(CSV.parse(classic).data, [
    { a: 'x,y', b: 'he said "hi"' },
    { a: 'multi\r\nline', b: 'z' }
  ]);

  // A custom quoteChar means '"' is now ordinary data, not a quoting marker.
  const single = "a,b\r\n'x,y',\"plain\"\r\n";
  assert.deepEqual(CSV.parse(single, { quoteChar: "'" }).data, [
    { a: 'x,y', b: '"plain"' }
  ]);

  // Multi-character quote markers work too (startsWith-based scanner).
  const multi = CSV.unparse([{ a: 'v,1' }], { quoteChar: '[[' });
  assert.deepEqual(CSV.parse(multi, { quoteChar: '[[' }).data, [{ a: 'v,1' }]);
});

test('lib/xlsx.js direct API - Excel XML sheet naming and HTML table builder', () => {
  // The XLSX module was imported but never exercised here; these are the two
  // dependency-free entry points (generateXlsx needs the zip lib + async).
  const data = [{ Product: 'Laptop', Price: 1200.5, Notes: 'Fast & <5ms>' }];

  const xml = XLSX.generateExcelXml(data, 'Q3: Sales/2024');
  assert.ok(xml.includes('<?xml version="1.0"'));
  // Illegal sheet-name characters are replaced and the name is capped at 31.
  assert.ok(xml.includes('<Worksheet ss:Name="Q3_ Sales_2024">'), xml.slice(0, 400));
  assert.ok(xml.includes('&amp;'), 'ampersand must be escaped');
  assert.ok(xml.includes('&lt;5ms&gt;'), 'angle brackets must be escaped');
  assert.ok(xml.includes('<Data ss:Type="Number">1200.5</Data>'));

  const html = XLSX.buildHtmlTable(data);
  assert.ok(html.includes('<th>Product</th>') && html.includes('<th>Price</th>'));
  assert.ok(html.includes('<td>Laptop</td>'));
  assert.ok(html.includes('&lt;5ms&gt;'), 'HTML table must escape cell text');

  // Empty / malformed input must not throw.
  assert.equal(typeof XLSX.generateExcelXml([], 'Empty'), 'string');
  assert.equal(typeof XLSX.buildHtmlTable([]), 'string');
});
