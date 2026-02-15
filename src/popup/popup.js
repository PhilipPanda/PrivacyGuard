const PG_ICON_ON = "../../assets/icons/icon-1024-on.png";
const PG_ICON_OFF = "../../assets/icons/icon-1024-off.png";

async function pgGetSettings() {
  return pgApiGetSettings();
}

async function pgSetSettings(changes) {
  await pgApiSetSettings(changes);
}

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
      number: { value: 140, density: { enable: true, value_area: 650 } },
      color: { value: "#ffffff" },
      shape: { type: "circle" },
      opacity: { value: 0.6, random: true },
      size: { value: 2.0, random: true },
      line_linked: { enable: true, distance: 110, color: "#ffffff", opacity: 0.35, width: 1 },
      move: { enable: true, speed: 0.85, direction: "none", random: false, straight: false, out_mode: "out" }
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
    },
    retina_detect: true
  });
}


function pgSetUIEnabled(isEnabled) {
  const pill = document.getElementById("statusPill");
  if (pill) {
    pill.textContent = isEnabled ? "ACTIVE" : "OFF";
    pill.style.opacity = isEnabled ? "1" : ".65";
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

async function pgLoadPopup() {
  const s = await pgGetSettings();
  pgSetUIEnabled(!!s.enabled);
  try {
    const res = await pgSendMessage({ type: "GET_STATS" });
    const statsEl = document.getElementById("popupStats");
    if (statsEl && res && res.stats) {
      const t = (res.stats.blockedAds || 0) + (res.stats.blockedBeacons || 0) + (res.stats.blockedCookies || 0) +
                (res.stats.blockedFingerprints || 0) + (res.stats.blockedTrackers || 0) + (res.stats.blockedCryptominers || 0);
      statsEl.textContent = t > 0 ? "Blocked: " + t.toLocaleString() : "";
      statsEl.style.display = t > 0 ? "block" : "none";
    }
  } catch (e) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    pgForceParticlesLayerPopup();
    pgInitParticlesPopup();
    await pgLoadPopup();

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
  } catch (e) {
    console.error("[PrivacyGuard] popup: initialization failed", e);
  }
});
