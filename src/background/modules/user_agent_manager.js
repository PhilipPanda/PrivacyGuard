console.log("[PrivacyGuard] module loaded: user_agent_manager");

var pgUaSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var PG_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edg/120.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
];

(async () => {
  try {
    pgUaSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] user_agent_manager: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgUaSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldManageUserAgent() {
  return !!(pgUaSettings && pgUaSettings.enabled && pgUaSettings.manageUserAgent);
}

function pgGetUserAgent() {
  if (!pgShouldManageUserAgent()) return null;
  
  const mode = pgUaSettings.userAgentMode || "random";
  
  if (mode === "random") {
    const randomIndex = Math.floor(Math.random() * PG_USER_AGENTS.length);
    return PG_USER_AGENTS[randomIndex];
  }
  
  if (mode === "custom" && pgUaSettings.customUserAgent) {
    return String(pgUaSettings.customUserAgent).trim();
  }
  
  if (mode === "firefox") {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
  }
  
  if (mode === "chrome") {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }
  
  if (mode === "safari") {
    return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";
  }
  
  return null;
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      if (!pgShouldManageUserAgent()) return {};

      const userAgent = pgGetUserAgent();
      if (!userAgent) return {};

      const headers = details.requestHeaders || [];
      const headerMap = new Map();
      
      for (const h of headers) {
        const name = String(h.name || "").toLowerCase();
        headerMap.set(name, h);
      }

      if (headerMap.has("user-agent")) {
        const filteredHeaders = headers.map(h => {
          if (String(h.name || "").toLowerCase() === "user-agent") {
            return { name: "User-Agent", value: userAgent };
          }
          return h;
        });
        return { requestHeaders: filteredHeaders };
      } else {
        headers.push({ name: "User-Agent", value: userAgent });
        return { requestHeaders: headers };
      }
    } catch (e) {
      console.warn("[PrivacyGuard] user_agent_manager: error modifying headers", e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);
