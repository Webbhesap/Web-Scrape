/**
 * Web Scraper Popup Controller.
 *
 * All three actions (open app / scrape current page / sitemap shortcuts)
 * funnel through one openDashboard() helper — previously every button
 * duplicated its own chrome.tabs + lastError handling and the sitemap
 * buttons missed the fallback path entirely.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    // Render icon + localize static markup
    const logoIcon = document.getElementById('popup-logo-icon');
    if (logoIcon && typeof AppIcons !== 'undefined') {
      logoIcon.innerHTML = AppIcons.get('spider');
    }
    if (typeof AppI18n !== 'undefined') AppI18n.apply();

    const t = (key) => (typeof AppI18n !== 'undefined' ? AppI18n.t(key) : key);

    const isExtension = () => typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create;

    /** Open the dashboard (optionally with a query string) in a new tab. */
    function openDashboard(query) {
      if (isExtension()) {
        chrome.tabs.create(
          { url: chrome.runtime.getURL('dashboard/dashboard.html' + (query || '')) },
          () => { if (chrome.runtime.lastError) { /* consume */ } }
        );
      } else {
        window.open('../dashboard/dashboard.html' + (query || ''), '_blank');
      }
    }

    // Open Dashboard Button
    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
      openDashboard('');
    });

    // Scrape Current Page Button — pre-fills the create-sitemap URL field
    document.getElementById('btn-scrape-current-tab').addEventListener('click', () => {
      if (isExtension() && chrome.tabs.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!chrome.runtime.lastError && tabs && tabs.length > 0 && tabs[0].url && /^https?:/i.test(tabs[0].url)) {
            openDashboard(`?newUrl=${encodeURIComponent(tabs[0].url)}`);
          } else {
            openDashboard('');
          }
        });
      } else {
        openDashboard('');
      }
    });

    // Load sitemaps in popup. A storage failure must not kill the whole
    // popup with an unhandled rejection — degrade to the empty state instead.
    let sitemaps = [];
    try {
      sitemaps = (await AppStorage.getAllSitemaps()) || [];
    } catch (e) {
      console.warn('Popup: failed to load sitemaps:', e);
    }
    const listContainer = document.getElementById('popup-sitemap-list');
    listContainer.innerHTML = '';

    if (sitemaps.length === 0) {
      listContainer.innerHTML = `<div style="color:#64748b; font-size:11px; text-align:center; padding:8px;">${t('popupNoSitemaps')}</div>`;
      return;
    }

    sitemaps.slice(0, 5).forEach(s => {
      const item = document.createElement('div');
      item.className = 'popup-sitemap-item';
      item.innerHTML = `
        <div class="popup-sitemap-name">${escapeHtml(s.name || s._id)}</div>
        <div style="display:flex; gap:4px;">
          <button class="btn-scrape-sitemap" style="background:#0d9488; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer;">${t('scrape')}</button>
          <button class="btn-data-sitemap" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; padding:3px 6px; border-radius:4px; font-size:11px; cursor:pointer;">${t('data')}</button>
        </div>
      `;

      item.querySelector('.btn-scrape-sitemap').addEventListener('click', () => {
        openDashboard(`?sitemap=${encodeURIComponent(s._id)}&view=scrape`);
      });

      item.querySelector('.btn-data-sitemap').addEventListener('click', () => {
        openDashboard(`?sitemap=${encodeURIComponent(s._id)}&view=browse-data`);
      });

      listContainer.appendChild(item);
    });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
