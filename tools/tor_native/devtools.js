/**
 * DevTools Page Hook (Firefox / Tor Browser).
 * Registers the "Web Scraper" panel tab in the browser Developer Tools.
 *
 * NOTE: the icon/page paths MUST start with "/" (extension-root absolute).
 * Firefox resolves relative paths against the devtools page directory
 * (devtools/), which would turn "devtools/panel.html" into
 * "devtools/devtools/panel.html" and break the panel.
 */
if (typeof browser !== 'undefined' && browser.devtools && browser.devtools.panels) {
  browser.devtools.panels.create(
    'Web Scraper',
    '/icons/icon32.png',
    '/devtools/panel.html'
  ).then(() => {
    // Panel created
  }).catch((e) => {
    console.warn('DevTools panel registration failed:', e && e.message);
  });
}
