console.log("[PrivacyGuard] module loaded: beacon_blocker");

var pgBeaconSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgBeaconSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] beacon_blocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgBeaconSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldBlockBeacons() {
  return !!(pgBeaconSettings && pgBeaconSettings.enabled && pgBeaconSettings.blockBeacons);
}

var PG_BEACON_PATHS = [
  "/beacon",
  "/track",
  "/tracking",
  "/pixel",
  "/analytics",
  "/collect",
  "/event",
  "/log",
  "/logger",
  "/stats",
  "/statistics",
  "/metrics",
  "/measure",
  "/monitor",
  "/ping",
  "/hit",
  "/pageview",
  "/pageview.gif",
  "/1x1.gif",
  "/1x1.png",
  "/clear.gif",
  "/transparent.gif",
  "/spacer.gif",
  "/fbq",
  "/tr",
  "/gtm",
  "/ga",
  "/g/collect",
  "/r/collect"
];

var PG_BEACON_DOMAINS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "googleadservices.com",
  "facebook.com",
  "facebook.net",
  "fbcdn.net",
  "analytics.facebook.com",
  "connect.facebook.net",
  "pixel.facebook.com",
  "adsafeprotected.com",
  "advertising.com",
  "adnxs.com",
  "adform.net",
  "adtechus.com",
  "advertising.com",
  "amazon-adsystem.com",
  "adsystem.amazon.com",
  "adservice.google.com",
  "googlesyndication.com",
  "scorecardresearch.com",
  "quantserve.com",
  "outbrain.com",
  "taboola.com",
  "criteo.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "adsrvr.org",
  "adtech.com"
];

function pgIsBeaconDomain(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  
  for (const domain of PG_BEACON_DOMAINS) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return true;
    }
  }
  return false;
}

function pgIsBeaconPath(pathname) {
  if (!pathname) return false;
  pathname = pathname.toLowerCase();
  
  for (const beaconPath of PG_BEACON_PATHS) {
    if (pathname.includes(beaconPath)) {
      return true;
    }
  }
  return false;
}

function pgIsBeaconRequest(details) {
  if (!details || !details.url) return false;
  
  try {
    const url = new URL(details.url);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    
    if (pgIsBeaconDomain(hostname)) return true;
    if (pgIsBeaconPath(pathname)) return true;
    
    if (details.type === "beacon") return true;
    
    if (details.type === "image" && (pathname.endsWith(".gif") || pathname.endsWith(".png")) && (pathname.includes("1x1") || pathname.includes("pixel") || pathname.includes("beacon") || pathname.includes("track"))) {
      return true;
    }
    
    const query = url.search.toLowerCase();
    if (query.includes("utm_") || query.includes("fbclid") || query.includes("gclid") || query.includes("_ga=") || query.includes("_gid=")) {
      if (details.type === "image" && (pathname.endsWith(".gif") || pathname.endsWith(".png"))) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!pgShouldBlockBeacons()) return {};
      
      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) {
            return {};
          }
        } catch (e) {
        }
      }
      
      if (pgIsBeaconRequest(details)) {
        console.log("[PrivacyGuard] beacon_blocker: blocked beacon", details.type, details.url);
        if (typeof pgIncrementStat === "function") {
          pgIncrementStat("blockedBeacons");
        }
        return { cancel: true };
      }
    } catch (e) {
      console.warn("[PrivacyGuard] beacon_blocker: error checking request", details?.url, e);
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
