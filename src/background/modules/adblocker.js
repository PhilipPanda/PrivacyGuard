console.log("[PrivacyGuard] module loaded: adblocker");

const PG_ADBLOCK_ALARM_NAME = "pg-adblock-update";
const PG_ADBLOCK_DECISION_CACHE_MAX = 5000;

let pgAdblockSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

let pgAdblockDomains = new Set();
let pgAdblockAllow = new Set();
let pgAdblockCustomBlock = new Set();
let pgAdblockCustomAllow = new Set();
let pgAdblockDisabledSites = new Set();
let pgAdblockDecisionCache = new Map();

const pgAdblockStatus = {
  ready: false,
  blockedDomains: 0,
  allowDomains: 0,
  sources: [],
  sourcesFailed: 0,
  lastUpdated: null,
  lastDurationMs: 0,
  lastError: null,
  errors: []
};

const PG_ADBLOCK_ALWAYS_ALLOW = new Set([
  "canyoublockit.com",
  "www.canyoublockit.com"
]);

const PG_TRACKER_DOMAINS = new Set([
  "doubleclick.net", "googleadservices.com", "googlesyndication.com",
  "google-analytics.com", "googletagmanager.com",
  "scorecardresearch.com", "quantserve.com", "outbrain.com",
  "taboola.com", "criteo.com", "rubiconproject.com",
  "pubmatic.com", "openx.net", "adsrvr.org", "adtech.com",
  "facebook.com", "facebook.net", "fbcdn.net", "analytics.facebook.com",
  "connect.facebook.net", "pixel.facebook.com",
  "advertising.com", "adnxs.com", "adform.net", "adtechus.com",
  "amazon-adsystem.com", "adsystem.amazon.com",
  "adservice.google.com", "ad.doubleclick.net",
  "adsafeprotected.com"
]);

const PG_TRACKER_LABEL_HINTS = [
  "track", "tracking", "tracker", "analytics", "metric", "metrics",
  "measure", "monitor", "pixel", "beacon", "collect", "log", "logger",
  "stats", "stat", "telemetry", "insight", "event", "profil", "fingerprint"
];

const PG_TRACKER_AGGRESSIVE_TYPES = new Set([
  "beacon", "ping", "xmlhttprequest", "fetch"
]);

(async () => {
  try {
    pgAdblockSettings = await pgGetSettings();
    pgRefreshSettingsCaches();
  } catch (e) {
    console.warn("[PrivacyGuard] adblocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;

  if (changes[key] && changes[key].newValue) {
    pgAdblockSettings = Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      changes[key].newValue
    );
    pgRefreshSettingsCaches();
  }
});

function pgResetDecisionCache() {
  pgAdblockDecisionCache = new Map();
}

function pgLooksLikeDomain(s) {
  if (!s) return false;
  s = s.trim().toLowerCase();

  if (s.includes(" ") || !s.includes(".")) return false;
  if (/^[0-9.]+$/.test(s)) return false;

  if (s.endsWith(".")) s = s.slice(0, -1);

  if (!/^[a-z0-9.-]+$/.test(s)) return false;
  if (s.startsWith("-") || s.endsWith("-")) return false;
  if (s.includes("..")) return false;

  return true;
}

function pgNormalizeDomain(domain) {
  if (!domain) return null;
  let d = String(domain).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  d = d.split("#")[0];
  d = d.split(":")[0];
  if (d.endsWith(".")) d = d.slice(0, -1);
  return d;
}

function pgIsLocalish(domain) {
  return (
    domain === "localhost" ||
    domain === "localhost.localdomain" ||
    domain === "local" ||
    domain === "broadcasthost" ||
    domain === "127.0.0.1" ||
    domain === "::1"
  );
}

function pgIsIpLike(s) {
  if (!s) return false;
  if (s.includes(":")) return true;
  return /^[0-9.]+$/.test(s);
}

function pgAddDomainToSet(setObj, domain) {
  const normalized = pgNormalizeDomain(domain);
  if (!normalized) return;
  if (pgIsLocalish(normalized)) return;
  if (!pgLooksLikeDomain(normalized)) return;
  setObj.add(normalized);
}

function pgParseHostsLike(text, addFn) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const noComment = line.split("#")[0].trim();
    if (!noComment) continue;

    const parts = noComment.split(/\s+/);

    if (parts.length === 1) {
      addFn(parts[0]);
      continue;
    }

    const maybeIp = parts[0];
    const host = parts[1];

    if (!pgIsIpLike(maybeIp)) {
      addFn(maybeIp);
      continue;
    }

    addFn(host);
  }
}

