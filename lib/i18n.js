/**
 * Simple TR/EN UI translations.
 */
(function (root, factory) {
  const result = factory();
  if (typeof module === 'object' && module.exports) module.exports = result;
  if (root) root.AppI18n = result;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const dict = {
    en: {
      sitemaps: 'Sitemaps',
      createSitemap: 'Create Sitemap',
      importSitemap: 'Import Sitemap',
      selectors: 'Selectors',
      selectorGraph: 'Selector graph',
      editMetadata: 'Edit metadata',
      scrape: 'Scrape',
      browseData: 'Browse data',
      imageGallery: 'Image gallery',
      exportData: 'Export data',
      exportSitemap: 'Export sitemap',
      deleteSitemap: 'Delete sitemap',
      createNewSitemap: 'Create new sitemap',
      addSelector: 'Add new selector',
      findReplace: 'Find / Replace',
      startSlideshow: 'Start slideshow',
      downloadZip: 'Download ZIP',
      downloadSelected: 'ZIP selected',
      columns: 'Columns',
      saveUrl: 'Save URL',
      delete: 'Delete',
      lang: 'EN'
    },
    tr: {
      sitemaps: 'Site haritaları',
      createSitemap: 'Site haritası oluştur',
      importSitemap: 'Site haritası içe aktar',
      selectors: 'Seçiciler',
      selectorGraph: 'Seçici grafiği',
      editMetadata: 'Meta veriyi düzenle',
      scrape: 'Kazı',
      browseData: 'Veriye göz at',
      imageGallery: 'Görsel galeri',
      exportData: 'Veriyi dışa aktar',
      exportSitemap: 'Site haritasını dışa aktar',
      deleteSitemap: 'Site haritasını sil',
      createNewSitemap: 'Yeni site haritası',
      addSelector: 'Yeni seçici ekle',
      findReplace: 'Bul / Değiştir',
      startSlideshow: 'Slayt gösterisi',
      downloadZip: 'ZIP indir',
      downloadSelected: 'Seçilenleri ZIP',
      columns: 'Sütunlar',
      saveUrl: 'URL kaydet',
      delete: 'Sil',
      lang: 'TR'
    }
  };

  let lang = 'en';
  try {
    const saved = localStorage.getItem('ws_lang');
    if (saved === 'tr' || saved === 'en') lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('tr')) lang = 'tr';
  } catch (e) {}

  function t(key) {
    return (dict[lang] && dict[lang][key]) || (dict.en[key]) || key;
  }

  function setLang(next) {
    lang = next === 'tr' ? 'tr' : 'en';
    try { localStorage.setItem('ws_lang', lang); } catch (e) {}
    apply();
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    const btn = document.getElementById('btn-lang-toggle');
    if (btn) btn.textContent = lang === 'tr' ? 'TR' : 'EN';
  }

  return { t: t, setLang: setLang, apply: apply, getLang: () => lang };
}));
