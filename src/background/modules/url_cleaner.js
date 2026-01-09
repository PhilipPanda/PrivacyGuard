var PG_TRACKING_PARAMS = [
  // UTM parameters
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_name", "utm_reader", "utm_viz", "utm_pubref",
  
  // Google Ads
  "gclid", "dclid", "gbraid", "wbraid", "msclkid",
  
  // Social media
  "fbclid", "igshid", "ttclid", "twclid", "li_fat_id",
  
  // Email marketing
  "mc_cid", "mc_eid", "vero_conv", "vero_id",
  
  // Additional tracking
  "ref", "source", "campaign", "medium", "affiliate_id",
  "affiliate", "affid", "clickid", "click_id", "clickId",
  "partner_id", "partnerid", "pid", "rid", "ref_id",
  "refid", "referrer", "referer", "referrer_id",
  "tracking_id", "trackingid", "tid", "track_id",
  "trackid", "trk", "trkid", "trk_id",
  "subid", "sub_id", "sub_id1", "sub_id2",
  "srsltid", "si", "ved", "ei"
];

function pgCleanUrl(urlString) {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    let changed = false;

    for (const p of PG_TRACKING_PARAMS) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (!changed) return null;

    url.search = url.searchParams.toString();

    return url.toString();
  } catch (e) {
    return null;
  }
}

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    try {
      if (!details || details.type !== "main_frame") return {};

      if (!details.url) return {};

      const s = await pgGetSettings();
      if (!s || !s.enabled || !s.stripUTMParams) return {};

      const cleaned = pgCleanUrl(details.url);
      if (!cleaned || cleaned === details.url) return {};

      console.log("[PrivacyGuard] url_cleaner: cleaned", details.url, "->", cleaned);
      return { redirectUrl: cleaned };
    } catch (e) {
      console.warn("[PrivacyGuard] url_cleaner: error processing request", details?.url, e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
