/**
 * Web Scraper Background Event Page (Firefox / Tor Browser).
 *
 * Native WebExtension style: the promise-based browser.* namespace instead
 * of callback-style chrome.*. Dependencies such as src/storage/Storage.js
 * are loaded through manifest.json "background.scripts" (Firefox runs the
 * background as an event page, not a service worker).
 */

browser.runtime.onInstalled.addListener((details) => {
  console.log('Web Scraper extension installed/updated:', details.reason);

  // menus/contextMenus.create is the one WebExtension API that still reports
  // duplicate-id errors through the optional callback + runtime.lastError.
  browser.contextMenus.create({
    id: 'ws_scrape_page',
    title: 'Scrape this page with Web Scraper',
    contexts: ['page', 'link', 'selection']
  }, () => {
    if (browser.runtime.lastError) { /* consume duplicate menu item errors */ }
  });
});

// Handle Context Menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ws_scrape_page') {
    const targetUrl = info.linkUrl || info.pageUrl || (tab ? tab.url : '');
    const dashboardUrl = browser.runtime.getURL(`dashboard/dashboard.html?newUrl=${encodeURIComponent(targetUrl)}`);
    browser.tabs.create({ url: dashboardUrl }).catch(() => { /* window may be closing */ });
  }
});

// Message router. Returning a Promise from the listener is the native
// Firefox way to deliver an asynchronous response.
browser.runtime.onMessage.addListener((request) => {
  if (!request || typeof request.type !== 'string') return;

  if (request.type === 'OPEN_DASHBOARD') {
    browser.tabs.create({ url: browser.runtime.getURL('dashboard/dashboard.html') })
      .catch(() => { /* tab creation can fail while the window is closing */ });
    return Promise.resolve({ success: true });
  }

  // Forward picker results from content scripts to devtools/dashboard views.
  // Mark forwarded copies so views that already received the original
  // broadcast do not process the same result twice.
  if ((request.type === 'PICKER_RESULT' || request.type === 'PICKER_CANCELLED') && !request._forwarded) {
    browser.runtime.sendMessage(Object.assign({}, request, { _forwarded: true }))
      .catch(() => { /* no open views to receive the forward */ });
  }
});
