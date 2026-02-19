/* ═══════════════════════════════════════════════════
   PrivacyGuard — Options Page Script
   ═══════════════════════════════════════════════════ */

/* ── Settings Helpers ── */
async function pgGetSettings() {
  const res = await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.GET_SETTINGS
  });
  return res.settings || {};
}

async function pgSaveOptions(changes) {
  await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.SET_SETTINGS,
    settings: changes
  });
  pgShowToast("Settings saved");
}

async function pgGetAdblockStatus() {
  const res = await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS
  });
  return res.status || null;
}

async function pgUpdateAdblockLists() {
  const res = await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.ADBLOCK_UPDATE
  });
  return res.status || null;
}

/* ── Toast Notifications ── */
function pgShowToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toastOut");
    toast.addEventListener("animationend", () => toast.remove());
  }, 2200);
}

/* ── Sidebar Navigation ── */
function pgInitSidebar() {
  const navItems = document.querySelectorAll(".navItem");
  const sections = document.querySelectorAll(".section");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = item.dataset.section;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // Highlight active nav on scroll
  const mainContent = document.querySelector(".mainContent");
  if (mainContent && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach(n => {
            n.classList.toggle("active", n.dataset.section === id);
          });
        }
      });
    }, { rootMargin: "-20% 0px -60% 0px", threshold: 0 });

    sections.forEach(section => observer.observe(section));
  }

  // Company links
  document.querySelectorAll("#sidebarCompanyLink, #footerCompanyLink").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      browser.tabs.create({ url: PrivacyGuardConstants.COMPANY_URL || "https://templeenterprise.com" });
    });
  });
}

/* ── Format Helpers ── */
function pgFormatStatus(status) {
  if (!status) return "Adblock status unavailable.";
  const count = status.blockedDomains || 0;
  const allowCount = status.allowDomains || 0;
  const updated = status.lastUpdated ? new Date(status.lastUpdated).toLocaleString() : "never";
  const failures = status.sourcesFailed || 0;
  const duration = status.lastDurationMs ? ` • ${Math.round(status.lastDurationMs).toLocaleString()}ms` : "";
  const err = status.lastError ? ` • Error: ${status.lastError}` : "";
  const failNote = failures ? ` • ${failures} source(s) failed` : "";
  return `${count.toLocaleString()} blocked domains • ${allowCount.toLocaleString()} allowed • Updated: ${updated}${duration}${failNote}${err}`;
}

function pgNormalizeHostLine(line) {
  if (!line) return null;
  let s = String(line).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0]; s = s.split("?")[0]; s = s.split("#")[0]; s = s.split(":")[0];
  if (!s.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (s.includes("..")) return null;
  if (s === "localhost" || s === "127.0.0.1" || s === "::1") return null;
  return s;
}

function pgParseDecoySites(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = []; const seen = new Set();
  for (const line of lines) {
    const host = pgNormalizeHostLine(line);
    if (!host || seen.has(host)) continue;
    seen.add(host); out.push(host);
  }
  return out;
}

function pgParseDomainList(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = []; const seen = new Set();
  for (const line of lines) {
    const cleaned = String(line || "").split("#")[0].trim();
    if (!cleaned) continue;
    const host = pgNormalizeHostLine(cleaned);
    if (!host || seen.has(host)) continue;
    seen.add(host); out.push(host);
  }
  return out;
}

function pgParseDurationToSeconds(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = m[2] || "m";
  let mult = 60;
  if (unit === "s") mult = 1;
  if (unit === "m") mult = 60;
  if (unit === "h") mult = 3600;
  if (unit === "d") mult = 86400;
  return value * mult;
}

function pgFormatSecondsCanonical(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec % 86400 === 0) return String(sec / 86400) + "d";
  if (sec % 3600 === 0) return String(sec / 3600) + "h";
  if (sec % 60 === 0) return String(sec / 60) + "m";
  return String(sec) + "s";
}

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  n = Math.floor(n);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/* ── Particles ── */
function pgInitParticles() {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  if (!window.particlesJS) return;

  window.particlesJS("pgParticles", {
    particles: {
      number: { value: 35, density: { enable: true, value_area: 1000 } },
      color: { value: "#ffffff" },
      shape: { type: "circle" },
      opacity: { value: 0.35, random: true },
      size: { value: 1.6, random: true },
      line_linked: { enable: true, distance: 140, color: "#ffffff", opacity: 0.18, width: 0.8 },
      move: { enable: true, speed: 0.5, direction: "none", random: false, straight: false, out_mode: "out" }
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
    },
    retina_detect: true
  });
}

