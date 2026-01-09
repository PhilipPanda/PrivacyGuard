console.log("[PrivacyGuard] module loaded: anti_fingerprint");

var pgAfSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var PG_FP_PATH_SNIPPETS = [
  "fingerprintjs",
  "fingerprint-js",
  "fpjs",
  "fingerprint2",
  "fingerprintjs2",
  "clientjs",
  "evercookie",
  "canvas-fingerprint",
  "devicefingerprint",
  "fontfingerprint",
  "browser-fingerprint",
  "fingerprint",
  "fp-js",
  "fpjs",
  "fingerprinting",
  "tracking",
  "analytics",
  "mixpanel",
  "segment",
  "amplitude",
  "fullstory",
  "hotjar",
  "mouseflow",
  "sessioncam",
  "smartlook",
  "logrocket",
  "datadog",
  "sentry",
  "raygun"
];

var PG_FP_DOMAINS = [
  "fingerprintjs.com",
  "fpjs.io",
  "cdn.fingerprintjs.com",
  "cdn.fpjs.io",
  "fingerprint2.appspot.com",
  "clientjs.org"
];

(async () => {
  try {
    pgAfSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] anti_fingerprint: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgAfSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldAntiFp() {
  return !!(pgAfSettings && pgAfSettings.enabled && pgAfSettings.antiFingerprint);
}

function pgUrlLooksLikeFpLib(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  for (const s of PG_FP_PATH_SNIPPETS) {
    if (u.includes(s)) return true;
  }
  return false;
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      if (!pgShouldAntiFp()) return {};

      const headers = details.requestHeaders || [];
      const headerMap = new Map();
      
      for (const h of headers) {
        const name = String(h.name || "").toLowerCase();
        headerMap.set(name, h);
      }

      if (!headerMap.has("dnt")) {
        headers.push({ name: "DNT", value: "1" });
      }

      if (!headerMap.has("sec-gpc")) {
        headers.push({ name: "Sec-GPC", value: "1" });
      }

      if (!headerMap.has("do-not-track")) {
        headers.push({ name: "Do-Not-Track", value: "1" });
      }

      const trackingHeaders = [
        "x-forwarded-for",
        "x-real-ip",
        "x-client-ip",
        "via",
        "forwarded",
        "true-client-ip",
        "cf-connecting-ip"
      ];
      
      const filteredHeaders = headers.filter(h => {
        const name = String(h.name || "").toLowerCase();
        return !trackingHeaders.includes(name);
      });

      return { requestHeaders: filteredHeaders };
    } catch (e) {
      console.warn("[PrivacyGuard] anti_fingerprint: error modifying headers", e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

function pgIsFingerprintingDomain(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  
  for (const domain of PG_FP_DOMAINS) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return true;
    }
  }
  return false;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!pgShouldAntiFp()) return {};
      
      if (details.type !== "script" && details.type !== "image" && details.type !== "xmlhttprequest") {
        return {};
      }

      if (!details.url) return {};

      const u = new URL(details.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return {};
      
      const hostname = u.hostname.toLowerCase();
      
      if (pgIsFingerprintingDomain(hostname)) {
        console.log("[PrivacyGuard] anti_fingerprint: blocked fingerprinting domain", details.url);
        return { cancel: true };
      }
      
      if (pgUrlLooksLikeFpLib(details.url)) {
        console.log("[PrivacyGuard] anti_fingerprint: blocked fingerprinting script", details.url);
        return { cancel: true };
      }
    } catch (e) {
      console.warn("[PrivacyGuard] anti_fingerprint: error checking URL", details.url, e);
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
