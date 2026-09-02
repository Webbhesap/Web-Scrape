/**
 * Selector Model and Schema Definitions.
 * Supports all Web Scraper selector types.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Selector = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SELECTOR_TYPES = {
    SelectorText: {
      type: 'SelectorText',
      title: 'Text',
      description: 'Extracts plain text content from elements (strips HTML tags and trims whitespace).',
      icon: 'type',
      acceptsChildren: false,
      isLink: false,
      isContainer: false,
      defaultConfig: {
        regex: '',
        delay: 0,
        multiple: false
      }
    },
    SelectorLink: {
      type: 'SelectorLink',
      title: 'Link',
      description: 'Extracts URLs and allows child selectors to navigate and scrape linked pages.',
      icon: 'link',
      acceptsChildren: true,
      isLink: true,
      isContainer: false,
      defaultConfig: {
        linkType: 'linkFromHref', // linkFromHref | linkFromText | linkFromAttribute | linkFromScript
        delay: 0,
        multiple: false
      }
    },
    SelectorPopupLink: {
      type: 'SelectorPopupLink',
      title: 'Link (Popup)',
      description: 'Follows links that open in popup windows/dialogs or script handlers.',
      icon: 'externalLink',
      acceptsChildren: true,
      isLink: true,
      isContainer: false,
      defaultConfig: {
        delay: 0,
        multiple: false
      }
    },
    SelectorImage: {
      type: 'SelectorImage',
      title: 'Image',
      description: 'Extracts image URLs from src, data-src, srcset, or background-image CSS.',
      icon: 'image',
      acceptsChildren: false,
      isLink: false,
      isContainer: false,
      defaultConfig: {
        downloadImage: false,
        delay: 0,
        multiple: false
      }
    },
    SelectorTable: {
      type: 'SelectorTable',
      title: 'Table',
      description: 'Extracts tabular data matching headers and data rows automatically.',
      icon: 'table',
      acceptsChildren: false,
      isLink: false,
      isContainer: true,
      defaultConfig: {
        tableHeaderRowSelector: 'thead tr, tr:first-child',
        tableDataRowSelector: 'tbody tr, tr:not(:first-child)',
        columns: [],
        delay: 0,
        multiple: true
      }
    },
    SelectorElement: {
      type: 'SelectorElement',
      title: 'Element (Container)',
      description: 'Container selector for repeated items/cards. Child selectors extract fields relative to each item.',
      icon: 'layers',
      acceptsChildren: true,
      isLink: false,
      isContainer: true,
      defaultConfig: {
        delay: 0,
        multiple: true
      }
    },
    SelectorElementAttribute: {
      type: 'SelectorElementAttribute',
      title: 'Element Attribute',
      description: 'Extracts custom HTML attributes (e.g. data-id, href, title, alt, aria-*).',
      icon: 'code',
      acceptsChildren: false,
      isLink: false,
      isContainer: false,
      defaultConfig: {
        extractAttribute: 'href',
        regex: '',
        delay: 0,
        multiple: false
      }
    },
    SelectorHTML: {
      type: 'SelectorHTML',
      title: 'HTML',
      description: 'Extracts raw inner or outer HTML content.',
      icon: 'code',
      acceptsChildren: false,
      isLink: false,
      isContainer: false,
      defaultConfig: {
        regex: '',
        outerHTML: false,
        delay: 0,
        multiple: false
      }
    },
    SelectorGrouped: {
      type: 'SelectorGrouped',
      title: 'Grouped',
      description: 'Extracts multiple element texts or attributes as a comma-separated list into a single field.',
      icon: 'folder',
      acceptsChildren: false,
      isLink: false,
      isContainer: false,
      defaultConfig: {
        extractAttribute: '',
        delimiter: ', ',
        delay: 0
      }
    },
    SelectorPagination: {
      type: 'SelectorPagination',
      title: 'Pagination',
      description: 'Navigates multi-page lists recursively (Next buttons, page numbers, infinite scroll).',
      icon: 'arrowDown',
      acceptsChildren: true,
      isLink: true,
      isContainer: false,
      defaultConfig: {
        paginationType: 'link', // 'link' | 'click' | 'scroll'
        maxPages: 0, // 0 = unlimited
        delay: 0,
        multiple: true
      }
    },
    SelectorElementClick: {
      type: 'SelectorElementClick',
      title: 'Element Click',
      description: 'Interactively clicks buttons (e.g. "Load more", pagination, tabs) to load dynamic data.',
      icon: 'mousePointer',
      acceptsChildren: true,
      isLink: false,
      isContainer: true,
      defaultConfig: {
        clickElementSelector: '',
        clickType: 'clickMore', // clickOnce | clickMore
        clickElementUniquenessType: 'uniqueHTMLText', // uniqueText | uniqueHTMLText | uniqueCSSSelector | uniqueHTML
        discardInitialElements: false,
        clickDelay: 1000,
        delay: 0,
        multiple: true
      }
    },
    SelectorElementScroll: {
      type: 'SelectorElementScroll',
      title: 'Element Scroll',
      description: 'Smoothly scrolls the page or container down (infinite scroll) until all dynamic items load.',
      icon: 'arrowDown',
      acceptsChildren: true,
      isLink: false,
      isContainer: true,
      defaultConfig: {
        scrollElementSelector: '',
        scrollDelay: 1000,
        maxScrolls: 20,
        delay: 0,
        multiple: true
      }
    }
  };

  class Selector {
    constructor(data = {}) {
      this.id = String(data.id || '').trim();
      this.type = data.type || 'SelectorText';
      this.selector = String(data.selector || '').trim();
      this.parentSelectors = Array.isArray(data.parentSelectors) && data.parentSelectors.length > 0
        ? [...data.parentSelectors]
        : ['_root'];
      this.multiple = data.multiple === true;
      this.delay = parseInt(data.delay, 10) || 0;
      this.regex = data.regex || '';

      const typeMeta = SELECTOR_TYPES[this.type] || SELECTOR_TYPES.SelectorText;
      this.acceptsChildren = !!typeMeta.acceptsChildren;

      // Type-specific attributes
      if (this.type === 'SelectorLink') {
        this.linkType = data.linkType || 'linkFromHref';
      } else if (this.type === 'SelectorImage') {
        this.downloadImage = data.downloadImage === true;
      } else if (this.type === 'SelectorTable') {
        this.tableHeaderRowSelector = data.tableHeaderRowSelector || 'thead tr, tr:first-child';
        this.tableDataRowSelector = data.tableDataRowSelector || 'tbody tr, tr:not(:first-child)';
        this.columns = Array.isArray(data.columns) ? JSON.parse(JSON.stringify(data.columns)) : [];
      } else if (this.type === 'SelectorElementAttribute') {
        this.extractAttribute = data.extractAttribute || 'href';
      } else if (this.type === 'SelectorHTML') {
        this.outerHTML = data.outerHTML === true;
      } else if (this.type === 'SelectorGrouped') {
        this.extractAttribute = data.extractAttribute || '';
        this.delimiter = data.delimiter !== undefined ? data.delimiter : ', ';
      } else if (this.type === 'SelectorPagination') {
        this.paginationType = data.paginationType || 'link';
        this.maxPages = parseInt(data.maxPages, 10) || 0;
      } else if (this.type === 'SelectorElementClick') {
        this.clickElementSelector = data.clickElementSelector || '';
        this.clickType = data.clickType || 'clickMore';
        this.clickElementUniquenessType = data.clickElementUniquenessType || 'uniqueHTMLText';
        this.discardInitialElements = data.discardInitialElements === true;
        this.clickDelay = parseInt(data.clickDelay, 10) || 1000;
      } else if (this.type === 'SelectorElementScroll') {
        this.scrollElementSelector = data.scrollElementSelector || '';
        this.scrollDelay = parseInt(data.scrollDelay, 10) || 1000;
        this.maxScrolls = parseInt(data.maxScrolls, 10) || 20;
      }
    }

    validate() {
      const errors = [];
      if (!this.id) {
        errors.push('Selector ID is required.');
      } else if (!/^[a-zA-Z0-9_\-]+$/.test(this.id)) {
        errors.push('Selector ID must contain only alphanumeric characters, underscores, and dashes.');
      } else if (this.id === '_root') {
        errors.push('Selector ID cannot be "_root".');
      }

      if (!this.selector && this.type !== 'SelectorElementScroll') {
        errors.push('CSS Selector is required.');
      }

      if (!this.parentSelectors || this.parentSelectors.length === 0) {
        errors.push('At least one Parent Selector is required.');
      }

      if (this.type === 'SelectorElementAttribute' && !this.extractAttribute) {
        errors.push('Attribute name is required for Element Attribute selector.');
      }

      if (this.type === 'SelectorElementClick' && !this.clickElementSelector) {
        errors.push('Click Element Selector is required for Element Click selector.');
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    }

    toJSON() {
      const obj = {
        id: this.id,
        type: this.type,
        selector: this.selector,
        parentSelectors: this.parentSelectors,
        multiple: this.multiple,
        delay: this.delay
      };

      if (this.regex) obj.regex = this.regex;

      if (this.type === 'SelectorLink') {
        obj.linkType = this.linkType;
      } else if (this.type === 'SelectorImage') {
        if (this.downloadImage) obj.downloadImage = this.downloadImage;
      } else if (this.type === 'SelectorTable') {
        obj.tableHeaderRowSelector = this.tableHeaderRowSelector;
        obj.tableDataRowSelector = this.tableDataRowSelector;
        obj.columns = this.columns;
      } else if (this.type === 'SelectorElementAttribute') {
        obj.extractAttribute = this.extractAttribute;
      } else if (this.type === 'SelectorHTML') {
        if (this.outerHTML) obj.outerHTML = this.outerHTML;
      } else if (this.type === 'SelectorGrouped') {
        if (this.extractAttribute) obj.extractAttribute = this.extractAttribute;
        obj.delimiter = this.delimiter;
      } else if (this.type === 'SelectorPagination') {
        obj.paginationType = this.paginationType;
        if (this.maxPages) obj.maxPages = this.maxPages;
      } else if (this.type === 'SelectorElementClick') {
        obj.clickElementSelector = this.clickElementSelector;
        obj.clickType = this.clickType;
        obj.clickElementUniquenessType = this.clickElementUniquenessType;
        obj.discardInitialElements = this.discardInitialElements;
        obj.clickDelay = this.clickDelay;
      } else if (this.type === 'SelectorElementScroll') {
        obj.scrollElementSelector = this.scrollElementSelector;
        obj.scrollDelay = this.scrollDelay;
        obj.maxScrolls = this.maxScrolls;
      }

      return obj;
    }

    clone() {
      return new Selector(JSON.parse(JSON.stringify(this.toJSON())));
    }
  }

  return {
    Selector: Selector,
    SELECTOR_TYPES: SELECTOR_TYPES
  };
}));