/* ── Proxy Status ── */
async function pgLoadProxyStatus() {
  const el = document.getElementById("proxyStatus");
  if (!el) return;
  try {
    const obj = await browser.storage.local.get("pg_proxy_status");
    const st = obj ? obj.pg_proxy_status : null;
    if (!st) { el.textContent = "Proxy status: unknown"; return; }
    const when = st.at ? new Date(st.at).toLocaleString() : "unknown time";
    if (st.applied) {
      const detail = st.detail ? ` (${st.detail})` : "";
      el.textContent = `✓ Proxy applied • mode=${st.mode}${detail} • ${when}`;
    } else {
      const err = st.lastError ? ` • ${st.lastError}` : "";
      el.textContent = `✗ Proxy not applied • mode=${st.mode} • ${when}${err}`;
    }
  } catch (e) {
    el.textContent = "Proxy status: unknown";
  }
}

/* ── Load Options ── */
async function pgLoadOptions() {
  const s = await pgGetSettings();

  const map = {
    enabled: "enabled",
    blockAds: "blockAds",
    blockTrackers: "blockTrackers",
    alwaysHTTPS: "alwaysHTTPS",
    stripUTMParams: "stripUTMParams",
    decoyTraffic: "decoyTraffic",
    proxyEnabled: "proxyEnabled",
    antiFingerprint: "antiFingerprint",
    manageReferrer: "manageReferrer",
    manageUserAgent: "manageUserAgent",
    blockThirdPartyCookies: "blockThirdPartyCookies",
    autoDeleteCookies: "autoDeleteCookies",
    blockBeacons: "blockBeacons",
    blockWebRTC: "blockWebRTC",
    blockSocialWidgets: "blockSocialWidgets",
    blockCryptoMiners: "blockCryptoMiners",
    manageStorage: "manageStorage",
    siteWhitelist: "siteWhitelist",
    requestTimeout: "requestTimeout"
  };

  for (const [elId, key] of Object.entries(map)) {
    const el = document.getElementById(elId);
    if (el) {
      if (key === "disableHyperlinkAuditing") {
        el.checked = s[key] !== false;
      } else {
        el.checked = !!s[key];
      }
    }
  }

  const disableHyperlinkAuditingEl = document.getElementById("disableHyperlinkAuditing");
  if (disableHyperlinkAuditingEl) disableHyperlinkAuditingEl.checked = s.disableHyperlinkAuditing !== false;

  // Text/select fields
  const fields = {
    adblockCustomBlocklist: { val: (Array.isArray(s.adblockCustomBlocklist) ? s.adblockCustomBlocklist : []).join("\n") },
    adblockCustomAllowlist: { val: (Array.isArray(s.adblockCustomAllowlist) ? s.adblockCustomAllowlist : []).join("\n") },
    adblockDisabledSites: { val: (Array.isArray(s.adblockDisabledSites) ? s.adblockDisabledSites : []).join("\n") },
    decoyMinInterval: { val: String(s.decoyMinInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval) },
    decoyMaxInterval: { val: String(s.decoyMaxInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval) },
    decoySites: { val: (Array.isArray(s.decoySites) ? s.decoySites : []).join("\n") },
    proxyType: { val: String(s.proxyType || "socks") },
    proxyHost: { val: String(s.proxyHost || "") },
    proxyPort: { val: String(s.proxyPort || 1080) },
    proxyUsername: { val: String(s.proxyUsername || "") },
    proxyPassword: { val: String(s.proxyPassword || "") },
    referrerMode: { val: String(s.referrerMode || "no-referrer") },
    userAgentMode: { val: String(s.userAgentMode || "random") },
    customUserAgent: { val: String(s.customUserAgent || "") },
    cookieLifetime: { val: String(s.cookieLifetime || "7d") },
    storageMode: { val: String(s.storageMode || "clear-on-close") },
    whitelistedSites: { val: (Array.isArray(s.whitelistedSites) ? s.whitelistedSites : []).join("\n") },
    requestTimeoutMs: { val: String(s.requestTimeoutMs || 30000) }
  };

  for (const [id, cfg] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = cfg.val;
  }

  const proxyDNSEl = document.getElementById("proxyDNS");
  if (proxyDNSEl) proxyDNSEl.checked = !!s.proxyDNS;

  // Custom UASM visibility
  const uamEl = document.getElementById("userAgentMode");
  const customContainer = document.getElementById("customUserAgentContainer");
  if (uamEl && customContainer) {
    customContainer.style.display = uamEl.value === "custom" ? "block" : "none";
  }

  // Adblock status
  const statusEl = document.getElementById("adblockStatus");
  if (statusEl) {
    const st = await pgGetAdblockStatus();
    statusEl.textContent = pgFormatStatus(st);
  }

  await pgLoadProxyStatus();
  await pgLoadPrivacyStats();
}

