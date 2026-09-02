/**
 * Theme consistency tests.
 *
 * The UI is a dark theme, but several widgets are painted by the browser
 * itself (number spinners, <select> popup lists, scrollbars, checkboxes).
 * Those default to a white/light appearance unless the page opts into the
 * dark UA color scheme and colors the controls explicitly. These tests lock
 * that styling in and guard against light-colored hardcoded values creeping
 * back into the stylesheets.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const dashboardCss = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.css'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.html'), 'utf8');
const panelHtml = fs.readFileSync(path.join(ROOT, 'devtools', 'panel.html'), 'utf8');
const popupCss = fs.readFileSync(path.join(ROOT, 'popup', 'popup.css'), 'utf8');

/** Extracts the body of the first CSS rule whose selector list matches. */
function ruleBody(css, selectorFragment) {
  const rules = css.split('}');
  for (const rule of rules) {
    const idx = rule.indexOf('{');
    if (idx === -1) continue;
    const selector = rule.slice(0, idx);
    if (selector.includes(selectorFragment)) return rule.slice(idx + 1);
  }
  return null;
}

test('Theme - root opts into the dark UA color scheme', () => {
  const root = ruleBody(dashboardCss, ':root');
  assert.ok(root, ':root rule exists');
  assert.match(root, /color-scheme:\s*dark/, 'color-scheme: dark makes native widgets render dark');
  assert.match(root, /accent-color:/, 'accent-color tints native checkboxes/sliders with the brand color');

  // The popup shares the palette and must opt in as well.
  const popupRoot = ruleBody(popupCss, ':root');
  assert.match(popupRoot, /color-scheme:\s*dark/, 'popup also opts into the dark scheme');
});

test('Theme - select dropdown option list is themed (not white)', () => {
  assert.match(dashboardCss, /select\s+option/, 'option elements are styled');

  const optionRule = ruleBody(dashboardCss, 'select option,');
  assert.ok(optionRule, 'a rule targeting select option exists');
  assert.match(optionRule, /background-color:\s*var\(--bg-card\)/, 'option list uses the themed card background');
  assert.match(optionRule, /color:\s*var\(--text-main\)/, 'option text uses the themed foreground');

  const checkedRule = ruleBody(dashboardCss, 'select option:checked');
  assert.ok(checkedRule, 'selected/hovered options are themed');
  assert.match(checkedRule, /background-color:\s*var\(--bg-hover\)/, 'hover/checked option uses the hover surface');

  // The <select> box itself must be dark with a custom chevron.
  const selectRule = ruleBody(dashboardCss, 'select.form-control');
  assert.match(selectRule, /background-color:\s*var\(--bg-input\)/, 'closed select is dark');
  assert.match(selectRule, /appearance:\s*none/, 'default OS arrow is replaced');
});

test('Theme - number input spinner arrows are themed (not white)', () => {
  const spinRule = ruleBody(dashboardCss, '::-webkit-inner-spin-button');
  assert.ok(spinRule, 'the number spinner is restyled');
  assert.match(spinRule, /background-color:\s*var\(--bg-hover\)/, 'spinner uses a themed surface, not white');
  assert.match(spinRule, /opacity:\s*1/, 'spinner is always visible instead of only on hover');
  assert.match(spinRule, /svg/, 'spinner arrows are drawn with an inline themed SVG');
  // %2394a3b8 is --text-muted url-encoded inside the inline SVG.
  assert.match(spinRule, /%2394a3b8/, 'arrow glyphs use the muted theme color');

  const hoverRule = ruleBody(dashboardCss, 'input[type="number"]:hover::-webkit-outer-spin-button');
  assert.ok(hoverRule, 'spinner has a hover state');
  assert.match(hoverRule, /%232dd4bf/, 'hovered arrows pick up the teal accent');
});

test('Theme - range slider and checkboxes follow the palette', () => {
  const thumb = ruleBody(dashboardCss, '::-webkit-slider-thumb');
  assert.ok(thumb, 'range slider thumb is styled');
  assert.match(thumb, /background:\s*var\(--primary\)/, 'slider thumb uses the primary color');

  const checkbox = ruleBody(dashboardCss, 'input[type="checkbox"]');
  assert.ok(checkbox, 'checkboxes are styled');
  assert.match(checkbox, /accent-color:\s*var\(--primary\)/, 'checkbox accent matches the theme');
});

test('Theme - autofill does not repaint inputs white', () => {
  const autofill = ruleBody(dashboardCss, ':-webkit-autofill');
  assert.ok(autofill, 'autofill styling is present');
  assert.match(autofill, /box-shadow:\s*0 0 0 1000px var\(--bg-input\) inset/, 'autofill keeps the dark input background');
});

