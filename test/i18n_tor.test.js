/**
 * i18n regression tests:
 *  - the picker recovery messages (pickerReloadToEnable / pickerReloadTimeout)
 *    exist in BOTH languages of BOTH builds (missing TR wording would have
 *    fallen back to raw keys in the Turkish UI),
 *  - the Tor build never keeps Chrome-specific wording (audit fix B16).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadI18n(base) {
  delete require.cache[require.resolve(base)];
  return require(base);
}

const KEYS = ['pickerReloadToEnable', 'pickerReloadTimeout', 'pickerNoReceiver', 'hostPermNeeded'];

for (const build of ['chrome-edge', 'tor']) {
  test(`i18n (${build}) - picker recovery keys resolve in EN and TR`, () => {
    const i18n = loadI18n(path.join(__dirname, '..', build, 'lib', 'i18n.js'));

    for (const key of KEYS) {
      const en = i18n.dict.en[key];
      assert.ok(typeof en === 'string' && en.length > 15,
        `EN ${build}: ${key} must be a real sentence, got: ${JSON.stringify(en)}`);
      const tr = i18n.dict.tr[key];
      assert.ok(typeof tr === 'string' && tr.length > 15,
        `TR ${build}: ${key} must be a real sentence, got: ${JSON.stringify(tr)}`);
      assert.notEqual(en, tr, `${build}: ${key} — EN and TR strings differ`);
    }
  });
}

test('i18n (tor) - no Chrome-specific wording survives the build', () => {
  const i18n = loadI18n(path.join(__dirname, '..', 'tor', 'lib', 'i18n.js'));
  const en = i18n.dict.en;

  assert.ok(!/in Chrome/i.test(en.noActiveTab), `noActiveTab must not mention Chrome: ${en.noActiveTab}`);
  assert.ok(/Tor Browser/i.test(en.noActiveTab), 'noActiveTab points at Tor Browser');
  assert.ok(!/Chrome/i.test(en.previewHint), `previewHint must not mention Chrome: ${en.previewHint}`);
  assert.ok(!/chrome:/.test(en.systemPage), 'systemPage hint uses about:, not chrome:');

  // The Turkish dict is untouched by the transform — it never named Chrome
  // for these keys, but assert it stays clean too.
  assert.ok(!/chrome:\/\//i.test(i18n.dict.tr.systemPage), 'TR systemPage unchanged');
});
