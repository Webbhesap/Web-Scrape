/**
 * Web Scraper Background Service Worker (Manifest V3).
 *
 * NOTE: this worker deliberately imports nothing. It used to import the
 * storage module without ever using it — and that module instantiates itself
 * on load, which reads the ENTIRE extension store (`storage.local.get(null)`):
 * a full deserialize of every scraped record of every sitemap, on every single
 * service-worker wake (context-menu click, every runtime message, …). The
 * result was thrown away. Sample-sitemap seeding still happens where it is
 * actually needed — when the dashboard loads. The Firefox/Tor event page keeps
 * the storage script in its manifest `background.scripts` (see
 * tools/build_tor.js); that shape is unrelated to this file and is locked by
 * test/tor_build.test.js.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Web Scraper extension installed/updated:', details.reason);

  try {
    chrome.contextMenus.create({
      id: 'ws_scrape_page',
      title: 'Scrape this page with Web Scraper',
      contexts: ['page', 'link', 'selection']
    }, () => {
      if (chrome.runtime.lastError) { /* consume duplicate menu item errors */ }
    });
  } catch (e) {}
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ws_scrape_page') {
    const targetUrl = info.linkUrl || info.pageUrl || (tab ? tab.url : '');
    const dashboardUrl = chrome.runtime.getURL(`dashboard/dashboard.html?newUrl=${encodeURIComponent(targetUrl)}`);
    chrome.tabs.create({ url: dashboardUrl }, () => {
      if (chrome.runtime.lastError) { /* consume */ }
    });
  }
});

// Message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request.type !== 'string') return;

  if (request.type === 'OPEN_DASHBOARD') {
    const url = chrome.runtime.getURL('dashboard/dashboard.html');
    chrome.tabs.create({ url: url }, () => {
      if (chrome.runtime.lastError) { /* consume */ }
    });
    sendResponse({ success: true });
    return; // response sent synchronously; do not keep the channel open
  }

  // Forward picker results from content scripts to devtools/dashboard views.
  // Mark forwarded copies so views that already received the original
  // broadcast do not process the same result twice.
  if ((request.type === 'PICKER_RESULT' || request.type === 'PICKER_CANCELLED') && !request._forwarded) {
    chrome.runtime.sendMessage(Object.assign({}, request, { _forwarded: true }), () => {
      if (chrome.runtime.lastError) { /* consume */ }
    });
  }
});
