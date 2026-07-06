/**
 * ai-crawler-audit engine
 *
 * A robots.txt parser and matcher following RFC 9309 where it matters:
 * group formation, longest-path-match precedence, allow winning ties,
 * and * and $ wildcards. Pure functions; runs in browsers, Node, and
 * the bundled CLI unchanged.
 */

/** Parse robots.txt into rule groups plus sitemap lines. */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;

  for (let raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
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
  return { groups, sitemaps };
}

/** Convert a robots path pattern (* and $) into a matcher. */
export function pathMatcher(pattern) {
  if (pattern === "") return () => false; // empty Disallow matches nothing
  let re = "";
  for (const ch of pattern) {
    if (ch === "*") re += ".*";
    else if (ch === "$") re += "$";
    else re += ch.replace(/[.+?^{}()|[\]\\]/g, "\\$&");
  }
  const rx = new RegExp("^" + re);
  return (path) => rx.test(path);
}

/**
 * Select the rule group for a user-agent token.
 * Exact token match wins; otherwise the '*' group; otherwise null.
 * Matching is case-insensitive, as tokens in the wild are mixed-case.
 */
export function groupFor(groups, token) {
  const t = token.toLowerCase();
  let star = null;
  for (const g of groups) {
    if (g.agents.includes(t)) return { group: g, matched: "exact" };
    if (g.agents.includes("*")) star = star ?? g;
  }
  return star ? { group: star, matched: "wildcard" } : null;
}

/**
 * RFC 9309 decision for one path: longest pattern wins, allow wins ties,
 * no matching rule means allowed.
 */
export function isAllowed(group, path) {
  let best = null;
  for (const rule of group.rules) {
    if (!pathMatcher(rule.path)(path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.type === "allow" && best.type === "disallow")
    ) {
      best = rule;
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
  const hasDisallow = group.rules.some(r => r.type === "disallow" && r.path !== "");
  const via = matched === "exact" ? `a "${token}" group` : 'the "*" group';

  if (!root) {
    return { token, status: "blocked", via, detail: `Blocked site-wide by ${via}.` };
  }
  if (hasDisallow) {
    const paths = group.rules.filter(r => r.type === "disallow" && r.path !== "").map(r => r.path);
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
    results: crawlers.map(c => ({ ...c, ...auditToken(parsed, c.token) }))
  };
}

/**
 * Generate robots.txt lines for a chosen policy.
 * mode: "block-training" | "block-all-ai" | "allow-all"
 */
export function generatePolicy(crawlers, mode) {
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
  const lines = text.split(/\r?\n/);
  const h1 = lines.find(l => /^# \S/.test(l));
  if (h1) findings.push({ ok: true, msg: `Has a project name heading: "${h1.slice(2, 80)}"` });
  else findings.push({ ok: false, msg: "Missing the H1 line (\"# Project name\") that every llms.txt starts with." });

  if (lines.some(l => /^> \S/.test(l))) findings.push({ ok: true, msg: "Has a summary blockquote." });
  else findings.push({ ok: false, msg: "No summary blockquote (\"> one-line description\"). Recommended so models get context cheaply." });

  const sections = lines.filter(l => /^## \S/.test(l)).length;
  const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  findings.push(sections
    ? { ok: true, msg: `${sections} section${sections === 1 ? "" : "s"} and ${links} link${links === 1 ? "" : "s"}.` }
    : { ok: false, msg: "No H2 sections with link lists. The file works but points models at nothing." });
  return findings;
}
