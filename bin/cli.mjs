#!/usr/bin/env node
// Live audit of a site's robots.txt against the AI crawler dataset.
// Usage: npx github:JaydenYoonZK/ai-crawler-audit example.com

import { readFileSync } from "node:fs";
import { auditAll } from "../docs/robots.js";

const arg = process.argv[2];
if (!arg || arg === "-h" || arg === "--help") {
  console.log("Usage: ai-crawler-audit <domain-or-url>");
  console.log("Example: ai-crawler-audit example.com");
  process.exit(arg ? 0 : 1);
}
if (arg === "-v" || arg === "--version") {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  console.log(pkg.version);
  process.exit(0);
}
if (arg.startsWith("-")) {
  console.error(`Unknown option: ${arg}`);
  console.error("Usage: ai-crawler-audit <domain-or-url>");
  process.exit(2);
}

function normalizeOrigin(input) {
  const value = input.trim();
  if (!value || /\s/.test(value)) throw new Error("Enter one domain or URL without spaces.");
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  if (!url.hostname || url.username || url.password) {
    throw new Error("Enter a plain domain or URL without credentials.");
  }
  return url.origin;
}

let origin;
try {
  origin = normalizeOrigin(arg);
} catch (err) {
  console.error(`Invalid domain or URL: ${arg}`);
  console.error(err.message);
  process.exit(2);
}

const { crawlers } = JSON.parse(
  readFileSync(new URL("../docs/data/crawlers.json", import.meta.url))
);

const color = (c, s) => process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s;
const STATUS_FMT = {
  blocked: (s) => color(31, s),
  allowed: (s) => color(32, s),
  partial: (s) => color(33, s),
  default: (s) => color(2, s)
};

async function grab(path) {
  try {
    const res = await fetch(origin + path, {
      redirect: "follow",
      headers: { "User-Agent": "ai-crawler-audit/1.0 (+https://github.com/JaydenYoonZK/ai-crawler-audit)" }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const robots = await grab("/robots.txt");
if (robots === null) {
  console.log(`No readable robots.txt at ${origin}/robots.txt`);
  console.log("Every crawler is allowed by default.");
}

const out = auditAll(robots ?? "", crawlers);
const width = Math.max(...crawlers.map(c => c.token.length)) + 2;

console.log(`\nAI crawler audit for ${origin}\n`);
for (const r of [...out.results].sort((a, b) => a.status.localeCompare(b.status) || a.token.localeCompare(b.token))) {
  const status = STATUS_FMT[r.status](r.status.toUpperCase().padEnd(8));
  console.log(`  ${r.token.padEnd(width)} ${status} ${r.purpose.padEnd(9)} ${r.detail}`);
}

const counts = out.results.reduce((m, r) => (m[r.status] = (m[r.status] ?? 0) + 1, m), {});
console.log(`\n  ${counts.allowed ?? 0} allowed, ${counts.default ?? 0} default-allowed, ${counts.partial ?? 0} partial, ${counts.blocked ?? 0} blocked`);
if (out.sitemaps.length) console.log(`  Sitemaps declared: ${out.sitemaps.join(", ")}`);

const llms = await grab("/llms.txt");
console.log(llms !== null
  ? `  llms.txt: present (${llms.length} bytes)`
  : "  llms.txt: not found (optional, see https://llmstxt.org/)");
console.log();
