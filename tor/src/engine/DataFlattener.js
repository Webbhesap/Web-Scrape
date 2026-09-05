/**
 * Data Flattener and Record Assembler.
 * Converts hierarchical scraping tree results into tabular rectangular rows.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DataFlattener = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let orderCounter = 1;

  function generateOrderKey() {
    const timestamp = Math.floor(Date.now() / 1000);
    return `${timestamp}-${orderCounter++}`;
  }

  function resetOrderCounter() {
    orderCounter = 1;
  }

  /**
   * Flattens an array of hierarchical record nodes into a flat array of objects.
   * Each record node has:
   * - _meta: { startUrl, currentUrl, pageTitle }
   * - data: { field1: val1, ... }
   * - children: [ childRecordNode1, ... ]
   */
  function flattenRecordTree(nodes, parentData = {}, meta = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return [];
    }

    const flatRows = [];

    for (const node of nodes) {
      const currentMeta = Object.assign({}, meta, node._meta || {});
      const currentData = Object.assign({}, parentData);

      // Merge node data
      if (node.data) {
        for (const [key, val] of Object.entries(node.data)) {
          if (val !== undefined && val !== null) {
            if (typeof val === 'object' && !Array.isArray(val)) {
              // Flatten link { href, text } or object
              if ('href' in val && 'text' in val) {
                currentData[key] = val.text;
                currentData[`${key}-href`] = val.href;
              } else {
                for (const [subK, subV] of Object.entries(val)) {
                  currentData[`${key}_${subK}`] = subV;
                }
              }
            } else {
              currentData[key] = val;
            }
          }
        }
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        // Recurse into children. Appended with a loop, NOT `push(...childRows)`:
        // spreading a large array passes every row as a separate argument and
        // blows the call stack (RangeError) — measured to throw at ~200k rows,
        // which a big nested-container scrape can easily reach. Same class of
        // bug as the Math.min(...nums) fix in the dashboard stats bar.
        const childRows = flattenRecordTree(node.children, currentData, currentMeta);
        for (let i = 0; i < childRows.length; i++) flatRows.push(childRows[i]);
      } else {
        // Leaf record!
        const row = {
          'web-scraper-order': node.order || generateOrderKey(),
          'web-scraper-start-url': currentMeta.startUrl || ''
        };

        Object.assign(row, currentData);
        flatRows.push(row);
      }
    }

    return flatRows;
  }

  /**
   * Unifies and aligns columns across all rows so every row has the same keys in consistent order.
   */
  function normalizeRecords(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    // Collect all unique column headers in order
    const headerSet = new Set(['web-scraper-order', 'web-scraper-start-url']);
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        headerSet.add(key);
      }
    }

    const allHeaders = Array.from(headerSet);

    return rows.map(row => {
      const normalizedRow = {};
      for (const h of allHeaders) {
        normalizedRow[h] = row[h] !== undefined ? row[h] : '';
      }
      return normalizedRow;
    });
  }

  return {
    flattenRecordTree: flattenRecordTree,
    normalizeRecords: normalizeRecords,
    generateOrderKey: generateOrderKey,
    resetOrderCounter: resetOrderCounter
  };
}));
