import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRobots, pathMatcher, groupFor, isAllowed, auditToken, auditAll, generatePolicy, checkLlmsTxt
} from "../docs/robots.js";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const crawlers = JSON.parse(
  readFileSync(new URL("../docs/data/crawlers.json", import.meta.url))
).crawlers;
const cli = fileURLToPath(new URL("../bin/cli.mjs", import.meta.url));

test("parses groups with stacked user-agents", () => {
  const { groups } = parseRobots(`
User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /

User-agent: *
Allow: /
`);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].agents, ["gptbot", "claudebot"]);
  assert.equal(groups[0].rules.length, 1);
});

test("comments and blank lines are ignored", () => {
  const { groups, sitemaps } = parseRobots(`
# top comment
User-agent: GPTBot  # inline
Disallow: /private   # keep out

Sitemap: https://example.com/sitemap.xml
`);
  assert.equal(groups[0].rules[0].path, "/private");
  assert.deepEqual(sitemaps, ["https://example.com/sitemap.xml"]);
});

test("wildcards and end anchors", () => {
  assert.ok(pathMatcher("/*.pdf$")("/files/report.pdf"));
  assert.ok(!pathMatcher("/*.pdf$")("/files/report.pdfx"));
  assert.ok(pathMatcher("/api/*/private")("/api/v2/private"));
  assert.ok(!pathMatcher("")("/anything"));
});

test("longest match wins, allow beats disallow on ties", () => {
  const { groups } = parseRobots(`
User-agent: *
Disallow: /shop
Allow: /shop/public
`);
  const g = groups[0];
  assert.equal(isAllowed(g, "/shop/checkout"), false);
  assert.equal(isAllowed(g, "/shop/public/list"), true);
  assert.equal(isAllowed(g, "/blog"), true);
});

test("exact token group beats wildcard group", () => {
  const parsed = parseRobots(`
User-agent: *
Disallow: /

User-agent: GPTBot
Allow: /
`);
  assert.equal(auditToken(parsed, "GPTBot").status, "allowed");
  assert.equal(auditToken(parsed, "ClaudeBot").status, "blocked");
});

test("token matching is case-insensitive", () => {
  const parsed = parseRobots("User-agent: gptbot\nDisallow: /");
  assert.equal(auditToken(parsed, "GPTBot").status, "blocked");
});

test("empty robots means default allowed", () => {
  const parsed = parseRobots("");
  const r = auditToken(parsed, "GPTBot");
  assert.equal(r.status, "default");
});

test("partial when root allowed but paths blocked", () => {
  const parsed = parseRobots(`
User-agent: ClaudeBot
Disallow: /drafts
Disallow: /internal
`);
  const r = auditToken(parsed, "ClaudeBot");
  assert.equal(r.status, "partial");
  assert.match(r.detail, /\/drafts/);
});

test("auditAll covers the whole dataset", () => {
  const out = auditAll("User-agent: *\nDisallow: /", crawlers);
  assert.equal(out.results.length, crawlers.length);
  assert.ok(out.results.every(r => r.status === "blocked"));
});

test("generatePolicy block-training only targets training and control tokens", () => {
  const text = generatePolicy(crawlers, "block-training");
  assert.match(text, /User-agent: GPTBot/);
  assert.match(text, /User-agent: Google-Extended/);
  assert.doesNotMatch(text, /User-agent: OAI-SearchBot/);
  assert.doesNotMatch(text, /User-agent: ChatGPT-User/);
  assert.match(text, /Disallow: \//);
});

test("generatePolicy block-all includes search and user bots", () => {
  const text = generatePolicy(crawlers, "block-all-ai");
  assert.match(text, /User-agent: OAI-SearchBot/);
  assert.match(text, /User-agent: Perplexity-User/);
});

test("generated block policy round-trips through the auditor", () => {
  const text = generatePolicy(crawlers, "block-all-ai");
  const out = auditAll(text, crawlers);
  assert.ok(out.results.every(r => r.status === "blocked"));
});

test("llms.txt structural checks", () => {
  const good = checkLlmsTxt("# My Site\n\n> What it is.\n\n## Docs\n- [Guide](https://example.com/guide)\n");
  assert.ok(good.every(f => f.ok));
  const bad = checkLlmsTxt("hello world");
  assert.ok(bad.some(f => !f.ok));
});

test("dataset integrity: unique tokens, valid purposes, docs URLs well-formed", () => {
  const tokens = crawlers.map(c => c.token);
  assert.equal(new Set(tokens).size, tokens.length);
  for (const c of crawlers) {
    assert.ok(["training", "search", "user", "control"].includes(c.purpose), c.token);
    if (c.docs) assert.match(c.docs, /^https:\/\//);
    assert.ok(c.notes.length > 10, c.token + " needs a useful note");
  }
});

test("merges split groups for the same user-agent (RFC 9309)", () => {
  const parsed = parseRobots(`User-agent: GPTBot
Disallow: /a

User-agent: Googlebot
Disallow: /x

User-agent: GPTBot
Disallow: /b`);
  const g = groupFor(parsed.groups, "GPTBot").group;
  assert.equal(isAllowed(g, "/a"), false, "first block still applies");
  assert.equal(isAllowed(g, "/b"), false, "second block for the same agent must also apply");
  assert.equal(isAllowed(g, "/x"), true, "another agent's rules do not leak in");
});

test("merges repeated wildcard groups", () => {
  const parsed = parseRobots(`User-agent: *
Disallow: /private

User-agent: Googlebot
Allow: /

User-agent: *
Disallow: /admin`);
  const g = groupFor(parsed.groups, "SomeBot").group;
  assert.equal(isAllowed(g, "/private"), false);
  assert.equal(isAllowed(g, "/admin"), false, "the second '*' block must not be dropped");
});

test("a specific group suppresses the wildcard group", () => {
  const parsed = parseRobots(`User-agent: *
Disallow: /

User-agent: GPTBot
Allow: /`);
  // GPTBot has its own group, so the blanket '*' block does not apply to it.
  assert.equal(auditToken(parsed, "GPTBot").status, "allowed");
  assert.equal(auditToken(parsed, "OtherBot").status, "blocked");
});

test("CLI prints help and version without a network audit", () => {
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: ai-crawler-audit <domain-or-url>/);

  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
});

test("CLI reports missing and invalid targets clearly", () => {
  const missing = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /Usage: ai-crawler-audit <domain-or-url>/);

  const invalid = spawnSync(process.execPath, [cli, "not a url"], { encoding: "utf8" });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Invalid domain or URL: not a url/);
  assert.doesNotMatch(invalid.stdout, /AI crawler audit for/);
});

test("CLI rejects unknown flags instead of treating them as domains", () => {
  const bad = spawnSync(process.execPath, [cli, "--wat"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Unknown option: --wat/);
  assert.doesNotMatch(bad.stdout, /AI crawler audit for/);
});
