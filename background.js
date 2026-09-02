/**
 * Web Scraper Background Service Worker (Manifest V3).
 */

importScripts(
  'src/storage/Storage.js'
);

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Web Scraper extension installed/updated:', details.reason);

  // Context menu item
  chrome.contextMenus.create({
    id: 'ws_scrape_page',
    title: 'Scrape this page with Web Scraper',
    contexts: ['page', 'link', 'selection']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ws_scrape_page') {
    const targetUrl = info.linkUrl || info.pageUrl || (tab ? tab.url : '');
    const dashboardUrl = chrome.runtime.getURL(`dashboard/dashboard.html?newUrl=${encodeURIComponent(targetUrl)}`);
    chrome.tabs.create({ url: dashboardUrl });
  }
});

// Message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OPEN_DASHBOARD') {
    const url = chrome.runtime.getURL('dashboard/dashboard.html');
    chrome.tabs.create({ url: url });
    sendResponse({ success: true });
    return true;
  }

  // Forward picker results to active devtools / dashboard views
  if (request.type === 'PICKER_RESULT' || request.type === 'PICKER_CANCELLED') {
    chrome.runtime.sendMessage(request).catch(() => {});
  }
});
