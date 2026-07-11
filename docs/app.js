import { auditAll, generatePolicy, checkLlmsTxt } from "./robots.js?v=1.4.16";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

let CRAWLERS = [];
let datasetReady = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const STATUS_LABEL = { blocked: "BLOCKED", allowed: "ALLOWED", partial: "PARTIAL", default: "DEFAULT" };
const STATUS_ORDER = { allowed: 0, default: 1, partial: 2, blocked: 3 };
const PURPOSE_LABEL = { training: "training", search: "AI search", user: "user fetch", control: "control token" };

// Enable each action and the Clear button only when its box has content. An
// empty box means nothing to audit, check, or clear, so those controls are
// disabled (dimmed, dashed edge, not-allowed cursor).
function syncControls() {
  const robotsHas = $("robots-input").value.trim().length > 0;
  $("audit").disabled = !robotsHas || !datasetReady;
  $("clear").disabled = !robotsHas;
  $("sample").disabled = !datasetReady;
  $("copy-policy").disabled = !datasetReady;
  const llmsHas = $("llms-input").value.trim().length > 0;
  $("llms-check").disabled = !llmsHas;
}

function runAudit() {
  if (!datasetReady) return;
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
    out.truncated ? `<span class="chip amber">Only the first 500 KiB was parsed</span>` : "",
    text.trim() ? "" : `<span class="chip">No robots.txt content yet, showing the open-by-default reality</span>`
  ].filter(Boolean).join("");

  const rows = [...out.results].sort((a, b) =>
    (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.vendor.localeCompare(b.vendor));

  $("audit-tbody").innerHTML = rows.map(r => `
    <tr>
      <td class="bot">${esc(r.token)}<div class="vendor">${esc(r.vendor)}</div></td>
      <td><span class="pill ${r.purpose}">${PURPOSE_LABEL[r.purpose]}</span></td>
      <td><span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span></td>
      <td><span class="detail">${esc(r.detail)}${esc(r.notes ? " " + r.notes : "")}</span>${r.docs ? ` <a class="doclink" href="${esc(r.docs)}" rel="noopener noreferrer" target="_blank">docs</a>` : ""}</td>
    </tr>`).join("");
}

function renderPolicy() {
  if (!datasetReady) {
    $("policy-snippet").textContent = "Crawler dataset unavailable. Reload the page before generating a policy.";
    return;
  }
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
  $("sample").disabled = true;
  $("copy-policy").disabled = true;
  $("dataset-note").textContent = "Loading the crawler dataset...";
  try {
    const res = await fetch("data/crawlers.json?v=1.4.16");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.crawlers) || !data.crawlers.length) throw new Error("Empty dataset");
    CRAWLERS = data.crawlers;
    datasetReady = true;
    $("dataset-note").textContent =
      `Checking against ${CRAWLERS.length} known AI crawlers and control tokens (dataset updated ${data.updated}).`;
  } catch {
    $("dataset-note").textContent = "Crawler dataset could not be loaded. Reload the page to try again.";
  }

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
    try {
      await navigator.clipboard.writeText($("policy-snippet").textContent);
      $("copy-policy").textContent = "Copied ✓";
    } catch {
      $("copy-policy").textContent = "Copy failed";
    }
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
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));
}

