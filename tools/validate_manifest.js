#!/usr/bin/env node
/**
 * P4.13 — manifest.json schema validator (runs inside the build).
 *
 * Pure JSON + field WHITELIST validation for MV3 extension manifests
 * (chrome-edge and tor). No network, no external deps.
 *
 *   node tools/validate_manifest.js chrome-edge/manifest.json tor/manifest.json
 *
 * Exits 1 with a list of problems on failure; 0 and a one-line OK on success.
 * Also exports validateManifest(obj) for the test suite.
 */
'use strict';

const fs = require('node:fs');

const ALLOWED_PERMISSIONS = new Set([
  'activeTab', 'alarms', 'bookmarks', 'browsingData', 'clipboardRead',
  'clipboardWrite', 'contextMenus', 'cookies', 'desktopCapture', 'downloads',
  'enterprise.deviceLimit', 'extensions', 'geolocation', 'history', 'identity',
  'management', 'notifications', 'offscreen', 'pointerLock', 'privacy',
  'proxy', 'scripting', 'sessions', 'sidePanel', 'storage', 'tabs',
  'theme', 'topSites', 'typedarrays', 'unlimitedStorage', 'webNavigation'
]);

const ALLOWED_TOP_LEVEL = new Set([
  'manifest_version', 'name', 'description', 'version', 'default_locale',
  'icons', 'action', 'background', 'permissions', 'host_permissions',
  'content_scripts', 'web_accessible_resources', 'devtools_page',
  'options_page', 'options_ui', 'browser_specific_settings'
]);

const ALLOWED_RUN_AT = new Set(['document_start', 'document_end', 'document_idle', 'document_interactive']);

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isStrArr = (v) => Array.isArray(v) && v.length > 0 && v.every(isStr);

/**
 * Validates a parsed MV3 manifest object. Returns an array of problem
 * strings (empty = valid).
 */
function validateManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest is not an object'];
  }

  // Field whitelist at the top level.
  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) problems.push(`unknown top-level field: "${key}"`);
  }

  if (manifest.manifest_version !== 3) problems.push('manifest_version must be 3');
  if (!isStr(manifest.name)) problems.push('name must be a non-empty string (or __MSG_...__ placeholder)');
  if (!isStr(manifest.description)) problems.push('description must be a non-empty string');
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
    problems.push('version must be a semver-like "x.y" or "x.y.z" string');
  }
  if (manifest.default_locale !== undefined && (typeof manifest.default_locale !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(manifest.default_locale))) {
    problems.push('default_locale must be a BCP-47 language tag');
  }

  // icons: { "16": "icons/...", ... }
  if (manifest.icons !== undefined) {
    if (typeof manifest.icons !== 'object' || Array.isArray(manifest.icons) || Object.keys(manifest.icons).length === 0) {
      problems.push('icons must be a non-empty object of size->path');
    } else {
      for (const [size, p] of Object.entries(manifest.icons)) {
        if (!/^\d+$/.test(size) || !isStr(p)) problems.push(`icons.${size} must map to a path string`);
      }
    }
  }

  // action
  if (manifest.action !== undefined) {
    const a = manifest.action;
    if (typeof a !== 'object' || Array.isArray(a)) problems.push('action must be an object');
    else {
      for (const k of Object.keys(a)) {
        if (!['default_title', 'default_popup', 'default_icon'].includes(k)) {
          problems.push(`action has unknown field "${k}"`);
        }
      }
      if (a.default_popup !== undefined && !isStr(a.default_popup)) problems.push('action.default_popup must be a path string');
    }
  }

  // background: exactly one of service_worker | scripts
  if (manifest.background !== undefined) {
    const b = manifest.background;
    if (typeof b !== 'object' || Array.isArray(b)) problems.push('background must be an object');
    else {
      const hasSw = 'service_worker' in b;
      const hasScripts = 'scripts' in b;
      if (!hasSw && !hasScripts) problems.push('background needs service_worker or scripts');
      if (hasSw && hasScripts) problems.push('background must have service_worker OR scripts, not both');
      if (hasSw && !isStr(b.service_worker)) problems.push('background.service_worker must be a path string');
      if (hasScripts && !isStrArr(b.scripts)) problems.push('background.scripts must be a non-empty array of paths');
    }
  }

  // permissions whitelist
  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions) || !manifest.permissions.every(isStr)) {
      problems.push('permissions must be an array of strings');
    } else {
      for (const p of manifest.permissions) {
        if (!ALLOWED_PERMISSIONS.has(p)) problems.push(`unknown permission: "${p}"`);
      }
    }
  }

  // host_permissions: array of match-pattern strings (format left to the browser)
  if (manifest.host_permissions !== undefined && !isStrArr(manifest.host_permissions)) {
    problems.push('host_permissions must be a non-empty array of match patterns');
  }

  // content_scripts
  if (manifest.content_scripts !== undefined) {
    if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
      problems.push('content_scripts must be a non-empty array');
    } else {
      manifest.content_scripts.forEach((cs, i) => {
        if (!cs || typeof cs !== 'object') { problems.push(`content_scripts[${i}] must be an object`); return; }
        if (!isStrArr(cs.matches)) problems.push(`content_scripts[${i}].matches must be a non-empty array of patterns`);
        if (!isStrArr(cs.js)) problems.push(`content_scripts[${i}].js must be a non-empty array of paths`);
        if (cs.css !== undefined && (!Array.isArray(cs.css) || !cs.css.every(isStr))) problems.push(`content_scripts[${i}].css must be an array of paths`);
        if (cs.run_at !== undefined && !ALLOWED_RUN_AT.has(cs.run_at)) problems.push(`content_scripts[${i}].run_at must be one of ${[...ALLOWED_RUN_AT].join(', ')}`);
      });
    }
  }

  // web_accessible_resources (MV3 shape: [{resources, matches}])
  if (manifest.web_accessible_resources !== undefined) {
    if (!Array.isArray(manifest.web_accessible_resources)) problems.push('web_accessible_resources must be an array');
    else {
      manifest.web_accessible_resources.forEach((w, i) => {
        if (!w || typeof w !== 'object') { problems.push(`web_accessible_resources[${i}] must be an object`); return; }
        if (!isStrArr(w.resources)) problems.push(`web_accessible_resources[${i}].resources must be a non-empty array`);
        if (w.matches !== undefined && !isStrArr(w.matches)) problems.push(`web_accessible_resources[${i}].matches must be a non-empty array`);
      });
    }
  }

  if (manifest.devtools_page !== undefined && !isStr(manifest.devtools_page)) problems.push('devtools_page must be a path string');
  if (manifest.options_page !== undefined && !isStr(manifest.options_page)) problems.push('options_page must be a path string');

  if (manifest.options_ui !== undefined) {
    const o = manifest.options_ui;
    if (!o || typeof o !== 'object' || !isStr(o.page)) problems.push('options_ui.page must be a path string');
    if (o && typeof o === 'object' && o.open_in_tab !== undefined && typeof o.open_in_tab !== 'boolean') problems.push('options_ui.open_in_tab must be a boolean');
  }

  // browser_specific_settings (gecko for the tor build) — shallow check
  if (manifest.browser_specific_settings !== undefined) {
    const b = manifest.browser_specific_settings;
    if (!b || typeof b !== 'object' || Array.isArray(b)) problems.push('browser_specific_settings must be an object');
    else if (b.gecko && typeof b.gecko === 'object' && !isStr(b.gecko.id)) problems.push('browser_specific_settings.gecko.id must be a string');
  }

  return problems;
}

/** Validates a manifest file on disk. Returns the problem list. */
function validateManifestFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return [`cannot read ${file}: ${e.message}`];
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return [`${file} is not valid JSON: ${e.message}`];
  }
  return validateManifest(json);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: node tools/validate_manifest.js <manifest.json> [more.json ...]');
    process.exit(2);
  }
  let failed = false;
  for (const file of args) {
    const problems = validateManifestFile(file);
    if (problems.length) {
      failed = true;
      console.error(`FAIL ${file}`);
      problems.forEach((p) => console.error('  - ' + p));
    } else {
      console.log(`ok   ${file}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();

module.exports = { validateManifest, validateManifestFile };
