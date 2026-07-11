import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ROBOTS_BYTES, parseRobots, pathMatcher, groupFor, isAllowed, auditToken, auditAll, generatePolicy, checkLlmsTxt
} from "../docs/robots.js";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchSiteFile, main, normalizeOrigin, parseArgs, policyViolations, safeText } from "../bin/cli.mjs";

const crawlers = JSON.parse(
  readFileSync(new URL("../docs/data/crawlers.json", import.meta.url))
).crawlers;
const cli = fileURLToPath(new URL("../bin/cli.mjs", import.meta.url));
const fixtureOrigin = "https://fixture.example";

function fixtureFetch(url, options = {}) {
  const path = new URL(url).pathname;
  if (path === "/robots.txt") return Promise.resolve(new Response("User-agent: GPTBot\nDisallow: /\n"));
  if (path === "/missing" || path === "/llms.txt") return Promise.resolve(new Response("not found", { status: 404 }));
  if (path === "/error") return Promise.resolve(new Response("try later", { status: 503 }));
  if (path === "/large") return Promise.resolve(new Response("x".repeat(2048)));
  if (path === "/slow") {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (options.signal?.aborted) onAbort();
      else options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  return Promise.resolve(new Response("not found", { status: 404 }));
}

async function runMain(args, fetchImpl = fixtureFetch) {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout = [];
  const stderr = [];
  globalThis.fetch = fetchImpl;
  console.log = (...values) => stdout.push(values.join(" "));
  console.error = (...values) => stderr.push(values.join(" "));
  try {
    const code = await main(args);
    return { code, stdout: stdout.join("\n") + (stdout.length ? "\n" : ""), stderr: stderr.join("\n") + (stderr.length ? "\n" : "") };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
}

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

test("a BOM and bare carriage-return lines are accepted", () => {
  const parsed = parseRobots("\uFEFFUser-agent: GPTBot\rDisallow: /private\rSitemap: https://example.com/map.xml");
  assert.deepEqual(parsed.groups[0].agents, ["gptbot"]);
  assert.deepEqual(parsed.groups[0].rules, [{ type: "disallow", path: "/private" }]);
  assert.deepEqual(parsed.sitemaps, ["https://example.com/map.xml"]);
});

test("an empty user-agent does not attach rules to the previous group", () => {
  const parsed = parseRobots("User-agent: GPTBot\nAllow: /\nUser-agent:\nDisallow: /");
  assert.deepEqual(parsed.groups[0].rules, [{ type: "allow", path: "/" }]);
});

test("parsing is bounded at the RFC minimum of 500 KiB", () => {
  const prefix = "User-agent: GPTBot\nDisallow: /private\n";
  const parsed = parseRobots(prefix + "#".repeat(MAX_ROBOTS_BYTES) + "\nUser-agent: *\nDisallow: /");
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.groups.length, 1);
  assert.equal(auditAll(prefix + "x".repeat(MAX_ROBOTS_BYTES), crawlers).truncated, true);
});

test("wildcards and end anchors", () => {
  assert.ok(pathMatcher("/*.pdf$")("/files/report.pdf"));
  assert.ok(!pathMatcher("/*.pdf$")("/files/report.pdfx"));
  assert.ok(pathMatcher("/api/*/private")("/api/v2/private"));
  assert.ok(!pathMatcher("")("/anything"));
});

test("wildcard matching remains responsive on adversarial input", () => {
  const pattern = "/" + "*a".repeat(4000) + "$";
  const path = "/" + "a".repeat(4000) + "b";
  const start = performance.now();
  assert.equal(pathMatcher(pattern)(path), false);
  assert.ok(performance.now() - start < 250, "wildcard matcher took too long");
});

test("percent-encoded unreserved octets compare as their decoded form", () => {
  assert.equal(pathMatcher("/foo/bar/%62%61%7A")("/foo/bar/baz"), true);
  assert.equal(pathMatcher("/foo/bar/ツ")("/foo/bar/%E3%83%84"), true);
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

test("specificity counts matched octets rather than source characters", () => {
  const { groups } = parseRobots("User-agent: *\nDisallow: /a%62\nAllow: /ab");
  assert.equal(isAllowed(groups[0], "/ab"), true);
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

test("equivalent allow and disallow rules do not produce a false partial result", () => {
  const parsed = parseRobots("User-agent: GPTBot\nDisallow: /private\nAllow: /private");
  const result = auditToken(parsed, "GPTBot");
  assert.equal(result.status, "allowed");
});

test("a wildcard disallow stays partial when one sample path is allowed", () => {
  const parsed = parseRobots("User-agent: GPTBot\nDisallow: /foo*\nAllow: /foox");
  const result = auditToken(parsed, "GPTBot");
  assert.equal(result.status, "partial");
  assert.equal(isAllowed(groupFor(parsed.groups, "GPTBot").group, "/fooy"), false);
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

test("generated allow policy round-trips through the auditor", () => {
  const text = generatePolicy(crawlers, "allow-all");
  const out = auditAll(text, crawlers);
  assert.ok(out.results.every(result => result.status === "allowed"));
});

test("unknown policy modes fail closed", () => {
  assert.throws(() => generatePolicy(crawlers, "surprise"), /Unknown policy mode/);
});

test("llms.txt structural checks", () => {
  const good = checkLlmsTxt("# My Site\n\n> What it is.\n\n## Docs\n- [Guide](https://example.com/guide)\n");
  assert.ok(good.every(f => f.ok));
  const bad = checkLlmsTxt("hello world");
  assert.ok(bad.some(f => !f.ok));

  const minimal = checkLlmsTxt("\uFEFF# Minimal\n");
  assert.ok(minimal.every(f => f.ok), "optional sections are not specification failures");

  const misplaced = checkLlmsTxt("intro\n# Late heading\n");
  assert.equal(misplaced[0].ok, false);
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
  assert.match(help.stdout, /Usage: ai-crawler-audit \[options\] <domain-or-url>/);

  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
});

test("CLI reports missing and invalid targets clearly", () => {
  const missing = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /Usage: ai-crawler-audit \[options\] <domain-or-url>/);

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

test("CLI argument parsing rejects extra values and invalid policy modes", async () => {
  assert.deepEqual(parseArgs(["--json", "--policy=allow-all", "example.com"]), {
    target: "example.com", json: true, policy: "allow-all"
  });

  const extra = await runMain([fixtureOrigin, "second.example"]);
  assert.equal(extra.code, 2);
  assert.match(extra.stderr, /Unexpected argument/);

  const invalid = await runMain(["--policy", "unknown", fixtureOrigin]);
  assert.equal(invalid.code, 2);
  assert.match(invalid.stderr, /Invalid --policy value/);
});

test("CLI origin normalization keeps only a valid HTTP authority", () => {
  assert.equal(normalizeOrigin("example.com/path?q=1"), "https://example.com");
  assert.equal(normalizeOrigin("example.com:8080/path"), "https://example.com:8080");
  assert.equal(normalizeOrigin("http://example.com:8080/a"), "http://example.com:8080");
  assert.throws(() => normalizeOrigin("ftp://example.com"), /Only http and https/);
  assert.throws(() => normalizeOrigin("https://user:pass@example.com"), /without credentials/);
});

test("terminal output removes control and direction-changing characters", () => {
  const unsafe = `site\u001b[31m\u202Ename`;
  const clean = safeText(unsafe);
  assert.doesNotMatch(clean, /[\u001b\u202e]/);
  assert.match(clean, /^site.+name$/);
});

test("site fetches distinguish unavailable, unreachable, timeout, and truncation", async () => {
  const unavailable = await fetchSiteFile(fixtureOrigin, "/missing", { fetchImpl: fixtureFetch });
  assert.deepEqual({ state: unavailable.state, status: unavailable.status }, { state: "unavailable", status: 404 });

  const unreachable = await fetchSiteFile(fixtureOrigin, "/error", { fetchImpl: fixtureFetch });
  assert.deepEqual({ state: unreachable.state, status: unreachable.status }, { state: "unreachable", status: 503 });

  const timeout = await fetchSiteFile(fixtureOrigin, "/slow", { fetchImpl: fixtureFetch, timeoutMs: 20 });
  assert.equal(timeout.state, "unreachable");
  assert.equal(timeout.error, "Request timed out");

  const limited = await fetchSiteFile(fixtureOrigin, "/large", { fetchImpl: fixtureFetch, maxBytes: 64 });
  assert.equal(limited.state, "ok");
  assert.equal(limited.bytesRead, 64);
  assert.equal(limited.text.length, 64);
  assert.equal(limited.truncated, true);
});

test("JSON output is machine readable and policy gates use exit code 1", async () => {
  const report = await runMain(["--json", fixtureOrigin]);
  assert.equal(report.code, 0);
  assert.equal(report.stderr, "");
  const parsed = JSON.parse(report.stdout);
  assert.equal(parsed.origin, fixtureOrigin);
  assert.equal(parsed.robots.state, "ok");
  assert.equal(parsed.results.find(result => result.token === "GPTBot").status, "blocked");
  assert.equal(parsed.llms.state, "unavailable");

  const gated = await runMain(["--json", "--policy", "block-training", fixtureOrigin]);
  assert.equal(gated.code, 1);
  const gatedReport = JSON.parse(gated.stdout);
  assert.equal(gatedReport.policy.passed, false);
  assert.ok(gatedReport.policy.violations.includes("ClaudeBot"));
});

test("main distinguishes unavailable robots policy from an unreachable server", async () => {
  const unavailableFetch = url => Promise.resolve(new Response("missing", { status: 404 }));
  const unavailable = await runMain(["--json", fixtureOrigin], unavailableFetch);
  assert.equal(unavailable.code, 0);
  const unavailableReport = JSON.parse(unavailable.stdout);
  assert.equal(unavailableReport.robots.state, "unavailable");
  assert.ok(unavailableReport.results.every(result => result.status === "default"));

  const serverErrorFetch = url => Promise.resolve(new Response("error", { status: 503 }));
  const serverError = await runMain(["--json", fixtureOrigin], serverErrorFetch);
  assert.equal(serverError.code, 2);
  const errorReport = JSON.parse(serverError.stdout);
  assert.equal(errorReport.robots.state, "unreachable");
  assert.deepEqual(errorReport.results, []);
});

test("policy gates enforce only their documented crawler sets", () => {
  const results = [
    { token: "TrainBot", purpose: "training", status: "blocked" },
    { token: "SearchBot", purpose: "search", status: "allowed" },
    { token: "UserBot", purpose: "user", status: "partial" }
  ];
  assert.deepEqual(policyViolations(results, "block-training"), []);
  assert.deepEqual(policyViolations(results, "block-all-ai").map(result => result.token), ["SearchBot", "UserBot"]);
  assert.deepEqual(policyViolations(results, "allow-all").map(result => result.token), ["TrainBot", "UserBot"]);
});
