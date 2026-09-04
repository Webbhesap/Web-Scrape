/**
 * Ö8 — Sitemap template library.
 * Built-in, fully local skeletons ("Product list", "Table", "Paginated list",
 * "Image gallery", "Links + subpage") plus helpers for saving the current
 * sitemap as a reusable user template. Pure data, no storage access here.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SitemapTemplates = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BUILTINS = [
    {
      id: 'product-list',
      nameKey: 'tplProductList',
      descKey: 'tplProductListDesc',
      selectors: [
        { id: 'product', type: 'SelectorElement', selector: '.product', parentSelectors: ['_root'], multiple: true },
        { id: 'title', type: 'SelectorText', selector: 'h3, .title', parentSelectors: ['product'] },
        { id: 'price', type: 'SelectorText', selector: '.price', parentSelectors: ['product'] },
        { id: 'image', type: 'SelectorImage', selector: 'img', parentSelectors: ['product'] },
        { id: 'url', type: 'SelectorLink', selector: 'a', parentSelectors: ['product'] }
      ]
    },
    {
      id: 'table',
      nameKey: 'tplTable',
      descKey: 'tplTableDesc',
      selectors: [
        { id: 'table-row', type: 'SelectorElement', selector: 'tbody tr', parentSelectors: ['_root'], multiple: true },
        { id: 'col-1', type: 'SelectorText', selector: 'td:nth-child(1)', parentSelectors: ['table-row'] },
        { id: 'col-2', type: 'SelectorText', selector: 'td:nth-child(2)', parentSelectors: ['table-row'] },
        { id: 'col-3', type: 'SelectorText', selector: 'td:nth-child(3)', parentSelectors: ['table-row'] }
      ]
    },
    {
      id: 'paginated-list',
      nameKey: 'tplPaginatedList',
      descKey: 'tplPaginatedListDesc',
      selectors: [
        { id: 'item', type: 'SelectorElement', selector: '.item', parentSelectors: ['_root'], multiple: true },
        { id: 'item-title', type: 'SelectorText', selector: '.title', parentSelectors: ['item'] },
        { id: 'next', type: 'SelectorLink', selector: 'a.next', parentSelectors: ['_root', 'next'] }
      ]
    },
    {
      id: 'image-gallery',
      nameKey: 'tplImageGallery',
      descKey: 'tplImageGalleryDesc',
      selectors: [
        { id: 'gallery-image', type: 'SelectorImage', selector: 'img', parentSelectors: ['_root'], multiple: true },
        { id: 'caption', type: 'SelectorText', selector: 'figcaption, .caption', parentSelectors: ['_root'] }
      ]
    },
    {
      id: 'links-subpage',
      nameKey: 'tplLinksSubpage',
      descKey: 'tplLinksSubpageDesc',
      selectors: [
        { id: 'page-link', type: 'SelectorLink', selector: 'a.detail', parentSelectors: ['_root'], multiple: true },
        { id: 'sub-title', type: 'SelectorText', selector: 'h1', parentSelectors: ['page-link'] },
        { id: 'sub-content', type: 'SelectorText', selector: 'article', parentSelectors: ['page-link'] }
      ]
    }
  ];

  function listBuiltin() {
    return BUILTINS.map((tpl) => ({ id: tpl.id, nameKey: tpl.nameKey, descKey: tpl.descKey }));
  }

  function getBuiltin(id) {
    return BUILTINS.find((tpl) => tpl.id === id) || null;
  }

  /**
   * Builds a plain sitemap payload (ready for `new Sitemap(...)`) from a
   * built-in template. Returns null for unknown ids.
   */
  function buildSitemap(templateId, name, startUrls) {
    const tpl = getBuiltin(templateId);
    if (!tpl) return null;
    return {
      _id: name,
      name: name,
      startUrl: startUrls,
      selectors: JSON.parse(JSON.stringify(tpl.selectors))
    };
  }

  /**
   * Wraps an existing sitemap as a user template (deep copy — later edits to
   * the sitemap must not leak into the template).
   */
  function fromSitemap(sitemap, templateName) {
    if (!sitemap) return null;
    const name = String(templateName || sitemap.name || sitemap._id || 'template').trim();
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'template';
    return {
      id: 'tpl-' + slug,
      builtin: false,
      name: name,
      createdAt: new Date().toISOString(),
      sitemap: {
        startUrl: JSON.parse(JSON.stringify(sitemap.startUrl || [])),
        selectors: (sitemap.selectors || [])
          .map((s) => (s && typeof s.toJSON === 'function') ? s.toJSON() : s)
          .map((s) => JSON.parse(JSON.stringify(s))),
        options: JSON.parse(JSON.stringify(sitemap.options || {}))
      }
    };
  }

  return {
    listBuiltin: listBuiltin,
    getBuiltin: getBuiltin,
    buildSitemap: buildSitemap,
    fromSitemap: fromSitemap
  };
}));
