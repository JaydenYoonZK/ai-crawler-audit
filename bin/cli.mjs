#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAX_ROBOTS_BYTES, auditAll } from "../docs/robots.js";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version;
const DATASET = JSON.parse(readFileSync(new URL("../docs/data/crawlers.json", import.meta.url)));
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_LLMS_BYTES = 1024 * 1024;
const POLICIES = new Set(["never", "block-training", "block-all-ai", "allow-all"]);

const HELP = `Usage: ai-crawler-audit [options] <domain-or-url>

Audit a live site's robots.txt against the documented crawler dataset.

Options:
  --policy <mode>  Exit 1 when the site does not satisfy a policy:
                   block-training | block-all-ai | allow-all | never (default)
  --json           Print machine-readable JSON
  -h, --help       Show this help
  -v, --version    Print the version`;

export function safeText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "\uFFFD");
}

export function parseArgs(argv) {
  const options = { target: null, json: false, policy: "never" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-v" || arg === "--version") options.version = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--policy") options.policy = argv[++i];
    else if (arg.startsWith("--policy=")) options.policy = arg.slice("--policy=".length);
    else if (arg.startsWith("-")) options.badFlag = arg;
    else if (options.target === null) options.target = arg;
    else options.extraArg = arg;
  }
  return options;
}

export function normalizeOrigin(input) {
  const value = String(input).trim();
  if (!value || /\s/.test(value)) throw new Error("Enter one domain or URL without spaces.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new Error("Only http and https URLs are supported.");
  }
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

async function readLimited(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      text: new TextDecoder().decode(bytes.subarray(0, maxBytes)),
      truncated: bytes.length > maxBytes,
      bytesRead: Math.min(bytes.length, maxBytes)
    };
  }

  const chunks = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    if (value.length > remaining) {
      if (remaining > 0) chunks.push(value.subarray(0, remaining));
      total += Math.max(remaining, 0);
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.length;
    if (total === maxBytes) {
      const next = await reader.read();
      if (!next.done) {
        truncated = true;
        await reader.cancel();
      }
      break;
    }
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return { text: new TextDecoder().decode(joined), truncated, bytesRead: total };
}

export async function fetchSiteFile(origin, path, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_ROBOTS_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(origin + path, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": `ai-crawler-audit/${VERSION} (+https://github.com/JaydenYoonZK/ai-crawler-audit)` }
    });
    if (response.status >= 400 && response.status <= 499) {
      return { state: "unavailable", status: response.status, url: response.url || origin + path };
    }
    if (!response.ok) {
      return { state: "unreachable", status: response.status, url: response.url || origin + path };
    }
    return { state: "ok", status: response.status, url: response.url || origin + path, ...await readLimited(response, maxBytes) };
  } catch (error) {
    return {
      state: "unreachable",
      status: null,
      url: origin + path,
      error: controller.signal.aborted ? "Request timed out" : safeText(error?.message || "Network request failed")
    };
  } finally {
    clearTimeout(timer);
  }
}

export function policyViolations(results, policy) {
  if (policy === "never") return [];
  if (policy === "block-training") {
    return results.filter(result =>
      (result.purpose === "training" || result.purpose === "control") && result.status !== "blocked"
    );
  }
  if (policy === "block-all-ai") return results.filter(result => result.status !== "blocked");
  if (policy === "allow-all") {
    return results.filter(result => result.status !== "allowed" && result.status !== "default");
  }
  throw new TypeError(`Unknown policy: ${policy}`);
}

function cleanResult(result) {
  return Object.fromEntries(Object.entries(result).map(([key, value]) =>
    [key, typeof value === "string" ? safeText(value) : value]
  ));
}

function writeJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  if (options.version) {
    console.log(VERSION);
    return 0;
  }
  if (options.badFlag) {
    console.error(`Unknown option: ${safeText(options.badFlag)}\n${HELP}`);
    return 2;
  }
  if (options.extraArg) {
    console.error(`Unexpected argument: ${safeText(options.extraArg)}\n${HELP}`);
    return 2;
  }
  if (!options.target) {
    console.log(HELP);
    return 1;
  }
  if (!POLICIES.has(options.policy)) {
    console.error(`Invalid --policy value: ${safeText(options.policy)}. Use block-training, block-all-ai, allow-all, or never.`);
    return 2;
  }

  let origin;
  try {
    origin = normalizeOrigin(options.target);
  } catch (error) {
    console.error(`Invalid domain or URL: ${safeText(options.target)}`);
    console.error(safeText(error.message));
    return 2;
  }

  const robots = await fetchSiteFile(origin, "/robots.txt");
  if (robots.state === "unreachable") {
    const message = robots.status
      ? `robots.txt returned HTTP ${robots.status}`
      : robots.error || "robots.txt could not be reached";
    if (options.json) {
      writeJson({ origin, robots: { state: robots.state, status: robots.status, message }, results: [] });
    } else {
      console.error(`Could not audit ${safeText(origin)}: ${safeText(message)}.`);
      console.error("RFC 9309 says crawlers should assume complete disallow while robots.txt is unreachable. No site policy was inferred.");
    }
    return 2;
  }

  const robotsText = robots.state === "ok" ? robots.text : "";
  const out = auditAll(robotsText, DATASET.crawlers);
  const results = out.results.map(cleanResult);
  const violations = policyViolations(results, options.policy);
  const llms = await fetchSiteFile(origin, "/llms.txt", { maxBytes: MAX_LLMS_BYTES });

  if (options.json) {
    writeJson({
      origin,
      dataset: { version: DATASET.version, updated: DATASET.updated, crawlers: DATASET.crawlers.length },
      robots: {
        state: robots.state,
        status: robots.status,
        truncated: robots.truncated || out.truncated || undefined,
        sitemaps: out.sitemaps.map(safeText)
      },
      policy: { mode: options.policy, passed: violations.length === 0, violations: violations.map(result => result.token) },
      results,
      llms: { state: llms.state, status: llms.status, bytes: llms.state === "ok" ? llms.bytesRead : undefined }
    });
    return violations.length ? 1 : 0;
  }

  if (robots.state === "unavailable") {
    console.log(`robots.txt returned HTTP ${robots.status} at ${safeText(origin)}.`);
    console.log("RFC 9309 permits crawlers to access the site when robots.txt is unavailable.");
  }

  const color = (code, value) => process.stdout.isTTY ? `\x1b[${code}m${value}\x1b[0m` : value;
  const statusFormat = {
    blocked: value => color(31, value),
    allowed: value => color(32, value),
    partial: value => color(33, value),
    default: value => color(2, value)
  };
  const width = Math.max(...results.map(result => result.token.length)) + 2;

  console.log(`\nAI crawler audit for ${safeText(origin)}\n`);
  for (const result of [...results].sort((a, b) => a.status.localeCompare(b.status) || a.token.localeCompare(b.token))) {
    const status = statusFormat[result.status](result.status.toUpperCase().padEnd(8));
    console.log(`  ${result.token.padEnd(width)} ${status} ${result.purpose.padEnd(9)} ${result.detail}`);
  }

  const counts = results.reduce((map, result) => (map[result.status] = (map[result.status] ?? 0) + 1, map), {});
  console.log(`\n  ${counts.allowed ?? 0} allowed, ${counts.default ?? 0} default-allowed, ${counts.partial ?? 0} partial, ${counts.blocked ?? 0} blocked`);
  if (out.sitemaps.length) console.log(`  Sitemaps declared: ${out.sitemaps.map(safeText).join(", ")}`);
  if (robots.truncated || out.truncated) console.log(`  robots.txt was limited to the first ${MAX_ROBOTS_BYTES} bytes.`);

  if (llms.state === "ok") console.log(`  llms.txt: present (${llms.bytesRead} bytes${llms.truncated ? ", truncated for display" : ""})`);
  else if (llms.state === "unavailable") console.log("  llms.txt: not found (optional, see https://llmstxt.org/)");
  else console.log("  llms.txt: could not be checked");

  if (options.policy !== "never") {
    console.log(violations.length
      ? `  Policy ${options.policy}: failed (${violations.length} crawler${violations.length === 1 ? "" : "s"} outside the required state)`
      : `  Policy ${options.policy}: passed`);
  }
  console.log();
  return violations.length ? 1 : 0;
}

function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = await main();
