/*! AI Crawler Audit | Copyright (c) 2026 Jayden Yoon ZK | MIT License | https://github.com/JaydenYoonZK/ai-crawler-audit */
/**
 * ai-crawler-audit engine
 *
 * A robots.txt parser and matcher following RFC 9309 where it matters:
 * group formation, longest-path-match precedence, allow winning ties,
 * and * and $ wildcards. Pure functions; runs in browsers, Node, and
 * the bundled CLI unchanged.
 */

export const MAX_ROBOTS_BYTES = 500 * 1024;

const UTF8 = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

function limitRobotsText(text) {
  const bytes = UTF8.encode(String(text).replace(/^\uFEFF/, ""));
  return {
    text: UTF8_DECODER.decode(bytes.subarray(0, MAX_ROBOTS_BYTES)),
    truncated: bytes.length > MAX_ROBOTS_BYTES
  };
}

/** Parse robots.txt into rule groups plus sitemap lines. */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  const limited = limitRobotsText(text);

  for (let raw of limited.text.split(/\r\n?|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!value) {
        current = null;
        lastWasAgent = false;
        continue;
      }
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;

    if (key === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ type: key, path: value });
    }
    // crawl-delay and unknown keys are ignored for matching purposes
  }
  return { groups, sitemaps, truncated: limited.truncated };
}

