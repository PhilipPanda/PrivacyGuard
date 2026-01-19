console.log("[PrivacyGuard] module loaded: cookie_blocker");

var pgCookieSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgCookieSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] cookie_blocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgCookieSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldBlockCookies() {
  return !!(pgCookieSettings && pgCookieSettings.enabled && pgCookieSettings.blockThirdPartyCookies);
}

function pgIsThirdPartyCookie(cookie, tabUrl) {
  if (!cookie || !tabUrl) return false;
  
  try {
    const cookieDomain = cookie.domain || "";
    const tabUrlObj = new URL(tabUrl);
    const tabDomain = tabUrlObj.hostname.toLowerCase();
    
    let cookieDomainClean = cookieDomain.toLowerCase().replace(/^\./, "");
    
    if (cookieDomainClean === tabDomain) return false;
    
    if (tabDomain.endsWith("." + cookieDomainClean)) return false;
    if (cookieDomainClean.endsWith("." + tabDomain)) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

browser.cookies.onChanged.addListener(async (changeInfo) => {
  if (!pgShouldBlockCookies()) return;
  if (!changeInfo.removed && changeInfo.cookie) {
    try {
      const cookie = changeInfo.cookie;
      
      if (!cookie.domain) return;
      
      const tabs = await browser.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.url && pgIsThirdPartyCookie(cookie, tab.url)) {
          try {
            const url = (cookie.secure ? "https://" : "http://") + cookie.domain.replace(/^\./, "") + (cookie.path || "/");
            await browser.cookies.remove({
              url: url,
              name: cookie.name,
              storeId: cookie.storeId
            });
            console.log("[PrivacyGuard] cookie_blocker: blocked third-party cookie", cookie.name, "from", cookie.domain);
            if (typeof pgIncrementStat === "function") {
              pgIncrementStat("blockedCookies");
            }
            return;
          } catch (e) {
          }
        }
      }
    } catch (e) {
      console.warn("[PrivacyGuard] cookie_blocker: error blocking cookie", e);
    }
  }
});

browser.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    try {
      if (!pgShouldBlockCookies()) return {};

      const headers = details.requestHeaders || [];
      const headerMap = new Map();
      
      for (const h of headers) {
        const name = String(h.name || "").toLowerCase();
        headerMap.set(name, h);
      }

      if (!headerMap.has("cookie")) return {};

      try {
        const tab = await browser.tabs.get(details.tabId);
        if (!tab || !tab.url) return {};

        const cookieHeader = headerMap.get("cookie").value;
        const cookies = cookieHeader.split(";").map(c => c.trim());
        const filteredCookies = [];

        for (const cookieStr of cookies) {
          const cookieName = cookieStr.split("=")[0].trim();
          
          try {
            const cookie = await browser.cookies.get({
              url: details.url,
              name: cookieName
            });
            
            if (cookie && !pgIsThirdPartyCookie(cookie, tab.url)) {
              filteredCookies.push(cookieStr);
            }
          } catch (e) {
            filteredCookies.push(cookieStr);
          }
        }

        if (filteredCookies.length === 0) {
          const filteredHeaders = headers.filter(h => {
            const name = String(h.name || "").toLowerCase();
            return name !== "cookie";
          });
          return { requestHeaders: filteredHeaders };
        } else if (filteredCookies.length < cookies.length) {
          const filteredHeaders = headers.map(h => {
            if (String(h.name || "").toLowerCase() === "cookie") {
              return { name: "Cookie", value: filteredCookies.join("; ") };
            }
            return h;
          });
          return { requestHeaders: filteredHeaders };
        }
      } catch (e) {
      }

      return {};
    } catch (e) {
      console.warn("[PrivacyGuard] cookie_blocker: error processing request", e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);
