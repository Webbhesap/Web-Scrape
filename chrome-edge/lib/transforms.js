/**
 * Text transform pipeline for selector post-processing.
 * Pure local string/value transforms — no network, no external services.
 *
 * Supported transform steps (applied in order):
 *   trim        – strip surrounding whitespace
 *   lowercase   – lowercase the value
 *   uppercase   – uppercase the value
 *   capitalize  – capitalize the first letter of every word
 *   number      – parse numbers out of localized strings such as
 *                 "1.234,56 ₺", "$1,234.56", "45,90 €", "-12" → numbers
 *   regexReplace– find/replace with regex (supports $1 capture groups)
 */
(function (root, factory) {
  const result = factory();
  if (typeof define === 'function' && define.amd) {
    define([], () => result);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = result;
  }
  if (root) root.TextTransforms = result;
  if (typeof globalThis !== 'undefined') globalThis.TextTransforms = result;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TRANSFORM_TYPES = ['trim', 'lowercase', 'uppercase', 'capitalize', 'number', 'regexReplace'];

  /** Parses localized numbers: handles 1,234.56 / 1.234,56 / currency marks. */
  function parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

    let s = String(raw).trim();
    if (!s) return null;

    // Strip currency symbols, NBSP and regular spaces anywhere in the value.
    s = s.replace(/[\s\u00A0\u202F]/g, '').replace(/[$€£₺¥₹]/g, '');

    // When the value carries extra text ("1.234,56 TL", "ca. 5 €"), pull out
    // the first run that looks like a formatted number.
    if (!/^[+-]?[\d.,]+$/.test(s)) {
      const m = s.match(/[+-]?[\d.,]*\d/);
      if (!m) return null;
      s = m[0];
    }
    if (!/[\d]/.test(s)) return null;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma === -1 && lastDot === -1) {
      // Plain integer.
      return parseInt(s, 10);
    }

    // Decide which separator is the decimal one (the LAST one to appear),
    // then treat the other (repeated) separator as thousands grouping.
    let decimalSep;
    if (lastComma === -1) decimalSep = '.';
    else if (lastDot === -1) decimalSep = ',';
    else decimalSep = lastComma > lastDot ? ',' : '.';

    const groupingSep = decimalSep === ',' ? '.' : ',';
    const parts = s.split(decimalSep);
    if (parts.length > 2) return null; // e.g. "1.2.3" — not a number

    const intPart = parts[0].split(groupingSep).join('');
    let fracPart = parts[1] || '';
    // Grouping separators must wrap groups of three digits (5.000 or 5,000);
    // tolerate minor deviations but reject obviously non-numeric leftovers.
    if (!/^[+-]?\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
    if (!intPart && !fracPart) return null;

    const normalized = (intPart || '0') + (fracPart ? '.' + fracPart : '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function applyOne(value, step) {
    if (!step || typeof step.type !== 'string') return value;
    // Multiple extractions arrive as arrays — map every scalar transform
    // over the items instead of stringifying the whole array.
    if (Array.isArray(value) && step.type !== 'number') {
      return value.map((v) => applyOne(v, step));
    }
    switch (step.type) {
      case 'trim':
        return value === null || value === undefined ? value : String(value).trim();
      case 'lowercase':
        return value === null || value === undefined ? value : String(value).toLowerCase();
      case 'uppercase':
        return value === null || value === undefined ? value : String(value).toUpperCase();
      case 'capitalize':
        if (value === null || value === undefined) return value;
        return String(value).replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
      case 'number': {
        if (Array.isArray(value)) return value.map((v) => parseNumber(v) === null ? v : parseNumber(v));
        const n = parseNumber(value);
        return n === null ? value : n;
      }
      case 'regexReplace': {
        if (value === null || value === undefined) return value;
        if (!step.find) return value;
        try {
          const re = new RegExp(step.find, step.flags || 'g');
          return String(value).replace(re, step.replace == null ? '' : String(step.replace));
        } catch (e) {
          return value; // invalid user regex — leave the value untouched
        }
      }
      default:
        return value;
    }
  }

  /** Applies the ordered list of transform steps to a single value. */
  function applyTransforms(value, transforms) {
    if (!Array.isArray(transforms) || transforms.length === 0) return value;
    let out = value;
    for (const step of transforms) {
      out = applyOne(out, step);
    }
    return out;
  }

  /** Returns the default when the extraction came out empty. */
  function applyDefaultValue(value, defaultValue) {
    if (defaultValue === undefined || defaultValue === null) return value;
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    return isEmpty ? defaultValue : value;
  }

  /** Full pipeline: transforms first, then the default value for empties. */
  function postProcess(value, options) {
    if (!options) return value;
    let out = value;
    if (options.transforms) out = applyTransforms(out, options.transforms);
    if (options.defaultValue !== undefined) out = applyDefaultValue(out, options.defaultValue);
    return out;
  }

  /** Normalizes a user-supplied transforms array (drops invalid entries). */
  function normalizeTransforms(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const step of list) {
      if (!step || !TRANSFORM_TYPES.includes(step.type)) continue;
      if (step.type === 'regexReplace' && !step.find) continue;
      out.push(step.type === 'regexReplace'
        ? { type: step.type, find: String(step.find), replace: step.replace == null ? '' : String(step.replace), flags: String(step.flags || 'g') }
        : { type: step.type });
    }
    return out;
  }

  return {
    TRANSFORM_TYPES: TRANSFORM_TYPES,
    parseNumber: parseNumber,
    applyTransforms: applyTransforms,
    applyDefaultValue: applyDefaultValue,
    postProcess: postProcess,
    normalizeTransforms: normalizeTransforms
  };
}));