function normalizeOctets(value, keepWildcards = false) {
  let out = "";
  const input = String(value);
  for (let i = 0; i < input.length;) {
    const ch = input[i];
    if (ch === "%" && /^[0-9a-f]{2}$/i.test(input.slice(i + 1, i + 3))) {
      const byte = Number.parseInt(input.slice(i + 1, i + 3), 16);
      const decoded = String.fromCharCode(byte);
      out += /[A-Za-z0-9._~-]/.test(decoded)
        ? decoded
        : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      i += 3;
      continue;
    }
    const codePoint = input.codePointAt(i);
    const point = String.fromCodePoint(codePoint);
    if (keepWildcards && (point === "*" || point === "$")) out += point;
    else if (codePoint <= 0x7f) out += point;
    else out += [...UTF8.encode(point)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
    i += point.length;
  }
  return out;
}

function patternSpecificity(pattern) {
  const normalized = normalizeOctets(pattern, true).replace(/\*/g, "").replace(/\$$/, "");
  let octets = 0;
  for (let i = 0; i < normalized.length;) {
    if (normalized[i] === "%" && /^[0-9A-F]{2}$/.test(normalized.slice(i + 1, i + 3))) i += 3;
    else i++;
    octets++;
  }
  return octets;
}

/** Convert a robots path pattern (* and $) into a linear-time matcher. */
export function pathMatcher(pattern) {
  if (pattern === "") return () => false; // empty Disallow matches nothing
  const normalized = normalizeOctets(pattern, true);
  const anchored = normalized.endsWith("$");
  const glob = anchored ? normalized.slice(0, -1) : normalized;

  return (path) => {
    const input = normalizeOctets(path);
    let i = 0;
    let j = 0;
    let star = -1;
    let retry = 0;

    while (i < input.length) {
      if (j === glob.length) return !anchored;
      if (glob[j] === "*") {
        star = j++;
        retry = i;
        continue;
      }
      if (glob[j] === input[i]) {
        i++;
        j++;
        continue;
      }
      if (star !== -1) {
        j = star + 1;
        i = ++retry;
        continue;
      }
      return false;
    }
    while (glob[j] === "*") j++;
    return j === glob.length;
  };
}

/**
 * Select the rules that apply to a user-agent token.
 * Exact token match wins over the '*' group, and a specific match means the
 * '*' group does not also apply. Matching is case-insensitive, as tokens in
 * the wild are mixed-case.
 *
 * Rules from EVERY group naming the token are combined, per RFC 9309 and the
 * behavior of Google's crawlers: a robots.txt that splits a crawler's rules
 * across two blocks (or repeats "User-agent: *") is treated as one group.
 * Without this, a rule in the second block is silently ignored, and the tool
 * would call a path allowed that a compliant crawler treats as blocked.
 */
export function groupFor(groups, token) {
  const t = token.toLowerCase();
  const exact = groups.filter(g => g.agents.includes(t));
  if (exact.length) {
    return { group: { agents: [t], rules: exact.flatMap(g => g.rules) }, matched: "exact" };
  }
  const star = groups.filter(g => g.agents.includes("*"));
  if (star.length) {
    return { group: { agents: ["*"], rules: star.flatMap(g => g.rules) }, matched: "wildcard" };
  }
  return null;
}

/**
 * RFC 9309 decision for one path: longest pattern wins, allow wins ties,
 * no matching rule means allowed.
 */
export function isAllowed(group, path) {
  let best = null;
  for (const rule of group.rules) {
    if (!pathMatcher(rule.path)(path)) continue;
    const specificity = patternSpecificity(rule.path);
    if (
      !best ||
      specificity > best.specificity ||
      (specificity === best.specificity && rule.type === "allow" && best.type === "disallow")
    ) {
      best = { ...rule, specificity };
    }
  }
  return !best || best.type === "allow";
}

/**
 * Audit one crawler token against a parsed robots.txt.
 * status: allowed | blocked | partial | default
 */
export function auditToken(parsed, token) {
  const found = groupFor(parsed.groups, token);
  if (!found) {
    return { token, status: "default", via: "no rules", detail: "No robots.txt group applies, so access is allowed by default." };
  }
  const { group, matched } = found;
  const root = isAllowed(group, "/");
  const allowPatterns = new Set(group.rules
    .filter(rule => rule.type === "allow")
    .map(rule => normalizeOctets(rule.path, true)));
  const effectiveDisallows = group.rules.filter(rule =>
    rule.type === "disallow" && rule.path !== "" && !allowPatterns.has(normalizeOctets(rule.path, true))
  );
  const via = matched === "exact" ? `a "${token}" group` : 'the "*" group';

  if (!root) {
    return { token, status: "blocked", via, detail: `Blocked site-wide by ${via}.` };
  }
  if (effectiveDisallows.length) {
    const paths = effectiveDisallows.map(r => r.path);
    return { token, status: "partial", via, detail: `Allowed at "/" by ${via}, but blocked from: ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? ", and more" : ""}.` };
  }
  return { token, status: "allowed", via, detail: `Allowed by ${via}.` };
}

/** Audit every crawler in the dataset. */
export function auditAll(robotsText, crawlers) {
  const parsed = parseRobots(robotsText);
  return {
    sitemaps: parsed.sitemaps,
    groupCount: parsed.groups.length,
    truncated: parsed.truncated,
    results: crawlers.map(c => ({ ...c, ...auditToken(parsed, c.token) }))
  };
}

/**
 * Generate robots.txt lines for a chosen policy.
 * mode: "block-training" | "block-all-ai" | "allow-all"
 */
export function generatePolicy(crawlers, mode) {
  if (!["block-training", "block-all-ai", "allow-all"].includes(mode)) {
    throw new TypeError(`Unknown policy mode: ${mode}`);
  }
  if (mode === "allow-all") {
    return [
      "# AI crawlers: explicitly allowed.",
      "# No rules needed; absence of a Disallow means allowed.",
      "# Listing them anyway documents the decision:",
      ...crawlers.map(c => `User-agent: ${c.token}\nAllow: /`)
    ].join("\n\n");
  }
  const targets = mode === "block-training"
    ? crawlers.filter(c => c.purpose === "training" || c.purpose === "control")
    : crawlers;
  const lines = targets.map(c => `User-agent: ${c.token}`);
  return [
    mode === "block-training"
      ? "# Block AI training and data collection, keep AI search and live user fetches."
      : "# Block every known AI crawler, including search and user fetches.",
    ...lines,
    "Disallow: /"
  ].join("\n");
}

/** Light structural check of an llms.txt file. */
export function checkLlmsTxt(text) {
  const findings = [];
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  const firstContent = lines.find(l => l.trim());
  if (firstContent && /^# \S/.test(firstContent)) {
    findings.push({ ok: true, msg: `Has the required project name heading: "${firstContent.slice(2, 80)}"` });
  } else {
    findings.push({ ok: false, msg: "The first non-empty line must be the required H1 (\"# Project name\")." });
  }

  if (lines.some(l => /^> \S/.test(l))) findings.push({ ok: true, msg: "Has a summary blockquote." });
  else findings.push({ ok: true, msg: "No optional summary blockquote." });

  const sections = lines.filter(l => /^## \S/.test(l)).length;
  const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  findings.push(sections
    ? { ok: true, msg: `${sections} section${sections === 1 ? "" : "s"} and ${links} link${links === 1 ? "" : "s"}.` }
    : { ok: true, msg: "No optional H2 file-list sections." });
  return findings;
}
