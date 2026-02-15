var PG_TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "dclid", "fbclid", "igshid", "ttclid", "twclid", "msclkid",
  "mc_cid", "mc_eid", "vero_id", "ref", "refid", "referrer", "source",
  "campaign", "medium", "affiliate", "clickid", "click_id", "tracking_id",
  "trk", "subid", "srsltid", "_ga", "_gid", "_gac", "ved", "ei", "epik"
];

var pgUrlCleanerSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
var PG_TRACKING_PARAM_SET = new Set(PG_TRACKING_PARAMS);

/**
 * Remove tracking parameters from a URL.
 * @param {string} urlString URL candidate.
 * @returns {string|null} Clean URL string or null when unchanged/invalid.
 */
function pgCleanUrl(urlString) {
  var parsed = pgSafeParseUrl(urlString);
  if (!parsed) return null;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  var changed = false;

  PG_TRACKING_PARAM_SET.forEach(function(param) {
    if (parsed.searchParams.has(param)) {
      parsed.searchParams.delete(param);
      changed = true;
    }
  });

  Array.from(parsed.searchParams.keys()).forEach(function(key) {
    if (String(key || "").toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
      changed = true;
    }
  });

  return changed ? parsed.toString() : null;
}

function pgShouldCleanRequest(details) {
  if (!details || details.type !== "main_frame" || !details.url) return false;
  if (!pgIsFeatureEnabled("url_cleaner", pgUrlCleanerSettings)) return false;

  if (typeof pgIsWhitelistedHostname === "function") {
    var parsed = pgSafeParseUrl(details.url);
    if (parsed && pgIsWhitelistedHostname(parsed.hostname)) {
      return false;
    }
  }

  return true;
}

function pgHandleUrlCleanerRequest(details) {
  try {
    if (!pgShouldCleanRequest(details)) return {};

    var cleaned = pgCleanUrl(details.url);
    if (!cleaned || cleaned === details.url) return {};

    if (typeof pgIncrementStat === "function") {
      pgIncrementStat("cleanedUrls");
    }
    return { redirectUrl: cleaned };
  } catch (error) {
    pgLog("warn", "url_cleaner", "Failed to process URL cleaning", { error: String(error) });
    return {};
  }
}

pgSubscribeSettings(function(nextSettings) {
  pgUrlCleanerSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, nextSettings);
});

browser.webRequest.onBeforeRequest.addListener(
  pgHandleUrlCleanerRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);
