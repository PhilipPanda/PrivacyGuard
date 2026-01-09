console.log("[PrivacyGuard] module loaded: referrer_manager");

var pgReferrerSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgReferrerSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] referrer_manager: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgReferrerSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldManageReferrer() {
  return !!(pgReferrerSettings && pgReferrerSettings.enabled && pgReferrerSettings.manageReferrer);
}

function pgGetReferrerPolicy(mode) {
  if (mode === "no-referrer") return "no-referrer";
  if (mode === "same-origin") return "same-origin";
  if (mode === "origin") return "origin";
  if (mode === "strict-origin") return "strict-origin-when-cross-origin";
  return "no-referrer";
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      if (!pgShouldManageReferrer()) return {};

      const headers = details.requestHeaders || [];
      const headerMap = new Map();
      
      for (const h of headers) {
        const name = String(h.name || "").toLowerCase();
        headerMap.set(name, h);
      }

      const mode = pgReferrerSettings.referrerMode || "no-referrer";
      const referrerPolicy = pgGetReferrerPolicy(mode);

      if (headerMap.has("referer")) {
        if (mode === "no-referrer") {
          const filteredHeaders = headers.filter(h => {
            const name = String(h.name || "").toLowerCase();
            return name !== "referer";
          });
          return { requestHeaders: filteredHeaders };
        } else if (mode === "origin") {
          try {
            const refererUrl = headerMap.get("referer").value;
            const url = new URL(refererUrl);
            const originOnly = url.origin;
            const filteredHeaders = headers.filter(h => {
              const name = String(h.name || "").toLowerCase();
              return name !== "referer";
            });
            filteredHeaders.push({ name: "Referer", value: originOnly });
            return { requestHeaders: filteredHeaders };
          } catch (e) {
          }
        } else if (mode === "same-origin") {
          try {
            const refererUrl = headerMap.get("referer").value;
            const targetUrl = details.url;
            const refererOrigin = new URL(refererUrl).origin;
            const targetOrigin = new URL(targetUrl).origin;
            
            if (refererOrigin !== targetOrigin) {
              const filteredHeaders = headers.filter(h => {
                const name = String(h.name || "").toLowerCase();
                return name !== "referer";
              });
              return { requestHeaders: filteredHeaders };
            }
          } catch (e) {
          }
        }
      }

      if (!headerMap.has("referrer-policy")) {
        headers.push({ name: "Referrer-Policy", value: referrerPolicy });
      } else {
        const filteredHeaders = headers.map(h => {
          if (String(h.name || "").toLowerCase() === "referrer-policy") {
            return { name: "Referrer-Policy", value: referrerPolicy };
          }
          return h;
        });
        return { requestHeaders: filteredHeaders };
      }

      return { requestHeaders: headers };
    } catch (e) {
      console.warn("[PrivacyGuard] referrer_manager: error modifying headers", e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);
