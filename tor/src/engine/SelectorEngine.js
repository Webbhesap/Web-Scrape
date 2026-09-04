/**
 * Selector Execution Engine.
 * Extracts data from DOM trees according to selector specifications.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../lib/transforms.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const TextTransforms = require('../../lib/transforms.js');
    module.exports = factory(TextTransforms);
  } else {
    root.SelectorEngine = factory(root.TextTransforms);
  }
}(typeof self !== 'undefined' ? self : this, function (TextTransforms) {
  'use strict';

  /** Applies the selector's transform pipeline + default value to a value. */
  function postProcess(value, selector) {
    if (!selector) return value;
    const opts = {};
    if (Array.isArray(selector.transforms) && selector.transforms.length > 0) {
      opts.transforms = selector.transforms;
    }
    if (selector.defaultValue !== undefined && selector.defaultValue !== null && selector.defaultValue !== '') {
      opts.defaultValue = selector.defaultValue;
    }
    if (!Object.keys(opts).length) return value;
    return TextTransforms.postProcess(value, opts);
  }

  function cleanText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  function getElementVisibleText(element) {
    if (!element) return '';
    // Clone to safely remove script/style
    const clone = element.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, noscript, svg');
    scripts.forEach(s => s.remove());
    
    // Replace <br> and block elements with newlines for proper spacing
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));

    return cleanText(clone.textContent || clone.innerText || '');
  }

  function applyRegex(value, regexPattern) {
    if (!regexPattern || typeof regexPattern !== 'string' || regexPattern.trim() === '') {
      return value;
    }
    if (value === null || value === undefined) return '';
    try {
      const reg = new RegExp(regexPattern);
      const match = String(value).match(reg);
      if (!match) return '';
      // If regex has capturing group, return group 1, else whole match
      return match[1] !== undefined ? match[1] : match[0];
    } catch (e) {
      console.warn('Regex error:', e);
      return value;
    }
  }

  function resolveUrl(relativeUrl, baseUrl) {
    if (!relativeUrl || typeof relativeUrl !== 'string') return '';
    relativeUrl = relativeUrl.trim();
    if (relativeUrl.startsWith('javascript:') || relativeUrl.startsWith('mailto:') || relativeUrl.startsWith('tel:')) {
      return '';
    }
    try {
      if (!baseUrl) {
        if (typeof window !== 'undefined' && window.location) {
          baseUrl = window.location.href;
        } else {
          baseUrl = 'http://localhost';
        }
      }
      return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
      return relativeUrl;
    }
  }

  function extractImageUrl(el, baseUrl) {
    if (!el) return '';
    
    // 1. Direct src
    let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-lazy-src');
    
    // 2. srcset (take highest resolution)
    if (!src && el.getAttribute('srcset')) {
      const srcset = el.getAttribute('srcset');
      const candidates = srcset.split(',').map(s => s.trim().split(' ')[0]);
      if (candidates.length > 0) {
        src = candidates[candidates.length - 1];
      }
    }

    // 3. CSS background-image
    if (!src && typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const match = bg.match(/url\(["']?([^"']+)["']?\)/i);
          if (match) src = match[1];
        }
      } catch (e) {}
    }

    // 4. Style attribute fallback
    if (!src && el.getAttribute('style')) {
      const style = el.getAttribute('style');
      const match = style.match(/background(?:-image)?:\s*url\(["']?([^"']+)["']?\)/i);
      if (match) src = match[1];
    }

    return resolveUrl(src, baseUrl);
  }

  function extractPopupUrl(el, baseUrl) {
    if (!el) return '';

    // Check data-url / data-href / data-link first if href is empty or '#'
    const dataUrl = el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-link');
    
    // Direct href
    let href = el.getAttribute('href') || '';
    if (href && href !== '#' && !href.startsWith('javascript:')) {
      return resolveUrl(href, baseUrl);
    }

    // onclick window.open pattern
    const onclick = el.getAttribute('onclick') || '';
    const openMatch = onclick.match(/window\.open\(\s*['"]([^'"]+)['"]/i);
    if (openMatch) {
      return resolveUrl(openMatch[1], baseUrl);
    }

    if (dataUrl) {
      return resolveUrl(dataUrl, baseUrl);
    }

    return '';
  }

  class SelectorEngine {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.href : '');
      // Shadow DOM piercing (Ö2): on by default; sitemaps can turn it off to
      // restore the plain querySelectorAll-only behaviour.
      this.shadowDom = options.shadowDom !== false;
      // Per-context cache of discovered shadow roots — the DOM walk is the
      // expensive part and pages are scraped selector after selector.
      this._shadowRootCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    }

    setBaseUrl(url) {
      this.baseUrl = url;
    }

    /**
     * Collects every shadow root reachable from `context` (open roots only —
     * closed roots are invisible to scripts by design). Results are cached
     * per context so repeated selector queries do not re-walk the DOM.
     */
    collectShadowRoots(context) {
      if (!this._shadowRootCache) return this._walkShadowRoots(context);
      let cached = this._shadowRootCache.get(context);
      if (!cached) {
        cached = this._walkShadowRoots(context);
        this._shadowRootCache.set(context, cached);
      }
      return cached;
    }

    _walkShadowRoots(context) {
      const roots = [];
      const seenContainers = new Set();
      const walk = (node) => {
        if (!node || seenContainers.has(node)) return;
        seenContainers.add(node);
        let descendants = [];
        try {
          descendants = node.querySelectorAll ? node.querySelectorAll('*') : [];
        } catch (e) { return; }
        descendants.forEach((el) => {
          if (el.shadowRoot) {
            roots.push(el.shadowRoot);
            walk(el.shadowRoot);
          }
        });
      };
      walk(context);
      return roots;
    }

    queryAll(context, selectorStr) {
      if (!context || !selectorStr) return [];
      if (selectorStr === '_parent_' || selectorStr === '_self' || selectorStr === '.') {
        return [context];
      }
      try {
        const direct = Array.from(context.querySelectorAll(selectorStr));
        if (!this.shadowDom) return direct;
        // Shadow DOM piercing: also query every reachable shadow root.
        // Contexts that already live INSIDE a shadow tree query their own
        // subtree normally (the boundary only blocks outside-in), so only
        // deeper roots need to be visited.
        const shadowRoots = this.collectShadowRoots(context);
        if (shadowRoots.length === 0) return direct;
        const out = direct.slice();
        for (const root of shadowRoots) {
          let matched = [];
          try { matched = Array.from(root.querySelectorAll(selectorStr)); } catch (e) { continue; }
          for (const el of matched) {
            if (!out.includes(el)) out.push(el);
          }
        }
        return out;
      } catch (e) {
        console.warn(`Invalid CSS Selector "${selectorStr}":`, e);
        return [];
      }
    }

    queryFirst(context, selectorStr) {
      if (!context || !selectorStr) return null;
      if (selectorStr === '_parent_' || selectorStr === '_self' || selectorStr === '.') {
        return context;
      }
      const all = this.queryAll(context, selectorStr);
      // Fast path: plain document order when nothing was pierced.
      if (!this.shadowDom) {
        try {
          return context.querySelector(selectorStr);
        } catch (e) {
          console.warn(`Invalid CSS Selector "${selectorStr}":`, e);
          return null;
        }
      }
      // Prefer a light-DOM match first (original behaviour), then shadow hits.
      try {
        const direct = context.querySelector(selectorStr);
        if (direct) return direct;
      } catch (e) {
        console.warn(`Invalid CSS Selector "${selectorStr}":`, e);
        return null;
      }
      return all.length ? all[0] : null;
    }

    /**
     * Executes any selector definition on the provided DOM element / document context.
     */
    extract(context, selector) {
      if (!context || !selector) return null;

      switch (selector.type) {
        case 'SelectorText':
          return this.extractText(context, selector);
        case 'SelectorLink':
          return this.extractLink(context, selector);
        case 'SelectorPopupLink':
          return this.extractPopupLink(context, selector);
        case 'SelectorImage':
          return this.extractImage(context, selector);
        case 'SelectorTable':
          return this.extractTable(context, selector);
        case 'SelectorElement':
          return this.extractElement(context, selector);
        case 'SelectorElementAttribute':
          return this.extractElementAttribute(context, selector);
        case 'SelectorHTML':
          return this.extractHTML(context, selector);
        case 'SelectorGrouped':
          return this.extractGrouped(context, selector);
        case 'SelectorPagination':
          return this.extractPagination(context, selector);
        case 'SelectorElementClick':
          return this.extractElement(context, selector);
        case 'SelectorElementScroll':
          return this.extractElement(context, selector);
        case 'SelectorXPath':
          return this.extractXPath(context, selector);
        default:
          return this.extractText(context, selector);
      }
    }

    extractText(context, selector) {
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return postProcess(elements.map(el => applyRegex(getElementVisibleText(el), selector.regex)), selector);
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return postProcess('', selector);
        return postProcess(applyRegex(getElementVisibleText(el), selector.regex), selector);
      }
    }

    extractLink(context, selector) {
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return elements.map(el => {
          let href = '';
          if (selector.linkType === 'linkFromText') {
            href = resolveUrl(cleanText(el.textContent), this.baseUrl);
          } else if (selector.linkType === 'linkFromAttribute') {
            href = resolveUrl(el.getAttribute('data-href') || el.getAttribute('href') || '', this.baseUrl);
          } else {
            href = resolveUrl(el.getAttribute('href') || el.getAttribute('data-href') || '', this.baseUrl);
          }
          return {
            href: href,
            text: postProcess(cleanText(el.textContent), selector)
          };
        });
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return postProcess({ href: '', text: '' }, selector);
        let href = '';
        if (selector.linkType === 'linkFromText') {
          href = resolveUrl(cleanText(el.textContent), this.baseUrl);
        } else if (selector.linkType === 'linkFromAttribute') {
          href = resolveUrl(el.getAttribute('data-href') || el.getAttribute('href') || '', this.baseUrl);
        } else {
          href = resolveUrl(el.getAttribute('href') || el.getAttribute('data-href') || '', this.baseUrl);
        }
        return {
          href: href,
          text: postProcess(cleanText(el.textContent), selector)
        };
      }
    }

    extractPopupLink(context, selector) {
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return elements.map(el => ({
          href: extractPopupUrl(el, this.baseUrl),
          text: cleanText(el.textContent)
        }));
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return { href: '', text: '' };
        return {
          href: extractPopupUrl(el, this.baseUrl),
          text: cleanText(el.textContent)
        };
      }
    }

    extractImage(context, selector) {
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return postProcess(elements.map(el => extractImageUrl(el, this.baseUrl)), selector);
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return postProcess('', selector);
        return postProcess(extractImageUrl(el, this.baseUrl), selector);
      }
    }

    extractElementAttribute(context, selector) {
      const attrName = selector.extractAttribute || 'href';
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return postProcess(elements.map(el => applyRegex(el.getAttribute(attrName) || '', selector.regex)), selector);
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return postProcess('', selector);
        return postProcess(applyRegex(el.getAttribute(attrName) || '', selector.regex), selector);
      }
    }

    extractHTML(context, selector) {
      if (selector.multiple) {
        const elements = this.queryAll(context, selector.selector);
        return postProcess(elements.map(el => applyRegex(selector.outerHTML ? el.outerHTML : el.innerHTML, selector.regex)), selector);
      } else {
        const el = this.queryFirst(context, selector.selector);
        if (!el) return postProcess('', selector);
        return postProcess(applyRegex(selector.outerHTML ? el.outerHTML : el.innerHTML, selector.regex), selector);
      }
    }

    extractGrouped(context, selector) {
      const elements = this.queryAll(context, selector.selector);
      const delimiter = selector.delimiter !== undefined ? selector.delimiter : ', ';
      const values = elements.map(el => {
        if (selector.extractAttribute) {
          return el.getAttribute(selector.extractAttribute) || '';
        }
        return cleanText(el.textContent);
      }).filter(Boolean);
      return postProcess(values.join(delimiter), selector);
    }

    extractTable(context, selector) {
      const tableEl = this.queryFirst(context, selector.selector);
      if (!tableEl) return [];

      const headerRowSel = selector.tableHeaderRowSelector || 'thead tr, tr:first-child';
      const dataRowSel = selector.tableDataRowSelector || 'tbody tr, tr:not(:first-child)';

      const headerRow = tableEl.querySelector(headerRowSel);
      let headers = [];
      if (headerRow) {
        const thCells = headerRow.querySelectorAll('th, td');
        headers = Array.from(thCells).map((cell, idx) => cleanText(cell.textContent) || `Column_${idx + 1}`);
      }

      // If columns are defined in selector, use column mappings
      const configuredCols = Array.isArray(selector.columns) && selector.columns.length > 0 ? selector.columns : null;
      if (configuredCols) {
        headers = configuredCols.map(c => c.name || c.header);
      }

      const dataRows = Array.from(tableEl.querySelectorAll(dataRowSel));
      const results = [];

      dataRows.forEach(row => {
        // Skip header row if it matched dataRowSel
        if (row === headerRow) return;

        const cells = Array.from(row.querySelectorAll('td, th'));
        if (cells.length === 0) return;

        const rowObj = {};
        let hasAnyData = false;

        headers.forEach((hName, idx) => {
          if (configuredCols && configuredCols[idx] && configuredCols[idx].extract === false) {
            return; // Skip non-extracted column
          }
          const cell = cells[idx];
          const val = cell ? cleanText(cell.textContent) : '';
          if (val) hasAnyData = true;
          rowObj[hName] = val;
        });

        if (hasAnyData) {
          results.push(rowObj);
        }
      });

      return results;
    }

    extractElement(context, selector) {
      return this.queryAll(context, selector.selector);
    }

    extractPagination(context, selector) {
      const elements = this.queryAll(context, selector.selector);
      const urls = [];
      elements.forEach(el => {
        const href = el.getAttribute('href') || el.getAttribute('data-href');
        if (href) {
          const resolved = resolveUrl(href, this.baseUrl);
          if (resolved && !urls.includes(resolved)) {
            urls.push(resolved);
          }
        }
      });
      return urls;
    }

    /**
     * Executes an XPath expression on the provided DOM element / document context.
     */
    extractXPath(context, selector) {
      const xpath = selector.selector || (selector.defaultConfig && selector.defaultConfig.xpath) || '';
      const extractAttr = selector.extractAttribute || '';
      const multiple = selector.multiple;
      const regex = selector.regex || '';

      if (!context || !xpath) {
        return multiple ? [] : '';
      }

      const nodeValue = (node) => {
        if (!node) return '';
        let value = '';
        if (extractAttr && typeof node.getAttribute === 'function') {
          value = node.getAttribute(extractAttr) || '';
        } else {
          value = node.textContent || node.nodeValue || '';
        }
        return applyRegex(value, regex);
      };

      try {
        const doc = context.ownerDocument || context;
        // Resolve evaluate() and XPathResult from the document's own window so
        // this works in extension pages, content scripts, and jsdom tests alike.
        const view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
        const XPR = (view && view.XPathResult) || (typeof XPathResult !== 'undefined' ? XPathResult : null);
        if (typeof doc.evaluate !== 'function' || !XPR) {
          console.warn('XPath evaluation is not supported in this environment.');
          return multiple ? [] : '';
        }

        if (multiple) {
          const results = [];
          const result = doc.evaluate(xpath, context, null, XPR.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < result.snapshotLength; i++) {
            results.push(nodeValue(result.snapshotItem(i)));
          }
          return postProcess(results, selector);
        }

        const result = doc.evaluate(xpath, context, null, XPR.FIRST_ORDERED_NODE_TYPE, null);
        return postProcess(nodeValue(result.singleNodeValue), selector);
      } catch (e) {
        console.warn('XPath error:', e);
        return multiple ? [] : '';
      }
    }
  }

  return SelectorEngine;
}));
