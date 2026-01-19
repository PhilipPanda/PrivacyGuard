console.log("[PrivacyGuard] module loaded: site_whitelist");

var pgWhitelistSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgWhitelistSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] site_whitelist: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgWhitelistSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldUseWhitelist() {
  return !!(pgWhitelistSettings && pgWhitelistSettings.enabled && pgWhitelistSettings.siteWhitelist);
}

function pgNormalizeDomainForWhitelist(domain) {
  if (!domain || typeof domain !== "string") return null;
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  d = d.split("#")[0];
  d = d.split(":")[0];
  if (!d || d.length === 0) return null;
  return d;
}

function pgIsWhitelisted(hostname) {
  if (!pgShouldUseWhitelist()) return false;
  if (!hostname) return false;
  
  const whitelist = Array.isArray(pgWhitelistSettings.whitelistedSites) ? pgWhitelistSettings.whitelistedSites : [];
  if (whitelist.length === 0) return false;
  
  const normalized = pgNormalizeDomainForWhitelist(hostname);
  if (!normalized) return false;
  
  for (const site of whitelist) {
    const normalizedSite = pgNormalizeDomainForWhitelist(site);
    if (!normalizedSite) continue;
    
    if (normalized === normalizedSite || normalized.endsWith("." + normalizedSite) || normalizedSite.endsWith("." + normalized)) {
      return true;
    }
  }
  
  return false;
}

function pgShouldBypassProtection(details) {
  if (!details || !details.url) return false;
  
  try {
    const url = new URL(details.url);
    return pgIsWhitelisted(url.hostname);
  } catch (e) {
    return false;
  }
}

function pgIsWhitelistedHostname(hostname) {
  return pgIsWhitelisted(hostname);
}