function pgParseAdblockNetworkRules(text, addBlocked, addAllowed) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    let line = lineRaw.trim();
    if (!line) continue;

    if (line.startsWith("!") || line.startsWith("[")) continue;

    if (line.includes("##") || line.includes("#@#")) continue;

    if (line.startsWith("/") && line.endsWith("/")) continue;

    if (line.startsWith("@@||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(4));
      if (domain) addAllowed(domain);
      continue;
    }

    if (line.startsWith("||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(2));
      if (domain) addBlocked(domain);
      continue;
    }

    if (line.startsWith("|http://") || line.startsWith("|https://")) {
      line = line.slice(1);
    }
    if (line.startsWith("http://") || line.startsWith("https://")) {
      try {
        const u = new URL(line.split("$")[0]);
        if (u.hostname) addBlocked(u.hostname);
      } catch (e) {}
      continue;
    }
  }
}

function pgExtractDomainFromDoublePipe(rest) {
  let s = rest.split("$")[0];

  const caretIdx = s.indexOf("^");
  if (caretIdx >= 0) s = s.slice(0, caretIdx);

  const slashIdx = s.indexOf("/");
  if (slashIdx >= 0) s = s.slice(0, slashIdx);

  s = s.trim();

  if (!s || s.includes("*")) return null;

  return s;
}

function pgHostMatchesSet(host, setObj) {
  if (!host) return false;
  const h = host.toLowerCase();

  if (setObj.has(h)) return true;

  let cur = h;
  while (true) {
    const idx = cur.indexOf(".");
    if (idx < 0) break;
    cur = cur.slice(idx + 1);
    if (setObj.has(cur)) return true;
  }

  return false;
}

function pgIsAlwaysAllowed(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();

  if (PG_ADBLOCK_ALWAYS_ALLOW.has(h)) return true;

  for (const allowed of PG_ADBLOCK_ALWAYS_ALLOW) {
    if (h === allowed || h.endsWith("." + allowed)) {
      return true;
    }
  }

  return false;
}

function pgIsAllowedHost(hostname) {
  if (!hostname) return false;
  return pgHostMatchesSet(hostname, pgAdblockAllow) || pgHostMatchesSet(hostname, pgAdblockCustomAllow);
}

function pgIsBlockedHost(hostname) {
  if (!hostname) return false;

  if (pgIsAllowedHost(hostname)) return false;

  if (pgHostMatchesSet(hostname, pgAdblockCustomBlock)) return true;
  return pgHostMatchesSet(hostname, pgAdblockDomains);
}

function pgLooksLikeTrackerLabel(label) {
  const s = label.toLowerCase();
  for (const hint of PG_TRACKER_LABEL_HINTS) {
    if (s === hint) return true;
    if (s.startsWith(hint + "-") || s.endsWith("-" + hint)) return true;
    if (s.includes("-" + hint + "-")) return true;
  }
  return false;
}

function pgIsTrackerDomain(hostname, requestType) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();

  for (const domain of PG_TRACKER_DOMAINS) {
    if (h === domain || h.endsWith("." + domain)) {
      return true;
    }
  }

  const labels = h.split(".");
  for (const label of labels) {
    if (pgLooksLikeTrackerLabel(label)) return true;
  }

  if (requestType && PG_TRACKER_AGGRESSIVE_TYPES.has(requestType)) {
    for (const label of labels) {
      if (label.includes("track") || label.includes("pixel") || label.includes("beacon")) {
        return true;
      }
    }
  }

  return false;
}

function pgGetPageHostname(details) {
  if (!details) return null;
  const pageUrl = details.documentUrl || details.initiator || details.originUrl;
  if (!pageUrl) return null;

  try {
    return new URL(pageUrl).hostname.toLowerCase();
  } catch (e) {
    return null;
  }
}

