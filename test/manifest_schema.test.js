/**
 * P4.13 — manifest şema doğrulayıcı (build içinde) testleri.
 *
 * tools/validate_manifest.js: JSON + field whitelist MV3 schema validation
 * for the chrome-edge and tor manifests. The real committed manifests must
 * pass; targeted mutations must each produce a specific problem.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateManifest, validateManifestFile } = require('../tools/validate_manifest.js');

const ROOT = path.resolve(__dirname, '..');
const CHROME_MANIFEST = path.join(ROOT, 'chrome-edge', 'manifest.json');
const TOR_MANIFEST = path.join(ROOT, 'tor', 'manifest.json');

const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

test('P4.13 - the committed chrome-edge and tor manifests pass validation', () => {
  assert.deepEqual(validateManifestFile(CHROME_MANIFEST), []);
  assert.deepEqual(validateManifestFile(TOR_MANIFEST), []);
});

test('P4.13 - unknown top-level fields are rejected (whitelist)', () => {
  const m = clone(load(CHROME_MANIFEST));
  m.suspiciousKey = true;
  const problems = validateManifest(m);
  assert.ok(problems.some((p) => p.includes('unknown top-level field') && p.includes('suspiciousKey')));
});

test('P4.13 - version, permissions and structural rules', () => {
  const m = clone(load(CHROME_MANIFEST));

  m.version = '1.0';
  assert.ok(!validateManifest(m).some((p) => p.includes('version')), '"x.y" is a valid semver-lite version');
  m.version = 'not-a-version';
  assert.ok(validateManifest(m).some((p) => p.includes('version')));

  const m2 = clone(load(CHROME_MANIFEST));
  m2.permissions.push('webRequestBlocking');
  assert.ok(validateManifest(m2).some((p) => p.includes('unknown permission')));

  const m3 = clone(load(TOR_MANIFEST));
  delete m3.background.scripts;
  assert.ok(validateManifest(m3).some((p) => p.includes('background needs service_worker or scripts')));

  const m4 = clone(load(CHROME_MANIFEST));
  m4.background.scripts = ['a.js'];
  assert.ok(validateManifest(m4).some((p) => p.includes('not both')));

  const m5 = clone(load(CHROME_MANIFEST));
  m5.content_scripts[0].run_at = 'document_late';
  assert.ok(validateManifest(m5).some((p) => p.includes('run_at')));

  const m6 = clone(load(CHROME_MANIFEST));
  m6.content_scripts[0].js = [];
  assert.ok(validateManifest(m6).some((p) => p.includes('content_scripts[0].js')));
});

test('P4.13 - invalid JSON and non-object manifests produce clear errors', () => {
  const tmp = path.join(ROOT, '.tmp_bad_manifest.json');
  fs.writeFileSync(tmp, '{ not json');
  const problems = validateManifestFile(tmp);
  fs.rmSync(tmp);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes('not valid JSON'));

  assert.ok(validateManifest(null).length > 0);
  assert.ok(validateManifest([]).length > 0);
});
