/**
 * Incremental scraping data modes (Ö4).
 * Pure helpers — replace / append / merge-by-key record combination.
 */
(function (root, factory) {
  const result = factory();
  if (typeof define === 'function' && define.amd) {
    define([], () => result);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = result;
  }
  if (root) root.DataModes = result;
  if (typeof globalThis !== 'undefined') globalThis.DataModes = result;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODES = ['replace', 'append', 'merge'];

  function cellKey(row, key) {
    const v = row && key ? row[key] : undefined;
    return v === undefined || v === null ? '' : String(v);
  }

  /**
   * Combines previously stored records with a fresh scrape.
   *
   * replace – the fresh scrape wins outright.
   * append  – previous records first, fresh records after.
   * merge   – rows whose key column matches an existing row REPLACE that row
   *           in place; unmatched fresh rows are appended. With no usable
   *           key column merge degrades to append (the caller is expected
   *           to warn the user).
   */
  function apply(mode, previous, incoming, keyColumn) {
    const prev = Array.isArray(previous) ? previous : [];
    const next = Array.isArray(incoming) ? incoming : [];

    if (mode === 'append') return prev.concat(next);

    if (mode === 'merge') {
      if (!keyColumn) return prev.concat(next);
      const out = prev.slice();
      const indexByKey = new Map();
      out.forEach((row, idx) => {
        const k = cellKey(row, keyColumn);
        if (!indexByKey.has(k)) indexByKey.set(k, idx);
      });
      for (const row of next) {
        const k = cellKey(row, keyColumn);
        if (k !== '' && indexByKey.has(k)) {
          out[indexByKey.get(k)] = row; // update in place, keep position
        } else {
          indexByKey.set(k, out.length);
          out.push(row);
        }
      }
      return out;
    }

    // default: replace
    return next;
  }

  return { MODES: MODES, apply: apply, cellKey: cellKey };
}));
