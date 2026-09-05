/**
 * P3.11 — sitemap version diff tool: compare(sitemapA, sitemapB) as a PURE
 * function.
 *
 * Given two sitemap definitions (Sitemap instances or plain JSON objects —
 * whatever AppStorage / import gives us), produces a structured,
 * human-consumable diff:
 *
 *   {
 *     identical: bool,
 *     name:      { changed, from, to } | null,
 *     startUrls: { added: [], removed: [] },
 *     selectors: { added: [], removed: [], changed: [{ id, changes: {field: {from, to}} }], unchangedCount: n },
 *     options:   { changed: [{ key, from, to }] },
 *     columnTypes: { changed: [{ name, from, to }] },
 *     summary:   { added, removed, changed, identical }
 *   }
 *
 * Selector identity is the selector `id`. Selector changes are computed by
 * diffing the toJSON() shape field-by-field so any type-specific attribute
 * (linkType, table columns, transforms…) is covered without special-casing.
 *
 * UMD: window.SitemapDiff / module.exports / AMD. No DOM, no network.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SitemapDiff = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Accepts a Sitemap instance (toJSON) or a plain object; normalizes to a plain shape. */
  function toPlain(sitemap) {
    if (!sitemap || typeof sitemap !== 'object' || Array.isArray(sitemap)) return null;
    const raw = typeof sitemap.toJSON === 'function' ? sitemap.toJSON() : sitemap;
    const urls = Array.isArray(raw.startUrl) ? raw.startUrl : (Array.isArray(raw.startUrls) ? raw.startUrls : []);
    return {
      id: raw._id || raw.id || '',
      name: String(raw.name || ''),
      startUrls: urls.map((u) => String(u)),
      selectors: Array.isArray(raw.selectors) ? raw.selectors : [],
      options: (raw.options && typeof raw.options === 'object') ? raw.options : {},
      columnTypes: Array.isArray(raw.columnTypes) ? raw.columnTypes : []
    };
  }

  /** Normalizes a single selector row into its comparison shape. */
  function toSelectorPlain(sel) {
    if (!sel || typeof sel !== 'object') return null;
    const s = typeof sel.toJSON === 'function' ? sel.toJSON() : sel;
    const out = {};
    for (const key of Object.keys(s)) {
      if (s[key] === undefined) continue;
      out[key] = JSON.parse(JSON.stringify(s[key]));
    }
    if (!out.id) out.id = s.id || s._id || '';
    // parentSelectors order must not matter for equality.
    if (Array.isArray(out.parentSelectors)) out.parentSelectors = [...out.parentSelectors].sort();
    return out;
  }

  /** Shallow field-by-field diff of two plain objects (JSON-comparable values). */
  function diffFields(a, b) {
    const changes = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      const av = (a || {})[key];
      const bv = (b || {})[key];
      const same = JSON.stringify(av === undefined ? null : av) === JSON.stringify(bv === undefined ? null : bv);
      if (!same) changes[key] = { from: av === undefined ? null : av, to: bv === undefined ? null : bv };
    }
    return changes;
  }

  function diffList(a, b) {
    const aSet = new Map(a.map((x) => [String(x), x]));
    const bSet = new Map(b.map((x) => [String(x), x]));
    const added = [];
    const removed = [];
    for (const [v] of bSet) if (!aSet.has(v)) added.push(v);
    for (const [v] of aSet) if (!bSet.has(v)) removed.push(v);
    return { added, removed };
  }

  /**
   * Pure comparison of two sitemaps.
   * `a` is the "from" (base/older) side, `b` the "to" (newer) side.
   * Returns null when either side is not a usable sitemap object.
   */
  function compareSitemaps(a, b) {
    const A = toPlain(a);
    const B = toPlain(b);
    if (!A || !B) return null;

    // Name
    let name = null;
    if (A.name !== B.name) name = { changed: true, from: A.name, to: B.name };

    // Start URLs
    const startUrls = diffList(A.startUrls, B.startUrls);

    // Selectors
    const aSels = A.selectors.map(toSelectorPlain).filter(Boolean);
    const bSels = B.selectors.map(toSelectorPlain).filter(Boolean);
    const aById = new Map();
    for (const s of aSels) aById.set(String(s.id), s);
    const bById = new Map();
    for (const s of bSels) bById.set(String(s.id), s);

    const added = [];
    const removed = [];
    const changed = [];
    let unchangedCount = 0;
    for (const [id, s] of bById) {
      if (!aById.has(id)) added.push(s);
    }
    for (const [id, s] of aById) {
      if (!bById.has(id)) removed.push(s);
    }
    for (const [id, s] of bById) {
      if (!aById.has(id)) continue;
      const changes = diffFields(aById.get(id), s);
      const keys = Object.keys(changes);
      if (keys.length > 0) changed.push({ id, changes });
      else unchangedCount++;
    }

    // Options (shallow, one level — options values are primitives or the
    // pageTitle object; nested diffs would be over-engineering for display).
    const optChanges = diffFields(A.options, B.options);
    const options = Object.keys(optChanges)
      .sort()
      .map((key) => ({ key, from: optChanges[key].from, to: optChanges[key].to }));

    // Column types (P2.4) — identified by column name.
    const ctByName = (list) => {
      const m = new Map();
      for (const ct of list) if (ct && ct.name) m.set(ct.name, ct);
      return m;
    };
    const aCt = ctByName(A.columnTypes);
    const bCt = ctByName(B.columnTypes);
    const columnTypes = [];
    for (const nameKey of new Set([...aCt.keys(), ...bCt.keys()])) {
      const av = aCt.get(nameKey);
      const bv = bCt.get(nameKey);
      if (JSON.stringify(av || null) !== JSON.stringify(bv || null)) {
        columnTypes.push({ name: nameKey, from: av || null, to: bv || null });
      }
    }

    const summary = {
      added: added.length,
      removed: removed.length,
      changed: changed.length + options.length + columnTypes.length + (name ? 1 : 0),
      identical: false
    };
    const identical = !name
      && startUrls.added.length === 0 && startUrls.removed.length === 0
      && summary.added === 0 && summary.removed === 0 && summary.changed === 0;
    summary.identical = identical;

    return {
      identical: identical,
      name: name,
      startUrls: startUrls,
      selectors: { added: added, removed: removed, changed: changed, unchangedCount: unchangedCount },
      options: { changed: options },
      columnTypes: { changed: columnTypes },
      summary: summary
    };
  }

  return { compareSitemaps: compareSitemaps, toPlain: toPlain, diffFields: diffFields };
}));
