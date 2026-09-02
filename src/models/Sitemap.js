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

      this.createdAt = data.createdAt || new Date().toISOString();
      this.updatedAt = data.updatedAt || new Date().toISOString();
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

    toJSON() {
      return {
        _id: this._id,
        name: this.name,
        startUrl: this.startUrl,
        selectors: this.selectors.map(s => s.toJSON())
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
  }

  return Sitemap;
}));
