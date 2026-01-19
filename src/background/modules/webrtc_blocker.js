console.log("[PrivacyGuard] module loaded: webrtc_blocker");

var pgWebRTCSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgWebRTCSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] webrtc_blocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgWebRTCSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldBlockWebRTC() {
  return !!(pgWebRTCSettings && pgWebRTCSettings.enabled && pgWebRTCSettings.blockWebRTC);
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!pgShouldBlockWebRTC()) return {};
      
      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) {
            return {};
          }
        } catch (e) {
        }
      }
      
      if (details.type === "xmlhttprequest" || details.type === "websocket") {
        const url = details.url.toLowerCase();
        
        if (url.includes("webrtc") || 
            url.includes("stun:") || 
            url.includes("turn:") ||
            url.includes("stunserver") ||
            url.includes("turnserver") ||
            url.includes("ice-server")) {
          console.log("[PrivacyGuard] webrtc_blocker: blocked WebRTC request", details.url);
          if (typeof pgIncrementStat === "function") {
            pgIncrementStat("blockedTrackers");
          }
          return { cancel: true };
        }
      }
    } catch (e) {
      console.warn("[PrivacyGuard] webrtc_blocker: error checking request", details?.url, e);
    }
    
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
