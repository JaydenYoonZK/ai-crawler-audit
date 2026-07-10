import { auditAll, generatePolicy, checkLlmsTxt } from "./robots.js?v=20260710g";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

let CRAWLERS = [];

const STATUS_LABEL = { blocked: "BLOCKED", allowed: "ALLOWED", partial: "PARTIAL", default: "DEFAULT" };
const STATUS_ORDER = { allowed: 0, default: 1, partial: 2, blocked: 3 };
const PURPOSE_LABEL = { training: "training", search: "AI search", user: "user fetch", control: "control token" };

// Enable each action and the Clear button only when its box has content. An
// empty box means nothing to audit, check, or clear, so those controls are
// disabled (dimmed, dashed edge, not-allowed cursor).
function syncControls() {
  const robotsHas = $("robots-input").value.trim().length > 0;
  $("audit").disabled = !robotsHas;
  $("clear").disabled = !robotsHas;
  const llmsHas = $("llms-input").value.trim().length > 0;
  $("llms-check").disabled = !llmsHas;
}

function runAudit() {
  syncControls();
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
  const res = await fetch("data/crawlers.json?v=20260710g");
  const data = await res.json();
  CRAWLERS = data.crawlers;
  $("dataset-note").textContent =
    `Checking against ${CRAWLERS.length} known AI crawlers and control tokens (dataset updated ${data.updated}).`;

  $("audit").addEventListener("click", runAudit);
  $("robots-input").addEventListener("input", syncControls);
  $("robots-input").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runAudit();
  });
  $("sample").addEventListener("click", () => { $("robots-input").value = SAMPLE; runAudit(); });

  const pasteBtn = $("paste");
  const pasteLabel = pasteBtn.textContent;
  let pasteFlashTimer = 0;
  let waitingForPaste = false;
  function flashPaste(msg) {
    pasteBtn.textContent = msg;
    clearTimeout(pasteFlashTimer);
    pasteFlashTimer = setTimeout(() => { pasteBtn.textContent = pasteLabel; }, 2600);
  }
  pasteBtn.addEventListener("click", async () => {
    // Read the clipboard on every device. On iOS the system shows its Paste
    // confirmation bubble at the tap point; confirming it fills the box and
    // runs the audit in one motion. That bubble is the minimum iOS allows
    // before a page may read the clipboard.
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        $("robots-input").value = text;
        runAudit();
        return;
      }
      flashPaste("Clipboard is empty");
      return;
    } catch { /* declined or unsupported, fall back to a manual paste */ }
    waitingForPaste = true;
    $("robots-input").focus();
    $("robots-input").select(); // a manual paste then replaces the old content
    flashPaste(matchMedia("(pointer: coarse)").matches
      ? "Long-press the box, then Paste"
      : (navigator.platform?.includes("Mac") ? "Press \u2318V to paste" : "Press Ctrl+V to paste"));
  });
  // If the clipboard read was declined, the audit still runs the moment a
  // manual paste lands in the box.
  $("robots-input").addEventListener("paste", () => {
    if (!waitingForPaste) return;
    waitingForPaste = false;
    clearTimeout(pasteFlashTimer);
    pasteBtn.textContent = pasteLabel;
    setTimeout(runAudit, 0); // let the pasted text land first
  });
  $("clear").addEventListener("click", () => { $("robots-input").value = ""; $("audit-results").hidden = true; syncControls(); });

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
  $("llms-input").addEventListener("input", syncControls);

  if (new URLSearchParams(location.search).has("demo")) {
    $("robots-input").value = SAMPLE;
    runAudit();
  }
  syncControls();
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

// Scroll spy: the active menu item is the last section whose heading sits
// at or above the reading line just below the sticky header. Computed from
// the scroll position rather than an IntersectionObserver band, because a
// menu jump lands the heading at the top of the viewport, outside any
// mid-viewport band, which left the highlight stuck on a section the page
// merely scrolled past.
const navAnchors = [...document.querySelectorAll(".nav-links a")];
const navSections = navAnchors.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
navSections.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
function syncActiveLink() {
  const nav = document.querySelector(".site-nav");
  const line = (nav ? nav.offsetHeight : 0) + 40;
  let current = null;
  for (const sec of navSections) {
    if (sec.getBoundingClientRect().top <= line) current = sec;
  }
  // At the very bottom the last section is current even when the page is
  // too short to lift its heading up to the line.
  if (navSections.length && Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2) {
    current = navSections[navSections.length - 1];
  }
  for (const a of navAnchors) {
    const on = !!current && a.hash === "#" + current.id;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
}
let spyRaf = 0;
addEventListener("scroll", () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; syncActiveLink(); }); }, { passive: true });
addEventListener("resize", syncActiveLink, { passive: true });
syncActiveLink();

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

// The bar is a brand row plus a menu band, and the band wraps on narrow
// screens, so the anchor offset is measured rather than hardcoded.
const siteNav = document.querySelector(".site-nav");
if (siteNav) {
  const setNavHeight = () => document.documentElement.style.setProperty("--nav-h", siteNav.offsetHeight + "px");
  addEventListener("resize", setNavHeight, { passive: true });
  setNavHeight();
}