const themeToggle = document.getElementById("theme-toggle");
function syncThemeIcon() {
  const label = document.documentElement.dataset.theme === "light" ? "Switch to dark mode" : "Switch to light mode";
  themeToggle.setAttribute("aria-label", label);
  themeToggle.setAttribute("data-tip", label);
}
let themeFadeTimer = 0;
themeToggle.addEventListener("click", () => {
  // Crossfade the page in one composited pass where the browser supports
  // view transitions; text then cannot re-ease its inherited color and lag
  // behind the page. Elsewhere, fall back to fading only non-inherited
  // colors so text switches in one clean step.
  if (document.startViewTransition) {
    document.documentElement.classList.add("vt-active");
    const vt = document.startViewTransition(() => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
      syncThemeIcon();
    });
    vt.finished.finally(() => document.documentElement.classList.remove("vt-active"));
    return;
  }
  document.documentElement.classList.add("theme-fading");
  clearTimeout(themeFadeTimer);
  themeFadeTimer = setTimeout(() => document.documentElement.classList.remove("theme-fading"), 500);
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
if (scene && matchMedia("(pointer: fine)").matches && !reducedMotion.matches) {
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

if (scene && !reducedMotion.matches) {
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

// Cursor dust: tiny chartreuse sparks trail the pointer and burn out about
// a second after it rests. Everything lives on one fixed canvas: spawning
// is distance-based so speed sets density, the animation loop stops the
// moment the last spark dies, and touch or reduced-motion visitors never
// pay for any of it.
(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // width/height 100% is load-bearing: a canvas is a replaced element, so
  // inset alone does not stretch it and it would lay out at its intrinsic
  // dpr-scaled size, drawing every spark dpr times too far from the cursor.
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:2100;pointer-events:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener("resize", size);

  // One pre-rendered glow sprite per theme: drawImage per spark is far
  // cheaper than building a fresh radial gradient every frame.
  const sprite = (core) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const halo = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    halo.addColorStop(0, "rgba(171, 207, 55, 0.55)");
    halo.addColorStop(0.4, "rgba(171, 207, 55, 0.16)");
    halo.addColorStop(1, "rgba(171, 207, 55, 0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = core;
    g.beginPath();
    g.arc(32, 32, 4.5, 0, 7);
    g.fill();
    return c;
  };
  // The pale core glows against the night theme; light mode gets a deeper
  // green core so the dust stays visible on cream.
  const dust = { dark: sprite("#d7ef7a"), light: sprite("#7e9c26") };

  const sparks = [];
  const MAX = 90;
  let raf = 0, prev = 0, lastX = -1, lastY = -1, carry = 0;

  const spawn = (x, y, dx, dy) => {
    if (sparks.length >= MAX) return;
    const a = Math.random() * Math.PI * 2;
    const push = 4 + Math.random() * 16;
    sparks.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * push + dx * 1.4,
      vy: Math.sin(a) * push + dy * 1.4,
      life: 0,
      ttl: 0.45 + Math.random() * 0.5,
      r: 5 + Math.random() * 9,
      star: Math.random() < 0.25,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 4,
      seed: Math.random() * 40
    });
  };

  const star = (R) => {
    ctx.beginPath();
    ctx.moveTo(0, -R);
    ctx.quadraticCurveTo(R * 0.16, -R * 0.16, R, 0);
    ctx.quadraticCurveTo(R * 0.16, R * 0.16, 0, R);
    ctx.quadraticCurveTo(-R * 0.16, R * 0.16, -R, 0);
    ctx.quadraticCurveTo(-R * 0.16, -R * 0.16, 0, -R);
    ctx.fill();
  };

  const tick = (now) => {
    const t = now / 1000;
    const dt = Math.min(0.05, prev ? t - prev : 0.016);
    prev = t;
    ctx.clearRect(0, 0, w, h);
    const light = document.documentElement.dataset.theme === "light";
    const img = light ? dust.light : dust.dark;
    ctx.fillStyle = light ? "#7e9c26" : "#d7ef7a";
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.ttl) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy = s.vy * 0.9 + 26 * dt; // the dust settles gently
      const k = 1 - s.life / s.ttl;
      const twinkle = 0.7 + 0.3 * Math.sin(t * 16 + s.seed);
      ctx.globalAlpha = k * k * twinkle;
      const R = s.r * (0.5 + 0.7 * k);
      ctx.drawImage(img, s.x - R, s.y - R, R * 2, R * 2);
      if (s.star) {
        s.rot += s.spin * dt;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        star(R * 0.9);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (sparks.length) raf = requestAnimationFrame(tick);
    else { raf = 0; prev = 0; ctx.clearRect(0, 0, w, h); }
  };

  addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (lastX < 0) { lastX = e.clientX; lastY = e.clientY; return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    carry += Math.hypot(dx, dy);
    while (carry > 10) {
      carry -= 10;
      spawn(e.clientX, e.clientY, dx, dy);
    }
    if (sparks.length && !raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();


// Offline support: a small service worker caches the page shell so the
// tool opens without a connection after the first visit.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
  });
}
