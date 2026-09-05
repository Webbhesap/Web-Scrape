/**
 * Sitemap Model and Operations.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./Selector.js', '../engine/UrlRangeExpander.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const { Selector } = require('./Selector.js');
    const UrlRangeExpander = require('../engine/UrlRangeExpander.js');
    module.exports = factory({ Selector }, UrlRangeExpander);
  } else {
    root.Sitemap = factory(root.Selector, root.UrlRangeExpander);
  }
}(typeof self !== 'undefined' ? self : this, function (SelectorModule, UrlRangeExpander) {
  'use strict';

  const Selector = (SelectorModule && SelectorModule.Selector) ? SelectorModule.Selector : SelectorModule;

  const TURKISH_CHAR_MAP = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u'
  };

  function slugifyId(str) {
    if (!str) return '';
    let s = String(str).trim();
    for (const [k, v] of Object.entries(TURKISH_CHAR_MAP)) {
      s = s.split(k).join(v);
    }
    
    // Normalize unicode accents
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {}

    s = s.toLowerCase()
      .replace(/[\s\t\r\n]+/g, '_')
      .replace(/[^a-z0-9_\-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');

    return s || `sitemap_${Date.now().toString(36)}`;
  }

  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('file://')) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  }

  class Sitemap {
    constructor(data = {}) {
      const rawId = String(data._id || data.id || '').trim();
      this.name = String(data.name || rawId || 'Untitled Sitemap').trim();
      this._id = slugifyId(rawId) || slugifyId(this.name) || `sitemap_${Date.now().toString(36)}`;
      
      let startUrls = data.startUrl || data.startUrls || [];
      if (typeof startUrls === 'string') {
        startUrls = [startUrls];
      }
      this.startUrl = Array.isArray(startUrls) 
        ? startUrls.map(u => normalizeUrl(String(u))).filter(Boolean) 
        : [];
      
      this.selectors = [];
      if (Array.isArray(data.selectors)) {
        for (const s of data.selectors) {
          if (s instanceof Selector) {
            this.selectors.push(s);
          } else if (typeof s === 'object' && s !== null) {
            this.selectors.push(new Selector(s));
          }
        }
      }

      // Crawl behaviour options (Ö2: shadowDom piercing is on by default).
      this.options = Object.assign(
        { shadowDom: true },
        (data.options && typeof data.options === 'object') ? data.options : {}
      );

      // P2.4: per-column CSV types persisted with the sitemap.
      // Shape: [{ name, type: 'number' | 'date', format?: 'YYYY-MM-DD' | 'DD/MM/YYYY' }]
      // (absent entry = plain text)
      this.columnTypes = [];
      if (Array.isArray(data.columnTypes)) {
        for (const ct of data.columnTypes) {
          if (ct && typeof ct.name === 'string' && ct.name
              && (ct.type === 'number' || ct.type === 'date')) {
            const entry = { name: ct.name, type: ct.type };
            if (ct.type === 'date') {
              entry.format = typeof ct.format === 'string' && ct.format ? ct.format : 'YYYY-MM-DD';
            }
            this.columnTypes.push(entry);
          }
        }
      }

      this.createdAt = data.createdAt || new Date().toISOString();
      this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    // P2.4: column type accessors (name -> {type, format?}).
    getColumnType(name) {
      return this.columnTypes.find((ct) => ct.name === name) || null;
    }

    /**
     * Sets (or, with type 'text', removes) the CSV type of a column.
     * Returns the sitemap for chaining.
     */
    setColumnType(name, type, format) {
      if (!name) return this;
      const rest = this.columnTypes.filter((ct) => ct.name !== name);
      if (type === 'number') {
        rest.push({ name: name, type: 'number' });
      } else if (type === 'date') {
        rest.push({
          name: name,
          type: 'date',
          format: typeof format === 'string' && format ? format : 'YYYY-MM-DD'
        });
      }
      // 'text' (or anything else) just means: no entry.
      this.columnTypes = rest;
      this.updatedAt = new Date().toISOString();
      return this;
    }

    validate() {
      const errors = [];
      if (!this._id) {
        errors.push('Sitemap name/ID is required.');
      }

      if (!this.startUrl || this.startUrl.length === 0) {
        errors.push('At least one Start URL is required.');
      } else {
        for (const url of this.startUrl) {
          if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            errors.push(`Invalid Start URL "${url}". Must start with http://, https://, or file://`);
          }
        }
      }

      // Validate selector unique IDs
      const ids = new Set();
      for (const selector of this.selectors) {
        if (ids.has(selector.id)) {
          errors.push(`Duplicate selector ID "${selector.id}". Selector IDs must be unique.`);
        }
        ids.add(selector.id);

        const selValidation = selector.validate();
        if (!selValidation.isValid) {
          errors.push(...selValidation.errors.map(err => `Selector "${selector.id || 'unnamed'}": ${err}`));
        }
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    }

    getExpandedStartUrls() {
      return UrlRangeExpander.expandStartUrls(this.startUrl);
    }

    getSelectorById(id) {
      return this.selectors.find(s => s.id === id) || null;
    }

    getDirectChildSelectors(parentId) {
      return this.selectors.filter(s => s.parentSelectors.includes(parentId));
    }

    getRootSelectors() {
      return this.getDirectChildSelectors('_root');
    }

    getAllSelectorIds() {
      return ['_root', ...this.selectors.map(s => s.id)];
    }

    wouldCreateCycle(selectorId, newParentId) {
      if (!selectorId || !newParentId || selectorId === newParentId) return true;
      let cur = newParentId;
      const seen = new Set();
      while (cur && cur !== '_root') {
        if (cur === selectorId) return true;
        if (seen.has(cur)) break;
        seen.add(cur);
        const parent = this.getSelectorById(cur);
        cur = parent && parent.parentSelectors && parent.parentSelectors[0];
      }
      return false;
    }

    reparentSelector(selectorId, newParentId) {
      const sel = this.getSelectorById(selectorId);
      if (!sel) return false;
      const parentId = newParentId || '_root';
      if (this.wouldCreateCycle(selectorId, parentId)) return false;
      sel.parentSelectors = [parentId];
      this.updatedAt = new Date().toISOString();
      return true;
    }

    reorderSibling(draggedId, targetId, placeAfter) {
      const dragged = this.getSelectorById(draggedId);
      const target = this.getSelectorById(targetId);
      if (!dragged || !target || draggedId === targetId) return false;
      const targetParent = (target.parentSelectors && target.parentSelectors[0]) || '_root';
      if (this.wouldCreateCycle(draggedId, targetParent)) return false;
      dragged.parentSelectors = [targetParent];
      const arr = this.selectors;
      const from = arr.findIndex(s => s.id === draggedId);
      if (from < 0) return false;
      const [item] = arr.splice(from, 1);
      let to = arr.findIndex(s => s.id === targetId);
      if (to < 0) {
        arr.push(item);
      } else {
        if (placeAfter) to += 1;
        arr.splice(to, 0, item);
      }
      this.updatedAt = new Date().toISOString();
      return true;
    }

    addSelector(selector) {
      const selInstance = selector instanceof Selector ? selector : new Selector(selector);
      const existingIdx = this.selectors.findIndex(s => s.id === selInstance.id);
      if (existingIdx >= 0) {
        this.selectors[existingIdx] = selInstance;
      } else {
        this.selectors.push(selInstance);
      }
      this.updatedAt = new Date().toISOString();
      return selInstance;
    }

    removeSelector(selectorId) {
      const removed = this.selectors.filter(s => s.id !== selectorId);
      this.selectors = removed;

      // Also clean up parentSelectors references in other selectors
      this.selectors.forEach(s => {
        s.parentSelectors = s.parentSelectors.filter(pId => pId !== selectorId);
        if (s.parentSelectors.length === 0) {
          s.parentSelectors = ['_root'];
        }
      });
      this.updatedAt = new Date().toISOString();
    }

    /**
     * Renames a selector in place, keeping the hierarchy intact: every child
     * that references `oldId` in its parentSelectors is re-pointed to `newId`.
     * Returns false when the selector does not exist or `newId` already
     * belongs to another selector (the caller must surface that error — a
     * silent overwrite would destroy the other selector's configuration).
     */
    renameSelector(oldId, newId) {
      if (!oldId || !newId || oldId === newId) return oldId === newId;
      const sel = this.getSelectorById(oldId);
      if (!sel) return false;
      if (this.getSelectorById(newId)) return false;

      sel.id = newId;
      this.selectors.forEach(s => {
        if (s === sel) return;
        s.parentSelectors = s.parentSelectors.map(pId => (pId === oldId ? newId : pId));
      });
      this.updatedAt = new Date().toISOString();
      return true;
    }

    toJSON() {
      return {
        _id: this._id,
        name: this.name,
        startUrl: this.startUrl,
        options: Object.assign({}, this.options),
        selectors: this.selectors.map(s => s.toJSON()),
        // P2.4: column types round-trip with the sitemap JSON.
        columnTypes: this.columnTypes.map((ct) => Object.assign({}, ct))
      };
    }

    /**
     * Ö10 — normalizes imported sitemap JSON (ours or webscraper.io's):
     * keeps only the fields we understand, drops unknown ones safely,
     * fills missing fields with defaults and filters broken selector rows.
     * Returns null when the input is not a usable object.
     */
    static normalizeImported(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

      const rawId = String(data._id || data.id || '').trim();
      const name = String(data.name || rawId || 'imported_sitemap').trim();

      let startUrls = data.startUrl || data.startUrls || [];
      if (typeof startUrls === 'string') startUrls = [startUrls];
      if (!Array.isArray(startUrls)) startUrls = [];
      startUrls = startUrls.filter((u) => typeof u === 'string' && u.trim() !== '');

      const rawSelectors = Array.isArray(data.selectors) ? data.selectors : [];
      const selectors = [];
      for (const sel of rawSelectors) {
        if (!sel || typeof sel !== 'object') continue;
        const clean = {
          id: sel.id,
          type: sel.type,
          selector: sel.selector,
          multiple: sel.multiple === true,
          delay: sel.delay,
          regex: sel.regex,
          defaultValue: sel.defaultValue,
          transforms: Array.isArray(sel.transforms) ? sel.transforms : [],
          parentSelectors: Array.isArray(sel.parentSelectors) && sel.parentSelectors.length
            ? sel.parentSelectors
            : ['_root']
        };
        // Known type-specific fields (webscraper.io uses the same names);
        // unknown extras are dropped so they never leak into storage.
        for (const key of [
          'linkType', 'downloadImage', 'tableHeaderRowSelector', 'tableDataRowSelector', 'columns',
          'extractAttribute', 'outerHTML', 'delimiter', 'paginationType', 'maxPages',
          'clickElementSelector', 'clickType', 'clickElementUniquenessType', 'clickDelay', 'discardInitialElements',
          'scrollElementSelector', 'scrollDelay', 'maxScrolls'
        ]) {
          if (sel[key] !== undefined) clean[key] = sel[key];
        }
        selectors.push(clean);
      }

      const options = (data.options && typeof data.options === 'object' && !Array.isArray(data.options))
        ? data.options
        : {};

      return {
        _id: rawId || name,
        name: name,
        startUrl: startUrls,
        selectors: selectors,
        options: options
      };
    }

    static fromJSON(json) {
      if (typeof json === 'string') {
        json = JSON.parse(json);
      }
      return new Sitemap(json);
    }

    static slugify(str) {
      return slugifyId(str);
    }

    /** Shared URL normalization (used by the constructor AND the dashboard). */
    static normalizeUrl(url) {
      return normalizeUrl(url);
    }
  }

  return Sitemap;
}));
