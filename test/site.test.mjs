import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const docs = join(root, "docs");
const html = readFileSync(join(docs, "index.html"), "utf8");
const app = readFileSync(join(docs, "app.js"), "utf8");
const styles = readFileSync(join(docs, "styles.css"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dataset = JSON.parse(readFileSync(join(docs, "data", "crawlers.json"), "utf8"));

test("protected design structure and headline remain present", () => {
  assert.match(html, /<h1>Who is reading your site: search engines, or AI labs\?<\/h1>/);
  for (const className of ["bg-scene", "orb-a", "orb-b", "star-layer", "cube3d", "sph", "hero-art", "site-nav"]) {
    assert.match(html, new RegExp(`class="[^"]*\\b${className}\\b`), `missing ${className} markup`);
  }
  for (const selector of [".orb", ".star-layer", ".cube3d", ".sph", ".hero-art", ".site-nav", "[data-tip]"]) {
    assert.ok(styles.includes(selector), `missing ${selector} visual rule`);
  }
});

test("the README preview contract describes both themes", () => {
  const preview = readFileSync(join(docs, "assets", "preview.png"));
  assert.equal(preview.toString("ascii", 1, 4), "PNG");
  assert.equal(preview.readUInt32BE(16), 1280);
  assert.ok(preview.readUInt32BE(20) > 1000);
  assert.match(readme, /docs\/assets\/preview\.png" alt="[^"]*light and dark themes/i);
});

test("interactive controls have accessible names", () => {
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const aria = match[1].match(/\baria-label="([^"]+)"/i)?.[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    assert.ok(aria || text, `button has no accessible name: ${match[0]}`);
  }
  assert.match(html, /<label for="robots-input"/);
  assert.match(html, /<label for="llms-input"/);
  assert.match(html, /<caption class="sr-only">[^<]+<\/caption>/);
  assert.match(html, /id="dataset-note" aria-live="polite"/);
});

test("internal links and local page assets resolve", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const match of html.matchAll(/\bhref="#([^"]+)"/g)) {
    assert.ok(ids.has(match[1]), `missing #${match[1]}`);
  }
  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  const local = references.filter(value => !/^(?:[a-z]+:|#)/i.test(value) && !value.startsWith("//"));
  for (const reference of local) {
    const path = reference.split(/[?#]/, 1)[0];
    assert.ok(existsSync(join(docs, path)), `missing local asset: ${reference}`);
  }
});

test("CSP and release metadata stay synchronized", () => {
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /form-action 'none'/);

  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLd, "missing JSON-LD metadata");
  assert.equal(JSON.parse(jsonLd[1]).softwareVersion, pkg.version);
  const version = pkg.version.replaceAll(".", "\\.");
  assert.match(html, new RegExp(`styles\\.css\\?v=${version}`));
  assert.match(html, new RegExp(`app\\.js\\?v=${version}`));
  assert.match(app, new RegExp(`robots\\.js\\?v=${version}`));
  assert.match(app, new RegExp(`crawlers\\.json\\?v=${version}`));
});

test("crawler counts and search metadata match the current dataset", () => {
  assert.equal(dataset.crawlers.length, 19);
  assert.equal(dataset.updated, "2026-07-11");
  assert.match(html, /Nineteen different AI crawlers and control tokens/);
  assert.match(html, /19 crawlers checked in one paste/);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+">/);
  assert.match(html, /<meta name="twitter:description" content="[^"]+">/);
  assert.match(readFileSync(join(docs, "robots.txt"), "utf8"), /Sitemap: https:\/\/jaydenyoonzk\.github\.io\/ai-crawler-audit\/sitemap\.xml/);
  assert.match(readFileSync(join(docs, "sitemap.xml"), "utf8"), /<loc>https:\/\/jaydenyoonzk\.github\.io\/ai-crawler-audit\/<\/loc>/);
});