/* ── Privacy Stats ── */
async function pgLoadPrivacyStats() {
  const statsEl = document.getElementById("privacyStats");
  if (!statsEl) return;
  try {
    const res = await browser.runtime.sendMessage({ type: "GET_STATS" });
    if (res && res.stats) {
      const s = res.stats;
      const total = (s.blockedAds || 0) + (s.blockedBeacons || 0) + (s.blockedCookies || 0) +
        (s.blockedFingerprints || 0) + (s.blockedTrackers || 0) + (s.blockedCryptominers || 0);
      const lastReset = s.lastReset ? new Date(s.lastReset).toLocaleString() : "never";
      statsEl.innerHTML = `
        <div><strong>Total Blocked:</strong> ${total.toLocaleString()}</div>
        <div><strong>Ads:</strong> ${(s.blockedAds || 0).toLocaleString()}</div>
        <div><strong>Trackers:</strong> ${(s.blockedTrackers || 0).toLocaleString()}</div>
        <div><strong>Beacons:</strong> ${(s.blockedBeacons || 0).toLocaleString()}</div>
        <div><strong>Cookies:</strong> ${(s.blockedCookies || 0).toLocaleString()}</div>
        <div><strong>Fingerprints:</strong> ${(s.blockedFingerprints || 0).toLocaleString()}</div>
        <div><strong>Crypto Miners:</strong> ${(s.blockedCryptominers || 0).toLocaleString()}</div>
        <div><strong>URLs Cleaned:</strong> ${(s.cleanedUrls || 0).toLocaleString()}</div>
        <div><strong>HTTPS Upgrades:</strong> ${(s.upgradedHttps || 0).toLocaleString()}</div>
        <div style="grid-column:1/-1;margin-top:6px;font-size:10px;opacity:.5">Last reset: ${lastReset}</div>
      `;
    } else {
      statsEl.textContent = "Statistics unavailable";
    }
  } catch (e) {
    console.error("[PrivacyGuard] options: failed to load stats", e);
    statsEl.textContent = "Failed to load statistics";
  }
}

/* ── Clear Cookies ── */
async function pgClearAllCookies() {
  if (browser.browsingData && typeof browser.browsingData.remove === "function") {
    await browser.browsingData.remove({}, { cookies: true });
    return;
  }
  if (!browser.cookies || typeof browser.cookies.getAll !== "function") {
    throw new Error("cookies API unavailable");
  }
  const all = await browser.cookies.getAll({});
  const removals = [];
  for (const c of all) {
    const scheme = c.secure ? "https://" : "http://";
    const host = (c.domain || "").replace(/^\./, "");
    const url = scheme + host + (c.path || "/");
    removals.push(browser.cookies.remove({ url, name: c.name, storeId: c.storeId }).catch(() => null));
  }
  await Promise.all(removals);
}

