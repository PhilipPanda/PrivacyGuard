console.log("[PrivacyGuard] module loaded: adblocker");

var pgAdblockSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var pgAdblockDomains = new Set();   

var pgAdblockAllow = new Set();     

var pgAdblockStatus = {
  ready: false,
  blockedDomains: 0,
  allowDomains: 0,
  sources: [],
  lastUpdated: null,
  lastError: null
};

var PG_ADBLOCK_ALARM_NAME = "pg-adblock-update";

(async () => {
  try {
    pgAdblockSettings = await pgGetSettings();
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
  }
});

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
  domain = domain.trim().toLowerCase();
  if (domain.endsWith(".")) domain = domain.slice(0, -1);
  return domain;
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

function pgAddBlockedDomain(domain) {
  domain = pgNormalizeDomain(domain);
  if (!domain) return;
  if (pgIsLocalish(domain)) return;
  if (!pgLooksLikeDomain(domain)) return;
  pgAdblockDomains.add(domain);
}

function pgAddAllowedDomain(domain) {
  domain = pgNormalizeDomain(domain);
  if (!domain) return;
  if (pgIsLocalish(domain)) return;
  if (!pgLooksLikeDomain(domain)) return;
  pgAdblockAllow.add(domain);
}

function pgParseHostsLike(text) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const noComment = line.split("#")[0].trim();
    if (!noComment) continue;

    const parts = noComment.split(/\s+/);

    if (parts.length === 1) {
      pgAddBlockedDomain(parts[0]);
      continue;
    }

    const maybeIp = parts[0];
    const host = parts[1];

    if (!/^[0-9.]+$/.test(maybeIp) && maybeIp !== "::1") {
      pgAddBlockedDomain(maybeIp);
      continue;
    }

    pgAddBlockedDomain(host);
  }
}

