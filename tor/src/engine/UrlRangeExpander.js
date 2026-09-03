/**
 * URL Range Expander for Web Scraper Sitemaps.
 * Supports:
 * - Numeric ranges: [1-100]
 * - Zero-padded ranges: [001-100]
 * - Step ranges: [0-100:10]
 * - Alphabetic ranges: [a-z], [A-Z]
 * - Comma-separated value sets: [books,electronics,clothes]
 * - Multiple ranges per URL (Cartesian product)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UrlRangeExpander = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Safety cap so a typo like [1-100000000] cannot freeze the UI.
  const MAX_EXPANDED_URLS = 100000;

  function expandUrl(url) {
    if (!url || typeof url !== 'string') return [];
    
    // Find all brackets [...]
    const regex = /\[([^\[\]]+)\]/g;
    let match;
    const parts = [];
    let lastIndex = 0;

    const ranges = [];
    while ((match = regex.exec(url)) !== null) {
      const prefix = url.substring(lastIndex, match.index);
      const content = match[1];
      const expandedValues = expandRangeExpression(content);
      ranges.push({ prefix, values: expandedValues });
      lastIndex = regex.lastIndex;
    }

    if (ranges.length === 0) {
      return [url.trim()];
    }

    const suffix = url.substring(lastIndex);

    // Cartesian product of all ranges
    let combinations = [''];
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const nextCombos = [];
      for (const prefixSoFar of combinations) {
        for (const val of r.values) {
          nextCombos.push(prefixSoFar + r.prefix + val);
          if (nextCombos.length >= MAX_EXPANDED_URLS) break;
        }
        if (nextCombos.length >= MAX_EXPANDED_URLS) break;
      }
      combinations = nextCombos;
    }

    return combinations.map(c => (c + suffix).trim());
  }

  function expandRangeExpression(expr) {
    expr = expr.trim();

    // Check numeric range with step: [start-end:step] or [start-end]
    const numStepMatch = expr.match(/^(-?\d+)-(-?\d+)(?::(\d+))?$/);
    if (numStepMatch) {
      const rawStart = numStepMatch[1];
      const rawEnd = numStepMatch[2];
      const start = parseInt(rawStart, 10);
      const end = parseInt(rawEnd, 10);
      const step = numStepMatch[3] ? Math.max(1, parseInt(numStepMatch[3], 10)) : 1;

      const isPadded = (rawStart.startsWith('0') && rawStart.length > 1) || (rawEnd.startsWith('0') && rawEnd.length > 1);
      const padLength = isPadded ? Math.max(rawStart.length, rawEnd.length) : 0;

      const results = [];
      if (start <= end) {
        for (let i = start; i <= end && results.length < MAX_EXPANDED_URLS; i += step) {
          results.push(padNumber(i, padLength));
        }
      } else {
        for (let i = start; i >= end && results.length < MAX_EXPANDED_URLS; i -= step) {
          results.push(padNumber(i, padLength));
        }
      }
      return results;
    }

    // Check alpha range: [a-z] or [A-Z]
    const alphaMatch = expr.match(/^([a-zA-Z])-([a-zA-Z])$/);
    if (alphaMatch) {
      const startCode = alphaMatch[1].charCodeAt(0);
      const endCode = alphaMatch[2].charCodeAt(0);
      const results = [];
      if (startCode <= endCode) {
        for (let i = startCode; i <= endCode; i++) {
          results.push(String.fromCharCode(i));
        }
      } else {
        for (let i = startCode; i >= endCode; i--) {
          results.push(String.fromCharCode(i));
        }
      }
      return results;
    }

    // Comma-separated list: [cat,dog,bird]
    if (expr.includes(',')) {
      return expr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Fallback: return as-is
    return [expr];
  }

  function padNumber(num, length) {
    let str = String(num);
    if (length > 0) {
      const isNegative = str.startsWith('-');
      const absStr = isNegative ? str.substring(1) : str;
      const padded = absStr.padStart(length, '0');
      return isNegative ? '-' + padded : padded;
    }
    return str;
  }

  function expandStartUrls(urls) {
    if (!urls) return [];
    const list = Array.isArray(urls) ? urls : [urls];
    const output = [];
    for (const u of list) {
      if (typeof u === 'string' && u.trim().length > 0) {
        const expanded = expandUrl(u.trim());
        output.push(...expanded);
      }
    }
    return Array.from(new Set(output)); // Deduplicate
  }

  return {
    expandUrl: expandUrl,
    expandStartUrls: expandStartUrls,
    expandRangeExpression: expandRangeExpression
  };
}));
