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

  const minStr = s.decoyMinInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval;
  const maxStr = s.decoyMaxInterval || PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval;

  const minEl = document.getElementById("decoyMinInterval");
  const maxEl = document.getElementById("decoyMaxInterval");
  if (minEl) minEl.value = String(minStr);
  if (maxEl) maxEl.value = String(maxStr);

  const sites = Array.isArray(s.decoySites) ? s.decoySites : [];
  const sitesEl = document.getElementById("decoySites");
  if (sitesEl) sitesEl.value = sites.join("\n");

  const statusEl = document.getElementById("adblockStatus");
  if (statusEl) {
    const st = await pgGetAdblockStatus();
    statusEl.textContent = pgFormatStatus(st);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await pgLoadOptions();

  const enabledEl = document.getElementById("enabled");
  if (enabledEl) {
    enabledEl.addEventListener("change", (e) => {
      pgSaveOptions({ enabled: e.target.checked });
    });
  }

  const blockAdsEl = document.getElementById("blockAds");
  if (blockAdsEl) {
    blockAdsEl.addEventListener("change", (e) => {
      pgSaveOptions({ blockAds: e.target.checked });
    });
  }

  const alwaysHttpsEl = document.getElementById("alwaysHTTPS");
  if (alwaysHttpsEl) {
    alwaysHttpsEl.addEventListener("change", (e) => {
      pgSaveOptions({ alwaysHTTPS: e.target.checked });
    });
  }

  const stripEl = document.getElementById("stripUTMParams");
  if (stripEl) {
    stripEl.addEventListener("change", (e) => {
      pgSaveOptions({ stripUTMParams: e.target.checked });
    });
  }

  const decoyToggleEl = document.getElementById("decoyTraffic");
  if (decoyToggleEl) {
    decoyToggleEl.addEventListener("change", (e) => {
      pgSaveOptions({ decoyTraffic: e.target.checked });
    });
  }

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

    await pgSaveOptions({
      decoyMinInterval: minCanonical,
      decoyMaxInterval: maxCanonical
    });
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
  if (openTestBtn) {
    openTestBtn.addEventListener("click", async () => {
      await browser.tabs.create({ url: "https://canyoublockit.com/extreme-test/" });
    });
  }

  const clearCookiesBtn = document.getElementById("clearCookies");
  if (clearCookiesBtn) {
    clearCookiesBtn.addEventListener("click", async () => {
      const ok = confirm("Clear ALL cookies?\n\nThis will sign you out of most websites.");
      if (!ok) return;

      clearCookiesBtn.disabled = true;

      try {
        await browser.browsingData.removeCookies({});
        alert("Cookies cleared.");
      } catch (e) {
        console.error("Clear cookies failed:", e);
        alert("Failed to clear cookies. Check console for details.");
      } finally {
        clearCookiesBtn.disabled = false;
      }
    });
  }
});
