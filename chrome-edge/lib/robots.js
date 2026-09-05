/**
 * P3.10 — robots.txt local reader (fetch + mini parser).
 *
 * 100% local/offline: parses a robots.txt body with a small, dependency-free
 * parser and decides per-URL allow/disallow. The engine only consults this
 * when the sitemap's optional `respectRobots` key is ON ("saygı modu"); when
 * OFF nothing is fetched or blocked.
 *
 * Rules implemented (subset of RFC 9309, the parts crawlers rely on):
 *  - User-agent groups (multi-line agent blocks supported)
 *  - Allow / Disallow paths with `*` wildcards and `$` end-anchors
 *  - most-specific (longest) matching path wins; equal length → Disallow
 *  - a Disallow: with an empty value allows everything
 *  - comments (#) and blank lines ignored
 *  - unknown lines ignored (Crawl-delay etc. — we do not pace from robots)
 *
 * UMD: window.Robots / module.exports / AMD.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Robots = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Parses a robots.txt body into the rule groups it declares.
   * Returns null for empty/unusable input (nothing to enforce).
   */
  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) return null;

    const lines = text.split(/\r?\n/);
    const groups = [];
    let current = null; // { agents: Set, rules: [{type, path}] }

    const pushRule = (type, rawPath) => {
      if (!current) return; // rules before any User-agent line: ignore
      const path = String(rawPath || '').trim().split('#')[0].trim();
      if (!path) {
        if (type === 'Disallow') current.rules.push({ type: 'allow', path: '' });
        return;
      }
      current.rules.push({ type: type, path: path });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const key = line.slice(0, ci).trim().toLowerCase();
      const value = line.slice(ci + 1);
      if (key === 'user-agent') {
        const agent = value.trim();
        if (!agent) continue;
        // A User-agent line closes the current group only when the new agent
        // is not yet a member of it (multi-agent blocks are one group).
        if (current && !current.agents.has(agent)) {
          current = { agents: new Set([agent]), rules: [] };
          groups.push(current);
        } else if (current) {
          current.agents.add(agent);
        } else {
          current = { agents: new Set([agent]), rules: [] };
          groups.push(current);
        }
      } else if (key === 'allow' || key === 'disallow') {
        pushRule(key === 'allow' ? 'allow' : 'disallow', value);
      }
      // anything else (crawl-delay, host, sitemap) is intentionally ignored
    }

    if (groups.length === 0) return null;
    return { groups: groups };
  }

  /**
   * Picks the rule group that applies to `userAgent`: the group with the
   * longest matching agent token (case-insensitive substring). Falls back to
   * the '*' group; when neither exists there are no applicable rules.
   */
  function rulesForAgent(rules, userAgent) {
    if (!rules || !Array.isArray(rules.groups)) return [];
    const ua = String(userAgent || '*').toLowerCase();

    let best = null;
    let bestLen = -1;
    for (const group of rules.groups) {
      for (const agent of group.agents) {
        const a = String(agent).toLowerCase();
        const hit = (a === '*' ? 0 : ua.indexOf(a) !== -1 ? a.length : -1);
        if (hit > bestLen) { bestLen = hit; best = group; }
      }
    }
    if (best && bestLen > 0) return best.rules;
    // Only an explicit '*' group (or nothing) remains applicable.
    for (const group of rules.groups) {
      if (group.agents.has('*')) return group.rules;
    }
    return [];
  }

  /** Compiles one robots path into a regex (wildcards `*` and anchor `$`). */
  function pathToRegExp(path) {
    let anchored = false;
    if (path.endsWith('$')) {
      anchored = true;
      path = path.slice(0, -1);
    }
    const source = path.replace(/[.+?^{}()[\]|\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + source + (anchored ? '$' : ''));
  }

  /**
   * Decides whether `url` may be crawled under the given rules.
   * Longest matching path wins; a tie goes to Disallow.
   * rules === null → everything allowed.
   */
  function isAllowed(url, rules, userAgent) {
    if (!rules) return true;
    let u;
    try { u = new URL(url); } catch (e) { return true; } // unparseable → don't block
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;

    const path = decodeURIComponent(u.pathname) + (u.search || '');
    const ruleset = rulesForAgent(rules, userAgent);
    if (ruleset.length === 0) return true;

    let best = null; // { length, allowed, regexp }
    for (const rule of ruleset) {
      if (!rule.path) {
        // "Disallow:" with empty value == allow-all marker.
        if (!best || 0 > best.length) best = { length: 0, allowed: true, regexp: null };
        continue;
      }
      let re;
      try { re = pathToRegExp(rule.path); } catch (e) { continue; }
      if (re.test(path)) {
        const len = rule.path.length;
        if (!best || len > best.length) {
          best = { length: len, allowed: rule.type === 'allow', regexp: re };
        }
      }
    }
    if (!best) return true;
    if (best.regexp === null) return true;
    // Tie-break rule: when the longest allow and longest disallow match at
    // the SAME length, Disallow wins (RFC 9309 §2.2.3).
    let longestLen = -1;
    let disallowAtLongest = false;
    for (const rule of ruleset) {
      if (!rule.path) continue;
      let re;
      try { re = pathToRegExp(rule.path); } catch (e) { continue; }
      if (re.test(path)) {
        const len = rule.path.length;
        if (len > longestLen) {
          longestLen = len;
          disallowAtLongest = rule.type === 'disallow';
        } else if (len === longestLen && rule.type === 'disallow') {
          disallowAtLongest = true;
        }
      }
    }
    return !disallowAtLongest;
  }

  /**
   * Fetches and parses `<origin>/robots.txt`.
   * Any failure (network error, non-2xx, missing fetch) resolves to null —
   * "no rules", so a robots fetch problem never blocks a crawl.
   */
  async function fetchRules(origin, fetchImpl) {
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) return null;
    try {
      const resp = await f(String(origin).replace(/\/$/, '') + '/robots.txt');
      if (!resp || !resp.ok) return null;
      const text = await resp.text();
      return parse(text);
    } catch (e) {
      return null;
    }
  }

  return { parse: parse, rulesForAgent: rulesForAgent, pathToRegExp: pathToRegExp, isAllowed: isAllowed, fetchRules: fetchRules };
}));
