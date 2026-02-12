console.log("[PrivacyGuard] module loaded: social_widget_blocker");

let pgSocialSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

const PG_SOCIAL_DOMAINS = new Set([
  "connect.facebook.net", "facebook.com/plugins", "www.facebook.com/plugins",
  "platform.twitter.com", "syndication.twitter.com", "cdn.syndication.twimg.com",
  "platform.instagram.com", "www.instagram.com/embed",
  "apis.google.com/js/platform.js", "accounts.google.com/gsi",
  "linkedin.com/embed", "platform.linkedin.com",
  "pinterest.com/pin", "assets.pinterest.com",
  "tiktok.com/embed", "www.tiktok.com/embed",
  "discord.com/widget", "cdn.discordapp.com/embed",
  "sharethis.com", "buttons-config.sharethis.com",
  "addthis.com", "s7.addthis.com", "static.addtoany.com",
  "share.google.com", "plus.google.com",
  "redditstatic.com/embed", "embed.reddit.com",
  "snap.licdn.com", "badge.instagram.com",
  "widgets.wp.com", "public-api.wordpress.com",
  "disqus.com/embed", "c.disquscdn.com"
]);

const PG_SOCIAL_PATH_HINTS = [
  "/embed", "/plugins", "/widget", "/share", "/like", "/follow",
  "/platform.js", "/sdk.js", "/connect/"
];

(async () => {
  try {
    pgSocialSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] social_widget_blocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgSocialSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldBlockSocialWidgets() {
  return !!(pgSocialSettings && pgSocialSettings.enabled && pgSocialSettings.blockSocialWidgets);
}

function pgHostMatchesSocial(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  if (PG_SOCIAL_DOMAINS.has(hostname)) return true;
  for (const d of PG_SOCIAL_DOMAINS) {
    if (hostname === d || hostname.endsWith("." + d)) return true;
  }
  return false;
}

function pgPathMatchesSocial(pathname) {
  if (!pathname) return false;
  pathname = pathname.toLowerCase();
  for (const hint of PG_SOCIAL_PATH_HINTS) {
    if (pathname.includes(hint)) return true;
  }
  return false;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!pgShouldBlockSocialWidgets()) return {};
      if (details.type === "main_frame") return {};
      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) return {};
        } catch (e) {}
      }
      const u = new URL(details.url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname || "";
      if (pgHostMatchesSocial(host) || pgPathMatchesSocial(path)) {
        if (details.type === "script" || details.type === "sub_frame" || details.type === "xmlhttprequest") {
          if (typeof pgIncrementStat === "function") pgIncrementStat("blockedTrackers");
          return { cancel: true };
        }
      }
    } catch (e) {
      console.warn("[PrivacyGuard] social_widget_blocker: error", details?.url, e);
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
