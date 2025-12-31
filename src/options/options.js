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

function pgFormatStatus(status) {
  if (!status) return "Adblock status unavailable.";
  const count = status.blockedDomains || 0;
  const updated = status.lastUpdated ? new Date(status.lastUpdated).toLocaleString() : "never";
  const err = status.lastError ? ` • Error: ${status.lastError}` : "";
  return `Blocked domains loaded: ${count.toLocaleString()} • Last updated: ${updated}${err}`;
}

function pgNormalizeHostLine(line) {
  if (!line) return null;
  let s = String(line).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.split(":")[0];

  if (!s.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (s.includes("..")) return null;
  if (s === "localhost" || s === "127.0.0.1" || s === "::1") return null;

  return s;
}

function pgParseDecoySites(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  const seen = new Set();

  for (const line of lines) {
    const host = pgNormalizeHostLine(line);
    if (!host) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
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

function pgInitParticles() {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  if (!window.particlesJS) return;

  window.particlesJS("pgParticles", {
    particles: {
      number: { value: 42, density: { enable: true, value_area: 900 } },
      color: { value: "#ffffff" },
      shape: { type: "circle" },
      opacity: { value: 0.6, random: true },
      size: { value: 2.1, random: true },
      line_linked: { enable: true, distance: 160, color: "#ffffff", opacity: 0.4, width: 1 },
      move: { enable: true, speed: 1.0, direction: "none", random: false, straight: false, out_mode: "out" }
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
    },
    retina_detect: true
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  pgInitParticles();
  await pgLoadOptions();
});


async function pgLoadProxyStatus() {
  const el = document.getElementById("proxyStatus");
  if (!el) return;

  try {
    const obj = await browser.storage.local.get("pg_proxy_status");
    const st = obj ? obj.pg_proxy_status : null;

    if (!st) {
      el.textContent = "Proxy status: unknown";
      return;
    }

    const when = st.at ? new Date(st.at).toLocaleString() : "unknown time";
    if (st.applied) {
      const detail = st.detail ? ` (${st.detail})` : "";
      el.textContent = `Proxy status: applied • mode=${st.mode}${detail} • ${when}`;
    } else {
      const err = st.lastError ? ` • ${st.lastError}` : "";
      el.textContent = `Proxy status: not applied • mode=${st.mode} • ${when}${err}`;
    }
  } catch (e) {
    el.textContent = "Proxy status: unknown";
  }
}

async function pgLoadOptions() {
  const s = await pgGetSettings();

  const enabledEl = document.getElementById("enabled");
  if (enabledEl) enabledEl.checked = !!s.enabled;

  const blockAdsEl = document.getElementById("blockAds");
  if (blockAdsEl) blockAdsEl.checked = !!s.blockAds;

  const alwaysHttpsEl = document.getElementById("alwaysHTTPS");
  if (alwaysHttpsEl) alwaysHttpsEl.checked = !!s.alwaysHTTPS;

  const stripEl = document.getElementById("stripUTMParams");
  if (stripEl) stripEl.checked = !!s.stripUTMParams;

  const decoyToggleEl = document.getElementById("decoyTraffic");
  if (decoyToggleEl) decoyToggleEl.checked = !!s.decoyTraffic;

  const minEl = document.getElementById("decoyMinInterval");
  const maxEl = document.getElementById("decoyMaxInterval");
  if (minEl) minEl.value = String(s.decoyMinInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval);
  if (maxEl) maxEl.value = String(s.decoyMaxInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval);

  const sitesEl = document.getElementById("decoySites");
  const sites = Array.isArray(s.decoySites) ? s.decoySites : [];
  if (sitesEl) sitesEl.value = sites.join("\n");

  const proxyEnabledEl = document.getElementById("proxyEnabled");
  const proxyTypeEl = document.getElementById("proxyType");
  const proxyHostEl = document.getElementById("proxyHost");
  const proxyPortEl = document.getElementById("proxyPort");
  const proxyUserEl = document.getElementById("proxyUsername");
  const proxyPassEl = document.getElementById("proxyPassword");
  const proxyDNSEl = document.getElementById("proxyDNS");

  if (proxyEnabledEl) proxyEnabledEl.checked = !!s.proxyEnabled;
  if (proxyTypeEl) proxyTypeEl.value = String(s.proxyType || "socks");
  if (proxyHostEl) proxyHostEl.value = String(s.proxyHost || "");
  if (proxyPortEl) proxyPortEl.value = String(s.proxyPort || 1080);
  if (proxyUserEl) proxyUserEl.value = String(s.proxyUsername || "");
  if (proxyPassEl) proxyPassEl.value = String(s.proxyPassword || "");
  if (proxyDNSEl) proxyDNSEl.checked = !!s.proxyDNS;

  const antiFpEl = document.getElementById("antiFingerprint");
  if (antiFpEl) antiFpEl.checked = !!s.antiFingerprint;

  const statusEl = document.getElementById("adblockStatus");
  if (statusEl) {
    const st = await pgGetAdblockStatus();
    statusEl.textContent = pgFormatStatus(st);
  }

  await pgLoadProxyStatus();
}

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

document.addEventListener("DOMContentLoaded", async () => {
  await pgLoadOptions();

  const enabledEl = document.getElementById("enabled");
  if (enabledEl) enabledEl.addEventListener("change", (e) => pgSaveOptions({ enabled: e.target.checked }));

  const blockAdsEl = document.getElementById("blockAds");
  if (blockAdsEl) blockAdsEl.addEventListener("change", (e) => pgSaveOptions({ blockAds: e.target.checked }));

  const alwaysHttpsEl = document.getElementById("alwaysHTTPS");
  if (alwaysHttpsEl) alwaysHttpsEl.addEventListener("change", (e) => pgSaveOptions({ alwaysHTTPS: e.target.checked }));

  const stripEl = document.getElementById("stripUTMParams");
  if (stripEl) stripEl.addEventListener("change", (e) => pgSaveOptions({ stripUTMParams: e.target.checked }));

  const decoyToggleEl = document.getElementById("decoyTraffic");
  if (decoyToggleEl) decoyToggleEl.addEventListener("change", (e) => pgSaveOptions({ decoyTraffic: e.target.checked }));

  const antiFpEl = document.getElementById("antiFingerprint");
  if (antiFpEl) antiFpEl.addEventListener("change", (e) => pgSaveOptions({ antiFingerprint: e.target.checked }));

  const minEl = document.getElementById("decoyMinInterval");
  const maxEl = document.getElementById("decoyMaxInterval");

  async function saveIntervals() {
    if (!minEl || !maxEl) return;

    let minSec = pgParseDurationToSeconds(minEl.value);
    let maxSec = pgParseDurationToSeconds(maxEl.value);

    if (minSec === null) minSec = pgParseDurationToSeconds(PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval);
    if (maxSec === null) maxSec = pgParseDurationToSeconds(PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval);

    minSec = clamp(minSec, 1, 7 * 86400);
    maxSec = clamp(maxSec, 1, 7 * 86400);
    if (maxSec < minSec) maxSec = minSec;

    const minCanonical = pgFormatSecondsCanonical(minSec);
    const maxCanonical = pgFormatSecondsCanonical(maxSec);

    minEl.value = minCanonical;
    maxEl.value = maxCanonical;

    await pgSaveOptions({ decoyMinInterval: minCanonical, decoyMaxInterval: maxCanonical });
  }

  if (minEl && maxEl) {
    minEl.addEventListener("change", saveIntervals);
    maxEl.addEventListener("change", saveIntervals);
    minEl.addEventListener("blur", saveIntervals);
    maxEl.addEventListener("blur", saveIntervals);
  }

  const sitesEl = document.getElementById("decoySites");
  let sitesSaveTimer = null;

  function scheduleSitesSave() {
    if (!sitesEl) return;
    clearTimeout(sitesSaveTimer);
    sitesSaveTimer = setTimeout(async () => {
      const parsed = pgParseDecoySites(sitesEl.value);
      await pgSaveOptions({ decoySites: parsed });
    }, 600);
  }

  if (sitesEl) {
    sitesEl.addEventListener("input", scheduleSitesSave);
    sitesEl.addEventListener("blur", scheduleSitesSave);
  }

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
      proxyEnabled: enabled,
      proxyType: type,
      proxyHost: host,
      proxyPort: port,
      proxyUsername: user,
      proxyPassword: pass,
      proxyDNS: dns
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

  const refreshBtn = document.getElementById("refreshAdblock");
  const statusEl = document.getElementById("adblockStatus");

  if (refreshBtn && statusEl) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      statusEl.textContent = "Updating blocklists…";
      try {
        const st = await pgUpdateAdblockLists();
        statusEl.textContent = pgFormatStatus(st);
      } catch (e) {
        statusEl.textContent = "Update failed.";
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  const openTestBtn = document.getElementById("openCanYouBlockIt");
  if (openTestBtn) openTestBtn.addEventListener("click", async () => browser.tabs.create({ url: "https://canyoublockit.com/extreme-test/" }));

  const clearCookiesBtn = document.getElementById("clearCookies");
  if (clearCookiesBtn) {
    clearCookiesBtn.addEventListener("click", async () => {
      const ok = confirm("Clear ALL cookies?\n\nThis will sign you out of most websites.");
      if (!ok) return;

      clearCookiesBtn.disabled = true;

      try {
        await pgClearAllCookies();
        alert("Cookies cleared.");
      } catch (e) {
        console.error("Clear cookies failed:", e);
        alert("Failed to clear cookies. Check console for details.");
      } finally {
        clearCookiesBtn.disabled = false;
      }
    });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pg_proxy_status) pgLoadProxyStatus();
  });
});
