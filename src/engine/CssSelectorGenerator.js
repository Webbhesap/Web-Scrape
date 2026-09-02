/**
 * Intelligent CSS Selector Generator.
 * Computes optimal, clean, robust CSS selectors for single and multiple DOM elements.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CssSelectorGenerator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Safe CSS escaping for both Browser and Node.js
  function escapeCss(str) {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(str);
    }
    return String(str).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
  }

  // Ignore dynamic, utility, or active classes that change state
  const IGNORED_CLASS_PATTERNS = [
    /^(active|hover|focus|selected|open|closed|visible|hidden|disabled|loading|expanded|current)$/i,
    /^ng-|^v-|^data-v-|^svelte-|^css-[0-9a-z]+/i,
    /^[0-9a-f]{8,}$/i, // Random hash classes
    /^_[0-9a-zA-Z]{5,}$/i, // CSS module hashes
    /^sc-[0-9a-zA-Z]+/i, // styled components
    /^ws-picker/i // Web Scraper picker internal classes
  ];

  function getCleanClasses(el) {
    if (!el || !el.classList) return [];
    const list = Array.from(el.classList);
    return list.filter(c => {
      if (!c || c.trim().length === 0) return false;
      return !IGNORED_CLASS_PATTERNS.some(pat => pat.test(c));
    });
  }

  function isMeaningfulId(id) {
    if (!id || typeof id !== 'string') return false;
    if (id.length > 40 || id.length < 2) return false;
    // Discard dynamic auto-generated IDs
    if (/^[0-9]+$/.test(id)) return false;
    if (/[0-9a-f]{8,}/i.test(id)) return false;
    if (/^(ember|react|vue|ng|radix|headlessui|aria-|ws-)/i.test(id)) return false;
    return true;
  }

  function getElementDescriptor(el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    
    if (el.id && isMeaningfulId(el.id)) {
      return `#${escapeCss(el.id)}`;
    }

    const classes = getCleanClasses(el);
    if (classes.length > 0) {
      const classStr = classes.slice(0, 3).map(c => `.${escapeCss(c)}`).join('');
      return `${tag}${classStr}`;
    }

    // Attributes like name or type
    if (tag === 'input' && el.name) {
      return `input[name="${el.name}"]`;
    }

    return tag;
  }

  function getUniqueSelectorForElement(el, rootDoc) {
    const doc = rootDoc || (el.ownerDocument || document);
    if (!el || el === doc.body || el === doc.documentElement) {
      return 'body';
    }

    // 1. Direct ID check
    if (el.id && isMeaningfulId(el.id)) {
      const idSel = `#${escapeCss(el.id)}`;
      try {
        if (doc.querySelectorAll(idSel).length === 1) {
          return idSel;
        }
      } catch (e) {}
    }

    // 2. Direct Class check
    const classes = getCleanClasses(el);
    const tag = el.tagName.toLowerCase();
    if (classes.length > 0) {
      for (let i = 1; i <= Math.min(3, classes.length); i++) {
        const clsSubset = classes.slice(0, i).map(c => `.${escapeCss(c)}`).join('');
        const selWithTag = `${tag}${clsSubset}`;
        const selClassOnly = clsSubset;

        try {
          if (doc.querySelectorAll(selClassOnly).length === 1) return selClassOnly;
          if (doc.querySelectorAll(selWithTag).length === 1) return selWithTag;
        } catch (e) {}
      }
    }

    // 3. Parent-Child Breadth Walk
    const path = [];
    let current = el;
    while (current && current !== doc.body && current !== doc.documentElement) {
      let desc = getElementDescriptor(current);

      // If desc is just a tag, add nth-of-type
      if (desc === current.tagName.toLowerCase()) {
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            desc += `:nth-of-type(${index})`;
          }
        }
      }

      path.unshift(desc);
      const testSelector = path.join(' > ');
      try {
        const matches = doc.querySelectorAll(testSelector);
        if (matches.length === 1 && matches[0] === el) {
          return testSelector;
        }
      } catch (e) {}

      current = current.parentElement;
      if (path.length >= 5) break; // keep selector concise
    }

    return path.join(' > ') || tag;
  }

  function getGeneralizedSelectorForElements(elements, rootDoc) {
    if (!elements || elements.length === 0) return '';
    if (elements.length === 1) return getUniqueSelectorForElement(elements[0], rootDoc);

    const doc = rootDoc || (elements[0].ownerDocument || document);

    // 1. Find intersection of class names
    let commonClasses = getCleanClasses(elements[0]);
    for (let i = 1; i < elements.length; i++) {
      const elClasses = new Set(getCleanClasses(elements[i]));
      commonClasses = commonClasses.filter(c => elClasses.has(c));
    }

    const firstTag = elements[0].tagName.toLowerCase();
    const allSameTag = elements.every(el => el.tagName.toLowerCase() === firstTag);

    if (commonClasses.length > 0) {
      for (const cls of commonClasses) {
        const sel = `.${escapeCss(cls)}`;
        try {
          const matched = Array.from(doc.querySelectorAll(sel));
          if (elements.every(el => matched.includes(el))) {
            return sel;
          }
        } catch (e) {}
      }

      const fullClassSel = commonClasses.map(c => `.${escapeCss(c)}`).join('');
      const tagWithClasses = allSameTag ? `${firstTag}${fullClassSel}` : fullClassSel;
      try {
        const matched = Array.from(doc.querySelectorAll(tagWithClasses));
        if (elements.every(el => matched.includes(el))) {
          return tagWithClasses;
        }
      } catch (e) {}
    }

    // 2. Find lowest common ancestor parent
    const parents = elements.map(el => el.parentElement).filter(Boolean);
    if (parents.length === elements.length) {
      const parentSel = getUniqueSelectorForElement(parents[0], doc);
      const childTag = allSameTag ? firstTag : '*';
      const combined = `${parentSel} > ${childTag}`;
      try {
        const matched = Array.from(doc.querySelectorAll(combined));
        if (elements.every(el => matched.includes(el))) {
          return combined;
        }
      } catch (e) {}
    }

    // 3. Fallback: tag name or generic path
    return allSameTag ? firstTag : '*';
  }

  return {
    escapeCss: escapeCss,
    getUniqueSelectorForElement: getUniqueSelectorForElement,
    getGeneralizedSelectorForElements: getGeneralizedSelectorForElements,
    getCleanClasses: getCleanClasses,
    getElementDescriptor: getElementDescriptor
  };
}));
