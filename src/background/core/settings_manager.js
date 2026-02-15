var PG_SCHEMA_VERSION = 2;
var PG_SETTINGS_CACHE = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
var pgSettingsListeners = new Set();

/**
 * Validate and sanitize a settings object.
 * @param {object} candidate Raw user or storage settings.
 * @returns {object} Sanitized settings object merged with defaults.
 */
function pgSanitizeSettings(candidate) {
  var defaults = PrivacyGuardConstants.DEFAULT_SETTINGS;
  var raw = candidate && typeof candidate === "object" ? candidate : {};
  var next = Object.assign({}, defaults, raw);

  next.enabled = !!next.enabled;
  next.alwaysHTTPS = !!next.alwaysHTTPS;
  next.stripUTMParams = !!next.stripUTMParams;
  next.blockAds = !!next.blockAds;
  next.blockTrackers = !!next.blockTrackers;
  next.antiFingerprint = !!next.antiFingerprint;
  next.manageReferrer = !!next.manageReferrer;
  next.blockThirdPartyCookies = !!next.blockThirdPartyCookies;
  next.manageStorage = !!next.manageStorage;
  next.blockBeacons = !!next.blockBeacons;
  next.siteWhitelist = !!next.siteWhitelist;
  next.requestTimeout = !!next.requestTimeout;
  next.autoDeleteCookies = !!next.autoDeleteCookies;
  next.blockWebRTC = !!next.blockWebRTC;
  next.blockSocialWidgets = !!next.blockSocialWidgets;
  next.blockCryptoMiners = !!next.blockCryptoMiners;
  next.disableHyperlinkAuditing = next.disableHyperlinkAuditing !== false;
  next.proxyEnabled = !!next.proxyEnabled;
  next.proxyDNS = next.proxyDNS !== false;
  next.manageUserAgent = !!next.manageUserAgent;
  next.decoyTraffic = !!next.decoyTraffic;

  next.proxyType = ["socks", "http", "https"].includes(String(next.proxyType || ""))
    ? String(next.proxyType)
    : "socks";
  next.proxyHost = String(next.proxyHost || "").trim().slice(0, 255);
  next.proxyPort = pgClamp(next.proxyPort, 1, 65535);
  next.proxyUsername = String(next.proxyUsername || "").slice(0, 200);
  next.proxyPassword = String(next.proxyPassword || "").slice(0, 200);

  next.referrerMode = ["no-referrer", "same-origin", "origin", "strict-origin"].includes(String(next.referrerMode || ""))
    ? String(next.referrerMode)
    : "no-referrer";

  next.userAgentMode = ["random", "custom", "firefox", "chrome", "safari"].includes(String(next.userAgentMode || ""))
    ? String(next.userAgentMode)
    : "random";
  next.customUserAgent = String(next.customUserAgent || "").slice(0, 400);

  next.storageMode = ["clear-on-close", "clear-on-navigation", "block"].includes(String(next.storageMode || ""))
    ? String(next.storageMode)
    : "clear-on-close";

  next.requestTimeoutMs = pgClamp(next.requestTimeoutMs, 1000, 300000);

  next.cookieLifetime = String(next.cookieLifetime || defaults.cookieLifetime).trim() || defaults.cookieLifetime;
  next.decoyMinInterval = String(next.decoyMinInterval || defaults.decoyMinInterval).trim() || defaults.decoyMinInterval;
  next.decoyMaxInterval = String(next.decoyMaxInterval || defaults.decoyMaxInterval).trim() || defaults.decoyMaxInterval;

  next.adblockCustomBlocklist = pgSanitizeDomainList(next.adblockCustomBlocklist);
  next.adblockCustomAllowlist = pgSanitizeDomainList(next.adblockCustomAllowlist);
  next.adblockDisabledSites = pgSanitizeDomainList(next.adblockDisabledSites);
  next.whitelistedSites = pgSanitizeDomainList(next.whitelistedSites);
  next.decoySites = pgSanitizeDomainList(next.decoySites);

  return next;
}