function pgIsAdblockDisabledForPage(pageHost) {
  if (!pageHost) return false;
  return pgHostMatchesSet(pageHost, pgAdblockDisabledSites);
}

function pgGetDecision(hostname, requestType) {
  if (!hostname) return { blocked: false, isTracker: false };

  const cached = pgAdblockDecisionCache.get(hostname);
  if (cached) return cached;

  const isTracker = pgIsTrackerDomain(hostname, requestType);
  const blocked = pgIsBlockedHost(hostname);
  const decision = { blocked, isTracker };

  pgAdblockDecisionCache.set(hostname, decision);
  if (pgAdblockDecisionCache.size > PG_ADBLOCK_DECISION_CACHE_MAX) {
    const firstKey = pgAdblockDecisionCache.keys().next().value;
    if (firstKey) pgAdblockDecisionCache.delete(firstKey);
  }

  return decision;
}

function pgRefreshSettingsCaches() {
  const settings = pgAdblockSettings || {};

  const customBlock = new Set();
  const customAllow = new Set();
  const disabledSites = new Set();

  const blocklist = Array.isArray(settings.adblockCustomBlocklist) ? settings.adblockCustomBlocklist : [];
  const allowlist = Array.isArray(settings.adblockCustomAllowlist) ? settings.adblockCustomAllowlist : [];
  const disabled = Array.isArray(settings.adblockDisabledSites) ? settings.adblockDisabledSites : [];

  for (const domain of blocklist) {
    pgAddDomainToSet(customBlock, domain);
  }
  for (const domain of allowlist) {
    pgAddDomainToSet(customAllow, domain);
  }
  for (const domain of disabled) {
    pgAddDomainToSet(disabledSites, domain);
  }

  pgAdblockCustomBlock = customBlock;
  pgAdblockCustomAllow = customAllow;
  pgAdblockDisabledSites = disabledSites;

  if ((customBlock.size + customAllow.size) > 0) {
    pgAdblockStatus.ready = true;
  }

  pgResetDecisionCache();
}

