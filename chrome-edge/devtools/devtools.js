/**
 * Chrome DevTools Page Hook.
 * Registers the "Web Scraper" panel tab in Chrome Developer Tools.
 *
 * NOTE: the icon/page paths MUST start with "/" (extension-root absolute).
 * Chrome resolves relative paths against the extension root, but Firefox
 * resolves them against the devtools page directory (devtools/), which
 * turned "devtools/panel.html" into "devtools/devtools/panel.html" and
 * broke the panel in Firefox/Tor Browser. Absolute paths work in both.
 */
if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.panels) {
  chrome.devtools.panels.create(
    'Web Scraper',
    '/icons/icon32.png',
    '/devtools/panel.html',
    function (panel) {
      // Panel created
    }
  );
}