function pgSanitizeDomainList(list) {
  if (!Array.isArray(list)) return [];
  var out = [];
  var seen = new Set();
  for (var i = 0; i < list.length; i++) {
    var val = pgNormalizeDomain(list[i]);
    if (!val || !pgIsValidDomain(val) || seen.has(val)) continue;
    seen.add(val);
    out.push(val);
  }
  return out;
}

/**
 * Read settings from storage, migrate if required, and refresh cache.
 * @returns {Promise<object>} Current sanitized settings.
 */
async function pgLoadSettings() {
  var key = PrivacyGuardConstants.STORAGE_KEY;
  var schemaKey = PrivacyGuardConstants.STORAGE_SCHEMA_KEY;

  try {
    var stored = await browser.storage.local.get([key, schemaKey]);
    var migrated = pgMigrateSettings(stored[key], Number(stored[schemaKey] || 1));
    PG_SETTINGS_CACHE = pgSanitizeSettings(migrated.settings);

    if (migrated.changed) {
      await browser.storage.local.set({
        [key]: PG_SETTINGS_CACHE,
        [schemaKey]: PG_SCHEMA_VERSION
      });
    }
  } catch (error) {
    pgLog("error", "settings", "Failed to load settings; using defaults", { error: String(error) });
    PG_SETTINGS_CACHE = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
  }

  return Object.assign({}, PG_SETTINGS_CACHE);
}

/**
 * Get settings from in-memory cache.
 * @returns {Promise<object>} Current settings.
 */
async function pgGetSettings() {
  return Object.assign({}, PG_SETTINGS_CACHE);
}

/**
 * Merge and persist settings updates.
 * @param {object} partial Partial settings update.
 * @returns {Promise<object>} Updated settings.
 */
async function pgUpdateSettings(partial) {
  if (!partial || typeof partial !== "object") {
    throw new Error("Invalid settings payload");
  }

  var key = PrivacyGuardConstants.STORAGE_KEY;
  var schemaKey = PrivacyGuardConstants.STORAGE_SCHEMA_KEY;
  var merged = pgSanitizeSettings(Object.assign({}, PG_SETTINGS_CACHE, partial));

  await browser.storage.local.set({
    [key]: merged,
    [schemaKey]: PG_SCHEMA_VERSION
  });

  PG_SETTINGS_CACHE = merged;
  pgNotifySettingsListeners(merged);
  return Object.assign({}, merged);
}

/**
 * Subscribe to settings updates.
 * @param {function} listener Callback invoked with new settings.
 * @returns {function} Unsubscribe function.
 */
function pgSubscribeSettings(listener) {
  if (typeof listener !== "function") {
    return function() {};
  }

  pgSettingsListeners.add(listener);
  return function() {
    pgSettingsListeners.delete(listener);
  };
}

function pgNotifySettingsListeners(settings) {
  pgSettingsListeners.forEach(function(listener) {
    try {
      listener(Object.assign({}, settings));
    } catch (error) {
      pgLog("warn", "settings", "Settings listener failed", { error: String(error) });
    }
  });
}

function pgMigrateSettings(rawSettings, version) {
  var currentVersion = Number.isFinite(version) ? version : 1;
  var changed = false;
  var settings = rawSettings && typeof rawSettings === "object"
    ? Object.assign({}, rawSettings)
    : Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

  if (currentVersion < 2) {
    // v2: normalize some legacy naming variants if found in imports.
    if (Object.prototype.hasOwnProperty.call(settings, "stripTrackingParams")) {
      settings.stripUTMParams = !!settings.stripTrackingParams;
      delete settings.stripTrackingParams;
      changed = true;
    }
    currentVersion = 2;
    changed = true;
  }

  return {
    settings: settings,
    changed: changed
  };
}

browser.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  var key = PrivacyGuardConstants.STORAGE_KEY;
  if (!changes[key] || !changes[key].newValue) return;

  PG_SETTINGS_CACHE = pgSanitizeSettings(changes[key].newValue);
  pgNotifySettingsListeners(PG_SETTINGS_CACHE);
});

(async function pgPrimeSettingsCache() {
  try {
    await pgLoadSettings();
  } catch (_error) {}
})();