async function pgFetchText(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PrivacyGuardConstants.ADBLOCK_FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Fetch failed: ${url} (${res.status})`);
    }

    return await res.text();
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(`Fetch timeout: ${url}`);
    }
    throw e;
  }
}

async function pgAdblockUpdateLists() {
  const sources = PrivacyGuardConstants.ADBLOCK_SOURCES.slice();
  const startAt = Date.now();
  pgAdblockStatus.sources = sources;
  pgAdblockStatus.lastError = null;
  pgAdblockStatus.errors = [];
  pgAdblockStatus.sourcesFailed = 0;

  const newBlocked = new Set();
  const newAllow = new Set();

  const oldBlocked = pgAdblockDomains;
  const oldAllow = pgAdblockAllow;

  const errors = [];

  try {
    for (const url of sources) {
      try {
        const txt = await pgFetchText(url);
        if (!txt || typeof txt !== "string") {
          errors.push(`Invalid response from ${url}`);
          continue;
        }

        pgParseHostsLike(txt, (d) => pgAddDomainToSet(newBlocked, d));
        pgParseAdblockNetworkRules(txt, (d) => pgAddDomainToSet(newBlocked, d), (d) => pgAddDomainToSet(newAllow, d));
      } catch (e) {
        const errorMsg = String(e && e.message ? e.message : e);
        errors.push(`${url}: ${errorMsg}`);
        console.warn("[PrivacyGuard] adblocker: failed to fetch/parse", url, e);
      }
    }

    if (newBlocked.size > 0 || newAllow.size > 0 || errors.length === 0) {
      pgAdblockDomains = newBlocked;
      pgAdblockAllow = newAllow;

      pgAdblockStatus.ready = true;
      pgAdblockStatus.blockedDomains = pgAdblockDomains.size;
      pgAdblockStatus.allowDomains = pgAdblockAllow.size;
      pgAdblockStatus.lastUpdated = new Date().toISOString();
      pgAdblockStatus.lastDurationMs = Date.now() - startAt;
      pgAdblockStatus.sourcesFailed = errors.length;
      pgAdblockStatus.errors = errors.slice(0, 5);

      if (errors.length > 0) {
        pgAdblockStatus.lastError = `Partial update: ${errors.length} source(s) failed`;
      }

      pgResetDecisionCache();

      console.log("[PrivacyGuard] adblock updated:", pgAdblockDomains.size, "blocked /", pgAdblockAllow.size, "allowed");
    } else {
      pgAdblockDomains = oldBlocked;
      pgAdblockAllow = oldAllow;
      pgAdblockStatus.lastError = `All sources failed: ${errors.join("; ")}`;
      throw new Error(pgAdblockStatus.lastError);
    }

    return pgAdblockGetStatus();
  } catch (e) {
    pgAdblockDomains = oldBlocked;
    pgAdblockAllow = oldAllow;

    pgAdblockStatus.lastError = String(e && e.message ? e.message : e);
    pgAdblockStatus.lastDurationMs = Date.now() - startAt;
    pgAdblockStatus.sourcesFailed = errors.length;
    pgAdblockStatus.errors = errors.slice(0, 5);
    console.warn("[PrivacyGuard] adblock update failed:", e);

    return pgAdblockGetStatus();
  }
}

function pgAdblockGetStatus() {
  return Object.assign({}, pgAdblockStatus, {
    blockedDomains: pgAdblockDomains.size,
    allowDomains: pgAdblockAllow.size,
    customBlocked: pgAdblockCustomBlock.size,
    customAllowed: pgAdblockCustomAllow.size,
    disabledSites: pgAdblockDisabledSites.size
  });
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      const s = pgAdblockSettings;
      if (!s || !s.enabled) return {};
      if (!s.blockAds && !s.blockTrackers) return {};

      if (!pgAdblockStatus.ready && pgAdblockCustomBlock.size === 0 && pgAdblockCustomAllow.size === 0) {
        return {};
      }

      if (details.type === "main_frame") return {};

      if (!details.url || (!details.url.startsWith("http://") && !details.url.startsWith("https://"))) {
        return {};
      }

      const u = new URL(details.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return {};

      const hostname = u.hostname.toLowerCase();

      if (pgIsLocalish(hostname)) return {};

      const pageHost = pgGetPageHostname(details);
      if (pageHost) {
        if (pgIsAdblockDisabledForPage(pageHost)) return {};
        if (typeof pgIsWhitelistedHostname === "function" && pgIsWhitelistedHostname(pageHost)) {
          return {};
        }
      }

      if (typeof pgIsWhitelistedHostname === "function" && pgIsWhitelistedHostname(hostname)) {
        return {};
      }

      if (pgIsAlwaysAllowed(hostname)) {
        return {};
      }

      if (pgIsAllowedHost(hostname)) {
        return {};
      }

      const decision = pgGetDecision(hostname, details.type);
      const blockAds = !!s.blockAds;
      const blockTrackers = !!s.blockTrackers;

      if (blockTrackers && decision.isTracker) {
        console.log("[PrivacyGuard] adblocker: blocked tracker", details.type, details.url);
        if (typeof pgIncrementStat === "function") {
          pgIncrementStat("blockedTrackers");
        }
        return { cancel: true };
      }

      if (blockAds && decision.blocked && !decision.isTracker) {
        console.log("[PrivacyGuard] adblocker: blocked ad", details.type, details.url);
        if (typeof pgIncrementStat === "function") {
          pgIncrementStat("blockedAds");
        }
        return { cancel: true };
      }
    } catch (e) {
      console.warn("[PrivacyGuard] adblocker: error checking URL", details && details.url, e);
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

function pgEnsureAdblockAlarm() {
  try {
    browser.alarms.create(PG_ADBLOCK_ALARM_NAME, {
      periodInMinutes: PrivacyGuardConstants.ADBLOCK_UPDATE_INTERVAL_MINUTES
    });
  } catch (e) {
    console.warn("[PrivacyGuard] adblocker: failed to create alarm", e);
  }
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm && alarm.name === PG_ADBLOCK_ALARM_NAME) {
    try {
      await pgAdblockUpdateLists();
    } catch (e) {
      console.error("[PrivacyGuard] adblocker: alarm update failed", e);
    }
  }
});

pgEnsureAdblockAlarm();
pgAdblockUpdateLists();
