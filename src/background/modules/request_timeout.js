console.log("[PrivacyGuard] module loaded: request_timeout");

var pgTimeoutSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgTimeoutSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] request_timeout: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgTimeoutSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldTimeoutRequests() {
  return !!(pgTimeoutSettings && pgTimeoutSettings.enabled && pgTimeoutSettings.requestTimeout);
}

function pgGetTimeoutMs() {
  const timeout = pgTimeoutSettings.requestTimeoutMs || 30000;
  return Math.max(1000, Math.min(300000, Number(timeout)));
}

var pgActiveRequests = new Map();

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!pgShouldTimeoutRequests()) return {};
    if (details.type === "main_frame") return {};
    
    const timeout = pgGetTimeoutMs();
    const requestId = details.requestId;
    
    const timeoutId = setTimeout(() => {
      try {
        browser.webRequest.handlerBehaviorChanged();
        console.log("[PrivacyGuard] request_timeout: request timed out", details.url);
      } catch (e) {
      }
      pgActiveRequests.delete(requestId);
    }, timeout);
    
    pgActiveRequests.set(requestId, timeoutId);
    
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onCompleted.addListener(
  (details) => {
    const timeoutId = pgActiveRequests.get(details.requestId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pgActiveRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    const timeoutId = pgActiveRequests.get(details.requestId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pgActiveRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] }
);
