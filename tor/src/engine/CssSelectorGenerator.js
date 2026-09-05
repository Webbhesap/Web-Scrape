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
    return String(str).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
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

    // 1. Find intersection of class names (prioritize stable, non-dynamic classes)
    let commonClasses = getCleanClasses(elements[0]);
    for (let i = 1; i < elements.length; i++) {
      const elClasses = new Set(getCleanClasses(elements[i]));
      // Only keep classes that appear in ALL elements and are not ignored patterns
      commonClasses = commonClasses.filter(c => {
        return elClasses.has(c) && !IGNORED_CLASS_PATTERNS.some(pat => pat.test(c));
      });
    }

    const firstTag = elements[0].tagName.toLowerCase();
    const allSameTag = elements.every(el => el.tagName.toLowerCase() === firstTag);

    // 2. Try using common classes as selector (most robust for repeated elements)
    if (commonClasses.length > 0) {
      // Sort classes by stability (longer, more specific classes first)
      const sortedClasses = commonClasses.sort((a, b) => b.length - a.length);
      for (const cls of sortedClasses) {
        const sel = `.${escapeCss(cls)}`;
        try {
          const matched = Array.from(doc.querySelectorAll(sel));
          // Match if all elements are included AND the selector doesn't match too many extra elements
          if (elements.every(el => matched.includes(el)) && matched.length <= elements.length * 2) {
            return sel;
          }
        } catch (e) {}
      }

      // Use combined classes with tag
      const fullClassSel = sortedClasses.slice(0, 3).map(c => `.${escapeCss(c)}`).join('');
      const tagWithClasses = allSameTag ? `${firstTag}${fullClassSel}` : fullClassSel;
      try {
        const matched = Array.from(doc.querySelectorAll(tagWithClasses));
        if (elements.every(el => matched.includes(el)) && matched.length <= elements.length * 2) {
          return tagWithClasses;
        }
      } catch (e) {}
    }

    // 3. Find lowest common ancestor parent with child selector
    const parents = elements.map(el => el.parentElement).filter(Boolean);
    if (parents.length === elements.length && parents.every((p) => p === parents[0])) {
      // All elements have the same parent
      const parentSel = getUniqueSelectorForElement(parents[0], doc);
      const childTag = allSameTag ? firstTag : '*';
      const combined = `${parentSel} > ${childTag}`;
      try {
        const matched = Array.from(doc.querySelectorAll(combined));
        if (elements.every(el => matched.includes(el))) {
          return combined;
        }
      } catch (e) {}
    } else if (parents.length === elements.length) {
      // Elements have different parents - try to find common ancestor
      let commonAncestor = parents[0];
      for (let i = 1; i < parents.length; i++) {
        let ancestor = parents[i];
        while (ancestor && ancestor !== commonAncestor && ancestor !== doc.body) {
          if (commonAncestor.contains(ancestor)) {
            // commonAncestor is inside ancestor, use ancestor
            commonAncestor = ancestor;
            break;
          }
          ancestor = ancestor.parentElement;
        }
      }
      if (commonAncestor && commonAncestor !== doc.body) {
        const parentSel = getUniqueSelectorForElement(commonAncestor, doc);
        const childTag = allSameTag ? firstTag : '*';
        const combined = `${parentSel} > ${childTag}`;
        try {
          const matched = Array.from(doc.querySelectorAll(combined));
          if (elements.every(el => matched.includes(el))) {
            return combined;
          }
        } catch (e) {}
      }
    }

    // 4. Enhanced parent-child breadth walk with nth-of-type
    const path = [];
    let current = elements[0];
    const seen = new Set();
    while (current && current !== doc.body && current !== doc.documentElement && !seen.has(current)) {
      seen.add(current);
      let desc = getElementDescriptor(current);

      // If desc is just a tag, add nth-of-type for differentiation
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
        if (matches.length === 1 && matches[0] === elements[0]) {
          return testSelector;
        }
      } catch (e) {}

      current = current.parentElement;
      if (path.length >= 6) break; // keep selector concise
    }

    // 5. Fallback: tag name with index if all same tag
    if (allSameTag && elements.length > 1) {
      // Try :nth-of-type based selector
      const firstEl = elements[0];
      const parent = firstEl.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName && el.tagName.toLowerCase() === firstTag);
        if (siblings.length >= elements.length) {
          const index = siblings.indexOf(firstEl) + 1;
          return `${firstTag}:nth-of-type(${index})`;
        }
      }
    }

    // 6. Final fallback
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
