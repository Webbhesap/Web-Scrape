/**
 * Chrome DevTools Page Hook.
 * Registers the "Web Scraper" panel tab in Chrome Developer Tools.
 */
if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.panels) {
  chrome.devtools.panels.create(
    'Web Scraper',
    'icons/icon32.png',
    'devtools/panel.html',
    function (panel) {
      // Panel created
    }
  );
}
