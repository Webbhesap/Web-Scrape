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