test('Theme - slideshow chrome uses theme variables instead of raw black', () => {
  const icon = ruleBody(dashboardCss, '.slideshow-icon');
  assert.ok(icon, '.slideshow-icon rule exists');
  assert.match(icon, /var\(--bg-card-alpha\)/, 'slideshow buttons use the themed translucent surface');
  assert.doesNotMatch(icon, /rgba\(0\s*,\s*0\s*,\s*0/, 'no raw black backgrounds');

  const tools = ruleBody(dashboardCss, '.slideshow-tools');
  assert.match(tools, /var\(--bg-card-alpha\)/, 'the toolbar pill uses the themed surface');
  assert.match(tools, /border:\s*1px solid var\(--border-color\)/, 'toolbar has a themed border');

  const durInput = ruleBody(dashboardCss, '.slideshow-dur input,');
  assert.ok(durInput, 'the interval input inside the slideshow is themed');
  assert.match(durInput, /var\(--bg-input-alpha\)/, 'interval input uses a themed background');
  assert.match(durInput, /color:\s*var\(--text-main\)/, 'interval text uses the themed foreground');
  assert.doesNotMatch(durInput, /rgba\(255\s*,\s*255\s*,\s*255/, 'no white-tinted control surfaces');
});

test('Theme - slideshow overlay hides the cursor when idle', () => {
  const idle = ruleBody(dashboardCss, '.slideshow-overlay.idle');
  assert.ok(idle, 'an .idle rule exists on the overlay');
  assert.match(idle, /cursor:\s*none/, 'the mouse cursor is hidden along with the controls');
});

test('Theme - overlay visibility is driven only by the .open class', () => {
  // `:not([hidden])` made the overlay visible whenever the attribute was
  // absent, which is what auto-opened the slideshow in the DevTools panel.
  assert.ok(
    !/\.slideshow-overlay:not\(\[hidden\]\)/.test(dashboardCss),
    'the :not([hidden]) visibility rule must not come back'
  );
  assert.match(dashboardCss, /\.slideshow-overlay\.open\s*\{[^}]*display:\s*block/, '.open controls visibility');
  assert.match(dashboardCss, /\.slideshow-overlay\[hidden\]\s*\{[^}]*display:\s*none/, '[hidden] always wins');
});

test('Theme - no stray light backgrounds in inline HTML styles', () => {
  for (const [name, html] of [['dashboard.html', dashboardHtml], ['panel.html', panelHtml]]) {
    const inline = html.match(/style="[^"]*"/g) || [];
    inline.forEach((decl) => {
      assert.ok(
        !/background\s*:\s*(#fff|#ffffff|white)\b/i.test(decl),
        `${name} inline style should not hardcode a white background: ${decl}`
      );
    });
  }
});

test('Theme - inline SVG data URIs are valid and correctly encoded', () => {
  const { JSDOM } = require('jsdom');
  const uris = [...dashboardCss.matchAll(/url\("(data:image\/svg\+xml[^")]+)"\)/g)].map((m) => m[1]);
  assert.ok(uris.length >= 3, 'select chevron and number spinner arrows are inline SVGs');

  uris.forEach((uri, i) => {
    // A literal '#' would terminate the URI early; it must be percent-encoded.
    const payload = uri.replace(/^data:image\/svg\+xml;charset=utf-8,/, '');
    assert.ok(!payload.includes('#'), `data URI #${i} must percent-encode '#' as %23`);

    const svg = decodeURIComponent(payload);
    const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
    assert.equal(
      dom.window.document.querySelectorAll('parsererror').length, 0,
      `data URI #${i} must be well-formed SVG`
    );
    const stroke = dom.window.document.querySelector('svg').getAttribute('stroke');
    assert.match(stroke, /^#[0-9a-f]{6}$/i, `data URI #${i} strokes with an explicit theme color`);
    assert.ok(
      ['#94a3b8', '#2dd4bf'].includes(stroke.toLowerCase()),
      `data URI #${i} uses a palette color (muted or teal accent), got ${stroke}`
    );
    dom.window.close();
  });
});

test('Theme - background shorthand never wipes the select chevron', () => {
  // `background: <color>` resets background-image. Rules that recolor a
  // select must use background-color so the chevron survives.
  const risky = [];
  dashboardCss.split('}').forEach((rule) => {
    const idx = rule.indexOf('{');
    if (idx === -1) return;
    const selector = rule.slice(0, idx);
    const body = rule.slice(idx + 1);
    // Match the <select> element only, not class names containing 'select'
    // such as .selector-row / .gallery-select.
    if (!/(^|[\s,>+~])select\b/.test(selector)) return;
    if (/(^|[;\s])background:\s*[^;]*;?/.test(body) && !/background-image/.test(body)) {
      risky.push(selector.trim());
    }
  });
  assert.deepEqual(risky, [], 'select rules must use background-color, not the background shorthand');
});

test('Theme - number spinners are not removed by appearance:textfield', () => {
  // appearance:textfield removes the spin buttons in Chrome entirely; the
  // requirement is themed arrows, not missing arrows.
  // Strip comments first so an explanatory note does not trip the check.
  const withoutComments = dashboardCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    !/appearance:\s*textfield/.test(withoutComments),
    'appearance:textfield must not be applied to number inputs'
  );
  assert.match(dashboardCss, /input\[type="number"\]\s*\{[^}]*color-scheme:\s*dark/, 'number inputs opt into the dark scheme');
});

test('Theme - dark scrollbars are defined', () => {
  assert.match(dashboardCss, /::-webkit-scrollbar-thumb/, 'scrollbar thumb is styled');
  const track = ruleBody(dashboardCss, '::-webkit-scrollbar-track');
  assert.match(track, /var\(--bg-main\)/, 'scrollbar track matches the app background');
});