function pgParseAdblockNetworkRules(text) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    let line = lineRaw.trim();
    if (!line) continue;

    if (line.startsWith("!") || line.startsWith("[")) continue;

    if (line.includes("##") || line.includes("#@#")) continue;

    if (line.startsWith("/") && line.endsWith("/")) continue;

    if (line.startsWith("@@||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(4));
      if (domain) pgAddAllowedDomain(domain);
      continue;
    }

    if (line.startsWith("||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(2));
      if (domain) pgAddBlockedDomain(domain);
      continue;
    }

    if (line.startsWith("|http://") || line.startsWith("|https://")) {
      line = line.slice(1);
    }
    if (line.startsWith("http://") || line.startsWith("https://")) {
      try {
        const u = new URL(line.split("$")[0]);
        if (u.hostname) pgAddBlockedDomain(u.hostname);
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
    if (e.name === "AbortError") {
      throw new Error(`Fetch timeout: ${url}`);
    }
    throw e;
  }
}

async function pgAdblockUpdateLists() {
  const sources = PrivacyGuardConstants.ADBLOCK_SOURCES.slice();
  pgAdblockStatus.sources = sources;
  pgAdblockStatus.lastError = null;

  const newBlocked = new Set();
  const newAllow = new Set();

  const oldBlocked = pgAdblockDomains;
  const oldAllow = pgAdblockAllow;
  pgAdblockDomains = newBlocked;
  pgAdblockAllow = newAllow;

  const errors = [];
  
  try {
    for (const url of sources) {
      try {
        const txt = await pgFetchText(url);
        if (!txt || typeof txt !== "string") {
          errors.push(`Invalid response from ${url}`);
          continue;
        }
        
        pgParseHostsLike(txt);
        pgParseAdblockNetworkRules(txt);
      } catch (e) {
        const errorMsg = String(e && e.message ? e.message : e);
        errors.push(`${url}: ${errorMsg}`);
        console.warn("[PrivacyGuard] adblocker: failed to fetch/parse", url, e);
      }
    }

    // Only update if we got at least some data
    if (newBlocked.size > 0 || newAllow.size > 0 || errors.length === 0) {
      pgAdblockDomains = newBlocked;
      pgAdblockAllow = newAllow;

      pgAdblockStatus.ready = true;
      pgAdblockStatus.blockedDomains = pgAdblockDomains.size;
      pgAdblockStatus.allowDomains = pgAdblockAllow.size;
      pgAdblockStatus.lastUpdated = new Date().toISOString();
      
      if (errors.length > 0) {
        pgAdblockStatus.lastError = `Partial update: ${errors.length} source(s) failed`;
      }

      console.log("[PrivacyGuard] adblock updated:", pgAdblockDomains.size, "blocked /", pgAdblockAllow.size, "allowed");
    } else {
      // Restore old data if all sources failed
      pgAdblockDomains = oldBlocked;
      pgAdblockAllow = oldAllow;
      pgAdblockStatus.lastError = `All sources failed: ${errors.join("; ")}`;
      throw new Error(pgAdblockStatus.lastError);
    }

    return pgAdblockGetStatus();
  } catch (e) {
    // Restore old data on complete failure
    pgAdblockDomains = oldBlocked;
    pgAdblockAllow = oldAllow;

    pgAdblockStatus.lastError = String(e && e.message ? e.message : e);
    console.warn("[PrivacyGuard] adblock update failed:", e);

    return pgAdblockGetStatus();
  }
}

function pgAdblockGetStatus() {
  return Object.assign({}, pgAdblockStatus, {
    blockedDomains: pgAdblockDomains.size,
    allowDomains: pgAdblockAllow.size
  });
}

function pgHostMatchesSet(host, setObj) {
  if (!host) return false;
  host = host.toLowerCase();

  if (setObj.has(host)) return true;

  let cur = host;
  while (true) {
    const idx = cur.indexOf(".");
    if (idx < 0) break;
    cur = cur.slice(idx + 1);
    if (setObj.has(cur)) return true;
  }

  return false;
}

function pgIsBlockedHost(host) {

  if (pgHostMatchesSet(host, pgAdblockAllow)) return false;
  return pgHostMatchesSet(host, pgAdblockDomains);
}

// Hardcoded allow list for sites that need all their resources
var PG_ADBLOCK_ALWAYS_ALLOW = new Set([
  "canyoublockit.com",
  "www.canyoublockit.com"
]);

function pgIsAlwaysAllowed(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  
  // Check exact match
  if (PG_ADBLOCK_ALWAYS_ALLOW.has(hostname)) return true;
  
  // Check subdomain matches
  for (const allowed of PG_ADBLOCK_ALWAYS_ALLOW) {
    if (hostname === allowed || hostname.endsWith("." + allowed)) {
      return true;
    }
  }
  
  return false;
}

var PG_TRACKER_DOMAINS = [
  "doubleclick.net", "googleadservices.com", "googlesyndication.com",
  "google-analytics.com", "googletagmanager.com", "google-analytics.com",
  "scorecardresearch.com", "quantserve.com", "outbrain.com",
  "taboola.com", "criteo.com", "rubiconproject.com",
  "pubmatic.com", "openx.net", "adsrvr.org", "adtech.com",
  "facebook.com", "facebook.net", "fbcdn.net", "analytics.facebook.com",
  "connect.facebook.net", "pixel.facebook.com",
  "advertising.com", "adnxs.com", "adform.net", "adtechus.com",
  "amazon-adsystem.com", "adsystem.amazon.com",
  "adservice.google.com", "ad.doubleclick.net",
  "adsafeprotected.com", "advertising.com"
];

function pgIsTrackerDomain(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  
  for (const domain of PG_TRACKER_DOMAINS) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return true;
    }
  }
  
  const trackerPatterns = [
    "track", "tracking", "tracker", "analytics", "metrics",
    "measure", "monitor", "pixel", "beacon", "collect",
    "log", "logger", "stats", "statistics"
  ];
  
  for (const pattern of trackerPatterns) {
    if (hostname.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      const s = pgAdblockSettings;
      if (!s || !s.enabled) return {};
      if (!s.blockAds && !s.blockTrackers) return {};

      // Only block if adblock is ready
      if (!pgAdblockStatus.ready) return {};

      // NEVER block main_frame requests (the actual page)
      if (details.type === "main_frame") return {};

      // Skip non-HTTP(S) requests
      if (!details.url || (!details.url.startsWith("http://") && !details.url.startsWith("https://"))) {
        return {};
      }

      const u = new URL(details.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return {};

      const hostname = u.hostname.toLowerCase();
      
      // Skip localhost and local IPs
      if (pgIsLocalish(hostname)) return {};

      if (typeof pgIsWhitelistedHostname === "function" && pgIsWhitelistedHostname(hostname)) {
        return {};
      }

      if (pgIsAlwaysAllowed(hostname)) {
        return {};
      }

      if (pgHostMatchesSet(hostname, pgAdblockAllow)) {
        return {};
      }

      // Then check block list
      if (pgIsBlockedHost(hostname)) {
        const isTracker = pgIsTrackerDomain(hostname);
        const shouldBlock = (s.blockAds && !isTracker) || (s.blockTrackers && isTracker) || (s.blockAds && s.blockTrackers);
        
        if (shouldBlock) {
          console.log("[PrivacyGuard] adblocker: blocked", isTracker ? "tracker" : "ad", details.type, details.url);
          if (typeof pgIncrementStat === "function") {
            if (isTracker) {
              pgIncrementStat("blockedTrackers");
            } else {
              pgIncrementStat("blockedAds");
            }
          }
          return { cancel: true };
        }
      }
    } catch (e) {
      // Silently fail to avoid breaking page loads
      console.warn("[PrivacyGuard] adblocker: error checking URL", details.url, e);
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

