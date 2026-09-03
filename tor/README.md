# Web Scraper — Tor Browser Build

This folder contains the **Tor Browser (Firefox ESR) compatible** build of the
extension. It is **auto-generated** from the Chrome/Edge source tree at the
repository root by `tools/build_tor.js` — do not edit files here directly.
Make changes in the root tree, then run:

```bash
npm run build:tor
```

## Differences from the Chrome build

| Area | Chrome/Edge (root) | Tor/Firefox (this folder) |
|------|--------------------|---------------------------|
| Background | `service_worker` | `background.scripts` event page (Storage.js + background.js) |
| Options | `options_page` | `options_ui` (open in tab) |
| Add-on identity | — | `browser_specific_settings.gecko` id |
| Everything else | identical | identical |

## Installing in Tor Browser

### Temporary (for testing — removed when the browser closes)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `tor/manifest.json`.

### Permanent
Firefox normally requires signed add-ons. In Tor Browser (ESR based) you can
allow unsigned installs:
1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Zip the **contents** of this folder (manifest.json at the zip root), rename
   the file to `web-scraper.xpi`.
3. Open `about:addons` → gear icon → **Install Add-on From File…** and pick
   the `.xpi`.

### Host permissions
Firefox MV3 does **not** grant `<all_urls>` automatically. After installing,
open the add-on's **Permissions** tab in `about:addons` and enable
*"Access your data for all websites"*, otherwise the picker and the scraper
cannot reach pages.

## Privacy warning

The Tor Project recommends **against** installing extra extensions: every
add-on makes your browser fingerprint more unique, and automated background
tab crawling is clearly distinguishable from normal Tor traffic. Expect slow
crawls, exit-node CAPTCHAs and site blocks. Use this build only if you accept
those trade-offs.
