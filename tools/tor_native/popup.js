/**
 * Web Scraper Popup Controller (Firefox / Tor Browser).
 * Native WebExtension style: promise-based browser.* + async/await.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    // Render icon
    const logoIcon = document.getElementById('popup-logo-icon');
    if (logoIcon && typeof AppIcons !== 'undefined') {
      logoIcon.innerHTML = AppIcons.get('spider');
    }

    const openDashboard = async (query) => {
      const url = browser.runtime.getURL('dashboard/dashboard.html') + (query || '');
      try {
        await browser.tabs.create({ url });
      } catch (e) { /* window may be closing */ }
      window.close();
    };

    // Open Dashboard Button
    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
      openDashboard();
    });

    // Scrape Current Page Button
    document.getElementById('btn-scrape-current-tab').addEventListener('click', async () => {
      let query = '';
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && tabs[0].url) {
          query = `?newUrl=${encodeURIComponent(tabs[0].url)}`;
        }
      } catch (e) { /* fall through to plain dashboard */ }
      openDashboard(query);
    });

    // Load sitemaps in popup
    const sitemaps = await AppStorage.getAllSitemaps();
    const listContainer = document.getElementById('popup-sitemap-list');
    listContainer.innerHTML = '';

    if (sitemaps.length === 0) {
      listContainer.innerHTML = '<div style="color:#64748b; font-size:11px; text-align:center; padding:8px;">No sitemaps created yet.</div>';
      return;
    }

    sitemaps.slice(0, 5).forEach(s => {
      const item = document.createElement('div');
      item.className = 'popup-sitemap-item';
      item.innerHTML = `
        <div class="popup-sitemap-name">${escapeHtml(s.name || s._id)}</div>
        <div style="display:flex; gap:4px;">
          <button class="btn-scrape-sitemap" style="background:#0d9488; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Scrape</button>
          <button class="btn-data-sitemap" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; padding:3px 6px; border-radius:4px; font-size:11px; cursor:pointer;">Data</button>
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
