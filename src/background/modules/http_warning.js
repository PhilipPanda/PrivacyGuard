var pgHttpWarnBypass = new Map();

function pgHttpWarnAllowOnce(tabId, url) {
  if (!Number.isFinite(tabId) || tabId < 0) return false;
  if (!url || typeof url !== "string") return false;
  pgHttpWarnBypass.set(tabId, { url: url, exp: Date.now() + 30000 });
  return true;
}

function pgHttpWarnShouldBypass(tabId, url) {
  const e = pgHttpWarnBypass.get(tabId);
  if (!e) return false;
  if (Date.now() > e.exp) {
    pgHttpWarnBypass.delete(tabId);
    return false;
  }
  if (e.url === url) {
    pgHttpWarnBypass.delete(tabId);
    return true;
  }
  return false;
}

function pgIsPlainHttp(url) {
  return typeof url === "string" && url.startsWith("http://");
}

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    try {
      if (!details || details.type !== "main_frame") return {};
      if (!pgIsPlainHttp(details.url)) return {};

      const tabId = Number(details.tabId);
      if (pgHttpWarnShouldBypass(tabId, details.url)) return {};

      const s = await pgGetSettings();
      if (!s || !s.enabled) return {};
      if (!!s.alwaysHTTPS) return {};

      const warnUrl =
        browser.runtime.getURL("src/warning/http_warning.html") +
        "?url=" + encodeURIComponent(details.url) +
        "&tabId=" + encodeURIComponent(String(details.tabId));

      return { redirectUrl: warnUrl };
    } catch (e) {
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
