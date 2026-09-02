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

  const Selector = SelectorModule.Selector;

  class Sitemap {
    constructor(data = {}) {
      this._id = String(data._id || data.id || '').trim();
      this.name = String(data.name || this._id || '').trim();
      
      let startUrls = data.startUrl || data.startUrls || [];
      if (typeof startUrls === 'string') {
        startUrls = [startUrls];
      }
      this.startUrl = Array.isArray(startUrls) ? startUrls.map(u => String(u).trim()).filter(Boolean) : [];
      
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
        errors.push('Sitemap ID is required.');
      } else if (!/^[a-zA-Z0-9_\-]+$/.test(this._id)) {
        errors.push('Sitemap ID must contain only letters, numbers, hyphens, and underscores.');
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
  }

  return Sitemap;
}));
