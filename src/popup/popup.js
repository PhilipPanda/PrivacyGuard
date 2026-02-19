const PG_ICON_ON = "../../assets/icons/icon-1024-on.png";
const PG_ICON_OFF = "../../assets/icons/icon-1024-off.png";

/* ── Settings helpers ── */
async function pgGetSettings() {
  const res = await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.GET_SETTINGS
  });
  return res.settings || {};
}

async function pgSetSettings(changes) {
  await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.SET_SETTINGS,
    settings: changes
  });
}

/* ── Particles ── */
function pgForceParticlesLayerPopup() {
  const p = document.getElementById("pgParticles");
  if (p) {
    p.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;margin:0;padding:0;overflow:hidden;display:block;";
  }

  const mo = new MutationObserver(() => {
    if (!p) return;
    const c = p.querySelector("canvas");
    if (!c) return;
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;";
  });

  if (p) mo.observe(p, { childList: true, subtree: true });
}

function pgInitParticlesPopup() {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  if (!window.particlesJS) return;

  window.particlesJS("pgParticles", {
    particles: {
      number: { value: 100, density: { enable: true, value_area: 600 } },
      color: { value: "#ffffff" },
      shape: { type: "circle" },
      opacity: { value: 0.4, random: true },
      size: { value: 1.8, random: true },
      line_linked: { enable: true, distance: 100, color: "#ffffff", opacity: 0.2, width: 0.8 },
      move: { enable: true, speed: 0.6, direction: "none", random: false, straight: false, out_mode: "out" }
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
    },
    retina_detect: true
  });
}

/* ── UI State ── */
function pgSetUIEnabled(isEnabled) {
  const pill = document.getElementById("statusPill");
  if (pill) {
    const pillText = pill.querySelector(".pillText");
    if (pillText) pillText.textContent = isEnabled ? "ACTIVE" : "OFF";
    pill.classList.toggle("active", isEnabled);
    pill.classList.toggle("off", !isEnabled);
  }

  const btn = document.getElementById("masterBtn");
  if (btn) btn.setAttribute("aria-pressed", isEnabled ? "true" : "false");

  const img = document.getElementById("masterIcon");
  if (img) {
    const nextSrc = isEnabled ? PG_ICON_ON : PG_ICON_OFF;
    img.classList.add("isFading");
    setTimeout(() => {
      img.src = nextSrc;
      requestAnimationFrame(() => img.classList.remove("isFading"));
    }, 130);
  }
}

/* ── Quick Toggles ── */
function pgUpdateQuickToggles(settings) {
  const features = ["blockAds", "alwaysHTTPS", "blockTrackers", "blockThirdPartyCookies"];
  const ids = ["qtAds", "qtHTTPS", "qtTrackers", "qtCookies"];

  for (let i = 0; i < features.length; i++) {
    const el = document.getElementById(ids[i]);
    if (el) {
      el.setAttribute("aria-pressed", settings[features[i]] ? "true" : "false");
    }
  }
}

/* ── Animated counter ── */
function pgAnimateValue(el, end) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  if (start === end) { el.textContent = end.toLocaleString(); return; }

  const duration = 500;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(start + (end - start) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/* ── Stats ── */
function pgUpdateStats(stats) {
  if (!stats) return;

  pgAnimateValue(document.getElementById("statAds"), stats.blockedAds || 0);
  pgAnimateValue(document.getElementById("statTrackers"), (stats.blockedTrackers || 0));
  pgAnimateValue(document.getElementById("statFingerprints"), stats.blockedFingerprints || 0);
  pgAnimateValue(document.getElementById("statCookies"), (stats.blockedCookies || 0));
}

/* ── Load ── */
async function pgLoadPopup() {
  const s = await pgGetSettings();
  pgSetUIEnabled(!!s.enabled);
  pgUpdateQuickToggles(s);

  try {
    const res = await browser.runtime.sendMessage({ type: "GET_STATS" });
    if (res && res.stats) {
      pgUpdateStats(res.stats);
    }
  } catch (e) {
    // stats unavailable
  }
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    pgForceParticlesLayerPopup();
    pgInitParticlesPopup();
    await pgLoadPopup();

    /* Master toggle */
    const masterBtn = document.getElementById("masterBtn");
    if (masterBtn) {
      masterBtn.addEventListener("click", async () => {
        try {
          const s = await pgGetSettings();
          const next = !s.enabled;
          await pgSetSettings({ enabled: next });
          pgSetUIEnabled(next);
        } catch (e) {
          console.error("[PrivacyGuard] popup: failed to toggle master switch", e);
          alert("Failed to update settings. Please try again.");
        }
      });
    }

    /* Quick toggles */
    document.querySelectorAll(".qt").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          const feature = btn.dataset.feature;
          if (!feature) return;
          const s = await pgGetSettings();
          const next = !s[feature];
          await pgSetSettings({ [feature]: next });
          btn.setAttribute("aria-pressed", next ? "true" : "false");
        } catch (e) {
          console.error("[PrivacyGuard] popup: quick toggle failed", e);
        }
      });
    });

    /* Open options */
    const openBtn = document.getElementById("openOptions");
    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        try {
          if (browser.runtime.openOptionsPage) {
            await browser.runtime.openOptionsPage();
          } else {
            await browser.tabs.create({ url: browser.runtime.getURL("src/options/options.html") });
          }
          window.close();
        } catch (e) {
          console.error("[PrivacyGuard] popup: failed to open options", e);
        }
      });
    }

    /* Footer link */
    const footerLink = document.getElementById("footerLink");
    if (footerLink) {
      footerLink.addEventListener("click", (e) => {
        e.preventDefault();
        browser.tabs.create({ url: PrivacyGuardConstants.COMPANY_URL || "https://templeenterprise.com" });
      });
    }
  } catch (e) {
    console.error("[PrivacyGuard] popup: initialization failed", e);
  }
});
