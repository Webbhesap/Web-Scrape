/**
 * Standalone RFC 4180 compliant CSV parser and generator.
 * Pure Vanilla JavaScript with zero dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CSV = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function unparse(data, options) {
    options = options || {};
    const delimiter = options.delimiter || ',';
    const quotes = options.quotes !== false; // default true if needed
    const quoteChar = options.quoteChar || '"';
    const escapeChar = options.escapeChar || '"';
    const newline = options.newline || '\r\n';
    const header = options.header !== false;

    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    let fields = [];
    let rows = [];

    if (typeof data[0] === 'object' && !Array.isArray(data[0]) && data[0] !== null) {
      // Array of objects
      fields = options.columns || Object.keys(data[0]);
      if (header) {
        rows.push(fields.map(f => formatCell(f, delimiter, quoteChar, escapeChar)));
      }
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowCells = [];
        for (let j = 0; j < fields.length; j++) {
          const val = row[fields[j]];
          rowCells.push(formatCell(val, delimiter, quoteChar, escapeChar));
        }
        rows.push(rowCells);
      }
    } else if (Array.isArray(data[0])) {
      // 2D Array
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowCells = [];
        for (let j = 0; j < row.length; j++) {
          rowCells.push(formatCell(row[j], delimiter, quoteChar, escapeChar));
        }
        rows.push(rowCells);
      }
    }

    let csvString = rows.map(r => r.join(delimiter)).join(newline);
    if (options.bom) {
      csvString = '\uFEFF' + csvString;
    }
    return csvString;
  }

  function formatCell(val, delimiter, quoteChar, escapeChar) {
    if (val === undefined || val === null) {
      return '';
    }
    let str = String(val);
    const mustQuote = str.includes(delimiter) || str.includes(quoteChar) || str.includes('\n') || str.includes('\r');
    if (mustQuote) {
      // split/join instead of RegExp so special characters in quoteChar
      // (e.g. custom quote symbols) are never interpreted as regex syntax.
      const escaped = str.split(quoteChar).join(escapeChar + quoteChar);
      return quoteChar + escaped + quoteChar;
    }
    return str;
  }

  function parse(csvText, options) {
    options = options || {};
    const delimiter = options.delimiter || ',';
    const header = options.header !== false;
    
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    if (!header || rows.length === 0) {
      return { data: rows, errors: [] };
    }

    const headers = rows[0];
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 1 && row[0] === '') continue; // Skip empty trailing lines
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j] !== undefined ? row[j] : '';
      }
      data.push(obj);
    }

    return { data: data, headers: headers, errors: [] };
  }

  return {
    unparse: unparse,
    parse: parse
  };
}));
