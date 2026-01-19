console.log("[PrivacyGuard] module loaded: https_upgrade");

var pgHttpsSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgHttpsSettings = await pgGetSettings();
    console.log("[PrivacyGuard] https_upgrade: settings loaded");
  } catch (e) {
    console.warn("[PrivacyGuard] https_upgrade: failed to load settings, using defaults", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgHttpsSettings = Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      changes[key].newValue
    );
    console.log("[PrivacyGuard] https_upgrade settings updated", pgHttpsSettings);
  }
});

function pgUpgradeToHttps(urlString) {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "http:") return null;

    const host = (url.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return null;

    url.protocol = "https:";

    if (url.port === "80") url.port = "";

    return url.toString();
  } catch (e) {
    return null;
  }
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!details || details.type !== "main_frame") return {};

      if (details.method && details.method !== "GET") return {};

      if (!details.url) return {};

      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) {
            return {};
          }
        } catch (e) {
        }
      }

      const s = pgHttpsSettings;
      if (!s || !s.enabled || !s.alwaysHTTPS) return {};

      const upgraded = pgUpgradeToHttps(details.url);
      if (!upgraded || upgraded === details.url) return {};

      console.log("[PrivacyGuard] https_upgrade: upgraded", details.url, "->", upgraded);
      if (typeof pgIncrementStat === "function") {
        pgIncrementStat("upgradedHttps");
      }
      return { redirectUrl: upgraded };
    } catch (e) {
      console.warn("[PrivacyGuard] https_upgrade: error processing request", details?.url, e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
