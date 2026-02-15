async function pgGetSettings() {
  return pgApiGetSettings();
}

async function pgSaveOptions(changes) {
  await pgApiSetSettings(changes);
}

async function pgGetAdblockStatus() {
  const res = await pgSendMessage({
    type: PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS
  });
  return res.status || null;
}

async function pgUpdateAdblockLists() {
  const res = await pgSendMessage({
    type: PrivacyGuardConstants.MSG.ADBLOCK_UPDATE
  });
  return res.status || null;
}

function pgFormatStatus(status) {
  if (!status) return "Adblock status unavailable.";
  const count = status.blockedDomains || 0;
  const allowCount = status.allowDomains || 0;
  const updated = status.lastUpdated ? new Date(status.lastUpdated).toLocaleString() : "never";
  const failures = status.sourcesFailed || 0;
  const duration = status.lastDurationMs ? ` - ${Math.round(status.lastDurationMs).toLocaleString()}ms` : "";
  const err = status.lastError ? ` - Error: ${status.lastError}` : "";
  const failNote = failures ? ` - ${failures} source(s) failed` : "";
  return `Blocked domains loaded: ${count.toLocaleString()} - Allowlist: ${allowCount.toLocaleString()} - Last updated: ${updated}${duration}${failNote}${err}`;
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

function pgParseDomainList(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  const seen = new Set();

  for (const line of lines) {
    const cleaned = String(line || "").split("#")[0].trim();
    if (!cleaned) continue;
    const host = pgNormalizeHostLine(cleaned);
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

  const blockTrackersEl = document.getElementById("blockTrackers");
  if (blockTrackersEl) blockTrackersEl.checked = !!s.blockTrackers;

  const adblockCustomBlocklistEl = document.getElementById("adblockCustomBlocklist");
  const adblockCustomAllowlistEl = document.getElementById("adblockCustomAllowlist");
  const adblockDisabledSitesEl = document.getElementById("adblockDisabledSites");
  const customBlocklist = Array.isArray(s.adblockCustomBlocklist) ? s.adblockCustomBlocklist : [];
  const customAllowlist = Array.isArray(s.adblockCustomAllowlist) ? s.adblockCustomAllowlist : [];
  const disabledSites = Array.isArray(s.adblockDisabledSites) ? s.adblockDisabledSites : [];
  if (adblockCustomBlocklistEl) adblockCustomBlocklistEl.value = customBlocklist.join("\n");
  if (adblockCustomAllowlistEl) adblockCustomAllowlistEl.value = customAllowlist.join("\n");
  if (adblockDisabledSitesEl) adblockDisabledSitesEl.value = disabledSites.join("\n");

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

  const manageReferrerEl = document.getElementById("manageReferrer");
  if (manageReferrerEl) manageReferrerEl.checked = !!s.manageReferrer;

  const referrerModeEl = document.getElementById("referrerMode");
  if (referrerModeEl) referrerModeEl.value = String(s.referrerMode || "no-referrer");

  const manageUserAgentEl = document.getElementById("manageUserAgent");
  if (manageUserAgentEl) manageUserAgentEl.checked = !!s.manageUserAgent;

  const userAgentModeEl = document.getElementById("userAgentMode");
  if (userAgentModeEl) {
    userAgentModeEl.value = String(s.userAgentMode || "random");
    const customContainer = document.getElementById("customUserAgentContainer");
    if (customContainer) {
      customContainer.style.display = userAgentModeEl.value === "custom" ? "block" : "none";
    }
  }

  const customUserAgentEl = document.getElementById("customUserAgent");
  if (customUserAgentEl) customUserAgentEl.value = String(s.customUserAgent || "");

  const blockThirdPartyCookiesEl = document.getElementById("blockThirdPartyCookies");
  if (blockThirdPartyCookiesEl) blockThirdPartyCookiesEl.checked = !!s.blockThirdPartyCookies;

  const autoDeleteCookiesEl = document.getElementById("autoDeleteCookies");
  if (autoDeleteCookiesEl) autoDeleteCookiesEl.checked = !!s.autoDeleteCookies;

  const cookieLifetimeEl = document.getElementById("cookieLifetime");
  if (cookieLifetimeEl) cookieLifetimeEl.value = String(s.cookieLifetime || "7d");

  const blockBeaconsEl = document.getElementById("blockBeacons");
  if (blockBeaconsEl) blockBeaconsEl.checked = !!s.blockBeacons;

  const blockWebRTCEl = document.getElementById("blockWebRTC");
  if (blockWebRTCEl) blockWebRTCEl.checked = !!s.blockWebRTC;

  const blockSocialWidgetsEl = document.getElementById("blockSocialWidgets");
  if (blockSocialWidgetsEl) blockSocialWidgetsEl.checked = !!s.blockSocialWidgets;

  const blockCryptoMinersEl = document.getElementById("blockCryptoMiners");
  if (blockCryptoMinersEl) blockCryptoMinersEl.checked = !!s.blockCryptoMiners;

  const disableHyperlinkAuditingEl = document.getElementById("disableHyperlinkAuditing");
  if (disableHyperlinkAuditingEl) disableHyperlinkAuditingEl.checked = s.disableHyperlinkAuditing !== false;

  const manageStorageEl = document.getElementById("manageStorage");
  if (manageStorageEl) manageStorageEl.checked = !!s.manageStorage;

  const storageModeEl = document.getElementById("storageMode");
  if (storageModeEl) storageModeEl.value = String(s.storageMode || "clear-on-close");

  const siteWhitelistEl = document.getElementById("siteWhitelist");
  if (siteWhitelistEl) siteWhitelistEl.checked = !!s.siteWhitelist;

  const whitelistedSitesEl = document.getElementById("whitelistedSites");
  const whitelistedSites = Array.isArray(s.whitelistedSites) ? s.whitelistedSites : [];
  if (whitelistedSitesEl) whitelistedSitesEl.value = whitelistedSites.join("\n");

  const requestTimeoutEl = document.getElementById("requestTimeout");
  if (requestTimeoutEl) requestTimeoutEl.checked = !!s.requestTimeout;

  const requestTimeoutMsEl = document.getElementById("requestTimeoutMs");
  if (requestTimeoutMsEl) requestTimeoutMsEl.value = String(s.requestTimeoutMs || 30000);

  const statusEl = document.getElementById("adblockStatus");
  if (statusEl) {
    const st = await pgGetAdblockStatus();
    statusEl.textContent = pgFormatStatus(st);
  }

  await pgLoadProxyStatus();
  await pgLoadPrivacyStats();
}

async function pgLoadPrivacyStats() {
  const statsEl = document.getElementById("privacyStats");
  if (!statsEl) return;

  try {
    const res = await pgSendMessage({ type: "GET_STATS" });
    if (res && res.stats) {
      const stats = res.stats;
      const total = (stats.blockedAds || 0) +
                    (stats.blockedBeacons || 0) +
                    (stats.blockedCookies || 0) +
                    (stats.blockedFingerprints || 0) +
                    (stats.blockedTrackers || 0) +
                    (stats.blockedCryptominers || 0);

      const lastReset = stats.lastReset ? new Date(stats.lastReset).toLocaleString() : "never";

      const lines = [
        `Total Blocked: ${total.toLocaleString()}`,
        `Ads Blocked: ${(stats.blockedAds || 0).toLocaleString()}`,
        `Trackers Blocked: ${(stats.blockedTrackers || 0).toLocaleString()}`,
        `Beacons Blocked: ${(stats.blockedBeacons || 0).toLocaleString()}`,
        `Cookies Blocked: ${(stats.blockedCookies || 0).toLocaleString()}`,
        `Fingerprints Blocked: ${(stats.blockedFingerprints || 0).toLocaleString()}`,
        `Crypto Miners Blocked: ${(stats.blockedCryptominers || 0).toLocaleString()}`,
        `URLs Cleaned: ${(stats.cleanedUrls || 0).toLocaleString()}`,
        `HTTPS Upgrades: ${(stats.upgradedHttps || 0).toLocaleString()}`,
        `Last reset: ${lastReset}`
      ];
      statsEl.textContent = lines.join("\n");
      statsEl.style.whiteSpace = "pre-line";
    } else {
      statsEl.textContent = "Statistics unavailable";
    }
  } catch (e) {
    console.error("[PrivacyGuard] options: failed to load stats", e);
    statsEl.textContent = "Failed to load statistics";
  }
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
  try {
    pgInitParticles();
    await pgLoadOptions();
  } catch (e) {
    console.error("[PrivacyGuard] options: initialization failed", e);
  }

  const enabledEl = document.getElementById("enabled");
  if (enabledEl) enabledEl.addEventListener("change", (e) => pgSaveOptions({ enabled: e.target.checked }));

  const blockAdsEl = document.getElementById("blockAds");
  if (blockAdsEl) blockAdsEl.addEventListener("change", (e) => pgSaveOptions({ blockAds: e.target.checked }));

  const blockTrackersEl = document.getElementById("blockTrackers");
  if (blockTrackersEl) blockTrackersEl.addEventListener("change", (e) => pgSaveOptions({ blockTrackers: e.target.checked }));

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

  if (adblockCustomBlocklistEl) {
    adblockCustomBlocklistEl.addEventListener("input", scheduleAdblockSave);
    adblockCustomBlocklistEl.addEventListener("blur", scheduleAdblockSave);
  }
  if (adblockCustomAllowlistEl) {
    adblockCustomAllowlistEl.addEventListener("input", scheduleAdblockSave);
    adblockCustomAllowlistEl.addEventListener("blur", scheduleAdblockSave);
  }
  if (adblockDisabledSitesEl) {
    adblockDisabledSitesEl.addEventListener("input", scheduleAdblockSave);
    adblockDisabledSitesEl.addEventListener("blur", scheduleAdblockSave);
  }

  const alwaysHttpsEl = document.getElementById("alwaysHTTPS");
  if (alwaysHttpsEl) alwaysHttpsEl.addEventListener("change", (e) => pgSaveOptions({ alwaysHTTPS: e.target.checked }));

  const stripEl = document.getElementById("stripUTMParams");
  if (stripEl) stripEl.addEventListener("change", (e) => pgSaveOptions({ stripUTMParams: e.target.checked }));

  const decoyToggleEl = document.getElementById("decoyTraffic");
  if (decoyToggleEl) decoyToggleEl.addEventListener("change", (e) => pgSaveOptions({ decoyTraffic: e.target.checked }));

  const antiFpEl = document.getElementById("antiFingerprint");
  if (antiFpEl) antiFpEl.addEventListener("change", (e) => pgSaveOptions({ antiFingerprint: e.target.checked }));

  const manageReferrerEl = document.getElementById("manageReferrer");
  if (manageReferrerEl) manageReferrerEl.addEventListener("change", (e) => pgSaveOptions({ manageReferrer: e.target.checked }));

  const referrerModeEl = document.getElementById("referrerMode");
  if (referrerModeEl) referrerModeEl.addEventListener("change", (e) => pgSaveOptions({ referrerMode: e.target.value }));

  const manageUserAgentEl = document.getElementById("manageUserAgent");
  if (manageUserAgentEl) manageUserAgentEl.addEventListener("change", (e) => pgSaveOptions({ manageUserAgent: e.target.checked }));

  const userAgentModeEl = document.getElementById("userAgentMode");
  if (userAgentModeEl) {
    userAgentModeEl.addEventListener("change", (e) => {
      const customContainer = document.getElementById("customUserAgentContainer");
      if (customContainer) {
        customContainer.style.display = e.target.value === "custom" ? "block" : "none";
      }
      pgSaveOptions({ userAgentMode: e.target.value });
    });
  }

  const customUserAgentEl = document.getElementById("customUserAgent");
  if (customUserAgentEl) {
    customUserAgentEl.addEventListener("blur", (e) => {
      pgSaveOptions({ customUserAgent: e.target.value });
    });
    customUserAgentEl.addEventListener("input", (e) => {
      clearTimeout(customUserAgentEl.saveTimer);
      customUserAgentEl.saveTimer = setTimeout(() => {
        pgSaveOptions({ customUserAgent: e.target.value });
      }, 600);
    });
  }

  const blockThirdPartyCookiesEl = document.getElementById("blockThirdPartyCookies");
  if (blockThirdPartyCookiesEl) blockThirdPartyCookiesEl.addEventListener("change", (e) => pgSaveOptions({ blockThirdPartyCookies: e.target.checked }));

  const autoDeleteCookiesEl = document.getElementById("autoDeleteCookies");
  if (autoDeleteCookiesEl) autoDeleteCookiesEl.addEventListener("change", (e) => pgSaveOptions({ autoDeleteCookies: e.target.checked }));

  const cookieLifetimeEl = document.getElementById("cookieLifetime");
  if (cookieLifetimeEl) {
    cookieLifetimeEl.addEventListener("blur", (e) => {
      const lifetime = e.target.value.trim();
      if (lifetime) {
        pgSaveOptions({ cookieLifetime: lifetime });
      }
    });
    cookieLifetimeEl.addEventListener("change", (e) => {
      const lifetime = e.target.value.trim();
      if (lifetime) {
        pgSaveOptions({ cookieLifetime: lifetime });
      }
    });
  }

  const blockBeaconsEl = document.getElementById("blockBeacons");
  if (blockBeaconsEl) blockBeaconsEl.addEventListener("change", (e) => pgSaveOptions({ blockBeacons: e.target.checked }));

  const blockWebRTCEl = document.getElementById("blockWebRTC");
  if (blockWebRTCEl) blockWebRTCEl.addEventListener("change", (e) => pgSaveOptions({ blockWebRTC: e.target.checked }));

  const blockSocialWidgetsEl = document.getElementById("blockSocialWidgets");
  if (blockSocialWidgetsEl) blockSocialWidgetsEl.addEventListener("change", (e) => pgSaveOptions({ blockSocialWidgets: e.target.checked }));

  const blockCryptoMinersEl = document.getElementById("blockCryptoMiners");
  if (blockCryptoMinersEl) blockCryptoMinersEl.addEventListener("change", (e) => pgSaveOptions({ blockCryptoMiners: e.target.checked }));

  const disableHyperlinkAuditingEl = document.getElementById("disableHyperlinkAuditing");
  if (disableHyperlinkAuditingEl) disableHyperlinkAuditingEl.addEventListener("change", (e) => pgSaveOptions({ disableHyperlinkAuditing: e.target.checked }));

  const manageStorageEl = document.getElementById("manageStorage");
  if (manageStorageEl) manageStorageEl.addEventListener("change", (e) => pgSaveOptions({ manageStorage: e.target.checked }));

  const storageModeEl = document.getElementById("storageMode");
  if (storageModeEl) storageModeEl.addEventListener("change", (e) => pgSaveOptions({ storageMode: e.target.value }));

  const siteWhitelistEl = document.getElementById("siteWhitelist");
  if (siteWhitelistEl) siteWhitelistEl.addEventListener("change", (e) => pgSaveOptions({ siteWhitelist: e.target.checked }));

  const whitelistedSitesEl = document.getElementById("whitelistedSites");
  let whitelistSaveTimer = null;
  if (whitelistedSitesEl) {
    function scheduleWhitelistSave() {
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
    }
    whitelistedSitesEl.addEventListener("input", scheduleWhitelistSave);
    whitelistedSitesEl.addEventListener("blur", scheduleWhitelistSave);
  }

  const requestTimeoutEl = document.getElementById("requestTimeout");
  if (requestTimeoutEl) requestTimeoutEl.addEventListener("change", (e) => pgSaveOptions({ requestTimeout: e.target.checked }));

  const requestTimeoutMsEl = document.getElementById("requestTimeoutMs");
  if (requestTimeoutMsEl) {
    requestTimeoutMsEl.addEventListener("change", (e) => {
      const ms = clamp(Number(e.target.value) || 30000, 1000, 300000);
      e.target.value = String(ms);
      pgSaveOptions({ requestTimeoutMs: ms });
    });
    requestTimeoutMsEl.addEventListener("blur", (e) => {
      const ms = clamp(Number(e.target.value) || 30000, 1000, 300000);
      e.target.value = String(ms);
      pgSaveOptions({ requestTimeoutMs: ms });
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

    minSec = clamp(
      minSec, 
      PrivacyGuardConstants.DECOY_MIN_INTERVAL_SECONDS, 
      PrivacyGuardConstants.DECOY_MAX_INTERVAL_SECONDS
    );
    maxSec = clamp(
      maxSec, 
      PrivacyGuardConstants.DECOY_MIN_INTERVAL_SECONDS, 
      PrivacyGuardConstants.DECOY_MAX_INTERVAL_SECONDS
    );
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
        alert("Settings imported successfully.");
      } catch (err) {
        console.error("[PrivacyGuard] import settings failed", err);
        alert("Failed to import settings. Check that the file is valid JSON.");
      }
      importSettingsFileEl.value = "";
    });
  }

  const resetStatsBtn = document.getElementById("resetStats");
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener("click", async () => {
      const ok = confirm("Reset all privacy statistics?\n\nThis will clear all counters.");
      if (!ok) return;

      resetStatsBtn.disabled = true;
      try {
        await pgSendMessage({ type: "RESET_STATS" });
        await pgLoadPrivacyStats();
      } catch (e) {
        console.error("[PrivacyGuard] options: failed to reset stats", e);
        alert("Failed to reset statistics.");
      } finally {
        resetStatsBtn.disabled = false;
      }
    });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pg_proxy_status) {
      pgLoadProxyStatus().catch(e => {
        console.error("[PrivacyGuard] options: failed to reload proxy status", e);
      });
    }
    if (changes.pg_privacy_stats) {
      pgLoadPrivacyStats().catch(e => {
        console.error("[PrivacyGuard] options: failed to reload privacy stats", e);
      });
    }
  });
});
