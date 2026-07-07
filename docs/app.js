import { auditAll, generatePolicy, checkLlmsTxt } from "./robots.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let CRAWLERS = [];

const STATUS_LABEL = { blocked: "BLOCKED", allowed: "ALLOWED", partial: "PARTIAL", default: "DEFAULT" };
const STATUS_ORDER = { allowed: 0, default: 1, partial: 2, blocked: 3 };
const PURPOSE_LABEL = { training: "training", search: "AI search", user: "user fetch", control: "control token" };

function runAudit() {
  const text = $("robots-input").value;
  const out = auditAll(text, CRAWLERS);
  $("audit-results").hidden = false;

  const counts = { blocked: 0, allowed: 0, partial: 0, default: 0 };
  for (const r of out.results) counts[r.status]++;
  const open = counts.allowed + counts.default + counts.partial;
  $("audit-summary").innerHTML = [
    `<span class="chip ${open ? "green" : ""}"><strong>${open}</strong> can read your site</span>`,
    counts.partial ? `<span class="chip amber"><strong>${counts.partial}</strong> of those blocked from some paths</span>` : "",
    `<span class="chip red"><strong>${counts.blocked}</strong> blocked site-wide</span>`,
    text.trim() ? "" : `<span class="chip">No robots.txt content yet, showing the open-by-default reality</span>`
  ].filter(Boolean).join("");

  const rows = [...out.results].sort((a, b) =>
    (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.vendor.localeCompare(b.vendor));

  $("audit-tbody").innerHTML = rows.map(r => `
    <tr>
      <td class="bot">${esc(r.token)}<div class="vendor">${esc(r.vendor)}</div></td>
      <td><span class="pill ${r.purpose}">${PURPOSE_LABEL[r.purpose]}</span></td>
      <td><span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span></td>
      <td><span class="detail">${esc(r.detail)}${esc(r.notes ? " " + r.notes : "")}</span>${r.docs ? ` <a href="${r.docs}" rel="noopener" target="_blank">docs</a>` : ""}</td>
    </tr>`).join("");
}

function renderPolicy() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  $("policy-snippet").textContent = generatePolicy(CRAWLERS, mode);
}

function runLlms() {
  const text = $("llms-input").value;
  if (!text.trim()) { $("llms-results").hidden = true; return; }
  $("llms-results").hidden = false;
  $("llms-findings").innerHTML = checkLlmsTxt(text)
    .map(f => `<li class="${f.ok ? "ok" : "bad"}">${f.ok ? "✓" : "△"} ${esc(f.msg)}</li>`).join("");
}

const SAMPLE = `# Typical robots.txt of a small business site
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

Sitemap: https://example.com/sitemap.xml`;

async function init() {
  const res = await fetch("data/crawlers.json");
  const data = await res.json();
  CRAWLERS = data.crawlers;
  $("dataset-note").textContent =
    `Checking against ${CRAWLERS.length} known AI crawlers and control tokens (dataset updated ${data.updated}).`;

  $("audit").addEventListener("click", runAudit);
  $("robots-input").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runAudit();
  });
  $("sample").addEventListener("click", () => { $("robots-input").value = SAMPLE; runAudit(); });

  const pasteBtn = $("paste");
  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        $("robots-input").value = text;
        runAudit();
        return;
      }
    } catch { /* permission denied or unsupported */ }
    $("robots-input").focus();
    const prev = pasteBtn.textContent;
    pasteBtn.textContent = navigator.platform?.includes("Mac") ? "Press \u2318V, then Audit" : "Press Ctrl+V, then Audit";
    setTimeout(() => { pasteBtn.textContent = prev; }, 2400);
  });
  $("clear").addEventListener("click", () => { $("robots-input").value = ""; $("audit-results").hidden = true; });

  for (const el of document.querySelectorAll('input[name="mode"]')) {
    el.addEventListener("change", renderPolicy);
  }
  renderPolicy();

  $("copy-policy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("policy-snippet").textContent);
    $("copy-policy").textContent = "Copied ✓";
    setTimeout(() => { $("copy-policy").textContent = "Copy"; }, 1600);
  });

  $("llms-check").addEventListener("click", runLlms);

  if (new URLSearchParams(location.search).has("demo")) {
    $("robots-input").value = SAMPLE;
    runAudit();
  }
}

init();

const toTop = document.getElementById("to-top");
if (toTop) {
  addEventListener("scroll", () => {
    toTop.classList.toggle("show", scrollY > 600);
  }, { passive: true });
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
}

const themeToggle = document.getElementById("theme-toggle");
function syncThemeIcon() {
  themeToggle.textContent = document.documentElement.dataset.theme === "light" ? "🌙" : "☀️";
}
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  syncThemeIcon();
});
syncThemeIcon();

const navAnchors = [...document.querySelectorAll(".nav-links a")];
const navSections = navAnchors
  .map(a => document.getElementById(a.hash.slice(1)))
  .filter(Boolean);
const sectionSpy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const a of navAnchors) {
      a.classList.toggle("active", a.hash === "#" + entry.target.id);
    }
  }
}, { rootMargin: "-30% 0px -60% 0px" });
navSections.forEach(sec => sectionSpy.observe(sec));

const scene = document.querySelector(".bg-scene");
if (scene && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let rafId = 0;
  addEventListener("mousemove", (e) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      scene.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
      scene.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
    });
  }, { passive: true });
}

if (scene && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let scrollRaf = 0;
  const applyScroll = () => {
    scrollRaf = 0;
    scene.style.setProperty("--sy", String(scrollY));
  };
  addEventListener("scroll", () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
  }, { passive: true });
  applyScroll();
}