/* ═══ Init ═══ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    pgInitParticles();
    pgInitSidebar();
    await pgLoadOptions();
  } catch (e) {
    console.error("[PrivacyGuard] options: initialization failed", e);
  }

  /* ── Toggle listeners ── */
  const toggles = [
    ["enabled", "enabled"],
    ["blockAds", "blockAds"],
    ["blockTrackers", "blockTrackers"],
    ["alwaysHTTPS", "alwaysHTTPS"],
    ["stripUTMParams", "stripUTMParams"],
    ["decoyTraffic", "decoyTraffic"],
    ["antiFingerprint", "antiFingerprint"],
    ["manageReferrer", "manageReferrer"],
    ["manageUserAgent", "manageUserAgent"],
    ["blockThirdPartyCookies", "blockThirdPartyCookies"],
    ["autoDeleteCookies", "autoDeleteCookies"],
    ["blockBeacons", "blockBeacons"],
    ["blockWebRTC", "blockWebRTC"],
    ["blockSocialWidgets", "blockSocialWidgets"],
    ["blockCryptoMiners", "blockCryptoMiners"],
    ["disableHyperlinkAuditing", "disableHyperlinkAuditing"],
    ["manageStorage", "manageStorage"],
    ["siteWhitelist", "siteWhitelist"],
    ["requestTimeout", "requestTimeout"]
  ];

  for (const [elId, key] of toggles) {
    const el = document.getElementById(elId);
    if (el) el.addEventListener("change", (e) => pgSaveOptions({ [key]: e.target.checked }));
  }

  /* ── Adblock textareas ── */
  const adblockCustomBlocklistEl = document.getElementById("adblockCustomBlocklist");
  const adblockCustomAllowlistEl = document.getElementById("adblockCustomAllowlist");
  const adblockDisabledSitesEl = document.getElementById("adblockDisabledSites");
  let adblockSaveTimer = null;

  function scheduleAdblockSave() {
    clearTimeout(adblockSaveTimer);
    adblockSaveTimer = setTimeout(async () => {
      const blocklist = adblockCustomBlocklistEl ? pgParseDomainList(adblockCustomBlocklistEl.value) : [];
      const allowlist = adblockCustomAllowlistEl ? pgParseDomainList(adblockCustomAllowlistEl.value) : [];
      const disabled = adblockDisabledSitesEl ? pgParseDomainList(adblockDisabledSitesEl.value) : [];
      await pgSaveOptions({
        adblockCustomBlocklist: blocklist,
        adblockCustomAllowlist: allowlist,
        adblockDisabledSites: disabled
      });
    }, 600);
  }

  [adblockCustomBlocklistEl, adblockCustomAllowlistEl, adblockDisabledSitesEl].forEach(el => {
    if (el) {
      el.addEventListener("input", scheduleAdblockSave);
      el.addEventListener("blur", scheduleAdblockSave);
    }
  });

  /* ── Select changes ── */
  const referrerModeEl = document.getElementById("referrerMode");
  if (referrerModeEl) referrerModeEl.addEventListener("change", (e) => pgSaveOptions({ referrerMode: e.target.value }));

  const storageModeEl = document.getElementById("storageMode");
  if (storageModeEl) storageModeEl.addEventListener("change", (e) => pgSaveOptions({ storageMode: e.target.value }));

  const userAgentModeEl = document.getElementById("userAgentMode");
  if (userAgentModeEl) {
    userAgentModeEl.addEventListener("change", (e) => {
      const customContainer = document.getElementById("customUserAgentContainer");
      if (customContainer) customContainer.style.display = e.target.value === "custom" ? "block" : "none";
      pgSaveOptions({ userAgentMode: e.target.value });
    });
  }

  const customUserAgentEl = document.getElementById("customUserAgent");
  if (customUserAgentEl) {
    let cuaTimer = null;
    customUserAgentEl.addEventListener("input", () => {
      clearTimeout(cuaTimer);
      cuaTimer = setTimeout(() => pgSaveOptions({ customUserAgent: customUserAgentEl.value }), 600);
    });
    customUserAgentEl.addEventListener("blur", () => pgSaveOptions({ customUserAgent: customUserAgentEl.value }));
  }

  /* ── Cookie lifetime ── */
  const cookieLifetimeEl = document.getElementById("cookieLifetime");
  if (cookieLifetimeEl) {
    const saveCL = () => {
      const lifetime = cookieLifetimeEl.value.trim();
      if (lifetime) pgSaveOptions({ cookieLifetime: lifetime });
    };
    cookieLifetimeEl.addEventListener("blur", saveCL);
    cookieLifetimeEl.addEventListener("change", saveCL);
  }

  /* ── Request timeout ── */
  const requestTimeoutMsEl = document.getElementById("requestTimeoutMs");
  if (requestTimeoutMsEl) {
    const saveRT = () => {
      const ms = clamp(Number(requestTimeoutMsEl.value) || 30000, 1000, 300000);
      requestTimeoutMsEl.value = String(ms);
      pgSaveOptions({ requestTimeoutMs: ms });
    };
    requestTimeoutMsEl.addEventListener("change", saveRT);
    requestTimeoutMsEl.addEventListener("blur", saveRT);
  }

  /* ── Decoy intervals ── */
  const minEl = document.getElementById("decoyMinInterval");
  const maxEl = document.getElementById("decoyMaxInterval");

  async function saveIntervals() {
    if (!minEl || !maxEl) return;
    let minSec = pgParseDurationToSeconds(minEl.value);
    let maxSec = pgParseDurationToSeconds(maxEl.value);
    if (minSec === null) minSec = pgParseDurationToSeconds(PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval);
    if (maxSec === null) maxSec = pgParseDurationToSeconds(PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval);
    minSec = clamp(minSec, PrivacyGuardConstants.DECOY_MIN_INTERVAL_SECONDS, PrivacyGuardConstants.DECOY_MAX_INTERVAL_SECONDS);
    maxSec = clamp(maxSec, PrivacyGuardConstants.DECOY_MIN_INTERVAL_SECONDS, PrivacyGuardConstants.DECOY_MAX_INTERVAL_SECONDS);
    if (maxSec < minSec) maxSec = minSec;
    minEl.value = pgFormatSecondsCanonical(minSec);
    maxEl.value = pgFormatSecondsCanonical(maxSec);
    await pgSaveOptions({ decoyMinInterval: minEl.value, decoyMaxInterval: maxEl.value });
  }

  if (minEl && maxEl) {
    minEl.addEventListener("change", saveIntervals);
    maxEl.addEventListener("change", saveIntervals);
    minEl.addEventListener("blur", saveIntervals);
    maxEl.addEventListener("blur", saveIntervals);
  }

  /* ── Decoy sites ── */
  const sitesEl = document.getElementById("decoySites");
  let sitesSaveTimer = null;
  if (sitesEl) {
    const scheduleSitesSave = () => {
      clearTimeout(sitesSaveTimer);
      sitesSaveTimer = setTimeout(async () => {
        await pgSaveOptions({ decoySites: pgParseDecoySites(sitesEl.value) });
      }, 600);
    };
    sitesEl.addEventListener("input", scheduleSitesSave);
    sitesEl.addEventListener("blur", scheduleSitesSave);
  }

  /* ── Whitelist ── */
  const whitelistedSitesEl = document.getElementById("whitelistedSites");
  let whitelistSaveTimer = null;
  if (whitelistedSitesEl) {
    const scheduleWhitelistSave = () => {
      clearTimeout(whitelistSaveTimer);
      whitelistSaveTimer = setTimeout(async () => {
        const text = whitelistedSitesEl.value || "";
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && l.length > 0);
        const normalized = lines.map(l => {
          let d = l.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0].split("#")[0].split(":")[0];
          return d;
        }).filter(d => d && d.includes("."));
        await pgSaveOptions({ whitelistedSites: normalized });
      }, 600);
    };
    whitelistedSitesEl.addEventListener("input", scheduleWhitelistSave);
    whitelistedSitesEl.addEventListener("blur", scheduleWhitelistSave);
  }

  /* ── Proxy ── */
  const proxyEnabledEl = document.getElementById("proxyEnabled");
  const proxyTypeEl = document.getElementById("proxyType");
  const proxyHostEl = document.getElementById("proxyHost");
  const proxyPortEl = document.getElementById("proxyPort");
  const proxyUserEl = document.getElementById("proxyUsername");
  const proxyPassEl = document.getElementById("proxyPassword");
  const proxyDNSEl = document.getElementById("proxyDNS");

  async function saveProxy() {
    const enabled = proxyEnabledEl ? !!proxyEnabledEl.checked : false;
    const type = proxyTypeEl ? String(proxyTypeEl.value || "socks") : "socks";
    const host = proxyHostEl ? String(proxyHostEl.value || "").trim() : "";
    const port = proxyPortEl ? clamp(proxyPortEl.value, 1, 65535) : 1080;
    const user = proxyUserEl ? String(proxyUserEl.value || "") : "";
    const pass = proxyPassEl ? String(proxyPassEl.value || "") : "";
    const dns = proxyDNSEl ? !!proxyDNSEl.checked : true;
    if (proxyPortEl) proxyPortEl.value = String(port);
    await pgSaveOptions({
      proxyEnabled: enabled, proxyType: type, proxyHost: host,
      proxyPort: port, proxyUsername: user, proxyPassword: pass, proxyDNS: dns
    });
    setTimeout(pgLoadProxyStatus, 350);
  }

  if (proxyEnabledEl) proxyEnabledEl.addEventListener("change", saveProxy);
  if (proxyTypeEl) proxyTypeEl.addEventListener("change", saveProxy);
  if (proxyHostEl) proxyHostEl.addEventListener("blur", saveProxy);
  if (proxyPortEl) proxyPortEl.addEventListener("change", saveProxy);
  if (proxyUserEl) proxyUserEl.addEventListener("blur", saveProxy);
  if (proxyPassEl) proxyPassEl.addEventListener("blur", saveProxy);
  if (proxyDNSEl) proxyDNSEl.addEventListener("change", saveProxy);

  /* ── Adblock actions ── */
  const refreshBtn = document.getElementById("refreshAdblock");
  const statusEl = document.getElementById("adblockStatus");
  if (refreshBtn && statusEl) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      statusEl.textContent = "Updating blocklists…";
      try {
        const st = await pgUpdateAdblockLists();
        statusEl.textContent = pgFormatStatus(st);
        pgShowToast("Blocklists updated");
      } catch (e) {
        statusEl.textContent = "Update failed.";
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  const openTestBtn = document.getElementById("openCanYouBlockIt");
  if (openTestBtn) openTestBtn.addEventListener("click", () => browser.tabs.create({ url: "https://canyoublockit.com/extreme-test/" }));

  /* ── Clear Cookies ── */
  const clearCookiesBtn = document.getElementById("clearCookies");
  if (clearCookiesBtn) {
    clearCookiesBtn.addEventListener("click", async () => {
      const ok = confirm("Clear ALL cookies?\n\nThis will sign you out of most websites.");
      if (!ok) return;
      clearCookiesBtn.disabled = true;
      try {
        await pgClearAllCookies();
        pgShowToast("All cookies cleared");
      } catch (e) {
        console.error("Clear cookies failed:", e);
        alert("Failed to clear cookies.");
      } finally {
        clearCookiesBtn.disabled = false;
      }
    });
  }

  /* ── Export/Import ── */
  const exportSettingsBtn = document.getElementById("exportSettings");
  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener("click", async () => {
      try {
        const s = await pgGetSettings();
        const blob = new Blob([JSON.stringify({ version: PrivacyGuardConstants.VERSION, settings: s }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "privacyguard-settings-" + new Date().toISOString().slice(0, 10) + ".json";
        a.click();
        URL.revokeObjectURL(url);
        pgShowToast("Settings exported");
      } catch (e) {
        console.error("[PrivacyGuard] export settings failed", e);
        alert("Failed to export settings.");
      }
    });
  }

  const importSettingsBtn = document.getElementById("importSettings");
  const importSettingsFileEl = document.getElementById("importSettingsFile");
  if (importSettingsBtn && importSettingsFileEl) {
    importSettingsBtn.addEventListener("click", () => importSettingsFileEl.click());
    importSettingsFileEl.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsText(file);
        });
        const data = JSON.parse(text);
        const imported = data.settings && typeof data.settings === "object" ? data.settings : {};
        const defaults = PrivacyGuardConstants.DEFAULT_SETTINGS;
        const merged = Object.assign({}, defaults, imported);
        await pgSaveOptions(merged);
        await pgLoadOptions();
        pgShowToast("Settings imported successfully");
      } catch (err) {
        console.error("[PrivacyGuard] import settings failed", err);
        alert("Failed to import settings. Check that the file is valid JSON.");
      }
      importSettingsFileEl.value = "";
    });
  }

  /* ── Reset Stats ── */
  const resetStatsBtn = document.getElementById("resetStats");
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener("click", async () => {
      const ok = confirm("Reset all privacy statistics?\n\nThis will clear all counters.");
      if (!ok) return;
      resetStatsBtn.disabled = true;
      try {
        await browser.runtime.sendMessage({ type: "RESET_STATS" });
        await pgLoadPrivacyStats();
        pgShowToast("Statistics reset");
      } catch (e) {
        console.error("[PrivacyGuard] options: failed to reset stats", e);
        alert("Failed to reset statistics.");
      } finally {
        resetStatsBtn.disabled = false;
      }
    });
  }

  /* ── Storage change listeners ── */
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pg_proxy_status) pgLoadProxyStatus().catch(() => { });
    if (changes.pg_privacy_stats) pgLoadPrivacyStats().catch(() => { });
  });
});
