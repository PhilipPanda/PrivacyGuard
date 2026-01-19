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
  "srsltid", "si", "ved", "ei",
  
  // Additional tracking parameters
  "ncid", "ncid", "ncid", "_ga", "_gid", "_gac",
  "yclid", "yclid", "yclid", "yclid",
  "twclid", "twclid", "twclid",
  "igshid", "igshid",
  "fb_action_ids", "fb_action_types", "fb_source",
  "mc_eid", "mc_cid",
  "utm_referrer", "utm_source_platform",
  "utm_creative_format", "utm_marketing_tactic",
  "_openstat", "openstat",
  "from", "from", "from",
  "wt.mc_id", "wt_rid",
  "hsCtaTracking", "hsCampaignId",
  "mkt_tok", "mkt_tok",
  "icid", "icid",
  "ns_campaign", "ns_mchannel", "ns_source",
  "ns_linkname", "ns_fee",
  "CNDID", "CNDID",
  "mbid", "mbid",
  "trk_contact", "trk_module", "trk_sid",
  "ga_campaign", "ga_medium", "ga_source",
  "ga_content", "ga_term",
  "yclid", "yclid",
  "_branch_match_id", "_branch_referrer",
  "pk_campaign", "pk_kwd", "pk_source",
  "piwik_campaign", "piwik_kwd", "piwik_keyword",
  "mtm_campaign", "mtm_source", "mtm_medium",
  "mtm_content", "mtm_keyword",
  "matomo_campaign", "matomo_keyword",
  "reddit_cid", "reddit_name",
  "tiktok_ads_id", "ttclid",
  "snapchat_click_id", "sc_cid",
  "pinterest_click_id", "epik",
  "ad_id", "adset_id", "campaign_id",
  "ad_name", "adset_name", "campaign_name",
  "placement", "site_source_name",
  "ds_dest_url", "ds_dest_url_params",
  "ds_channel", "ds_campaign",
  "ds_agid", "ds_adid", "ds_kid",
  "ds_matchtype", "ds_network",
  "ds_creative", "ds_placement",
  "ds_target", "ds_targetid",
  "ds_loc_physical_ms", "ds_loc_interest_ms",
  "ds_feeditemid", "ds_adposition",
  "ds_device", "ds_devicemodel",
  "ds_clickid", "ds_product_id",
  "ds_product_group_id", "ds_product_country",
  "ds_product_language", "ds_product_channel",
  "ds_product_store_id", "ds_product_seller_id",
  "ds_product_format_id", "ds_product_delivery_method",
  "ds_product_condition", "ds_product_availability",
  "ds_product_brand", "ds_product_gtin",
  "ds_product_mpn", "ds_product_price",
  "ds_product_currency", "ds_product_discount",
  "ds_product_promotion_id", "ds_product_promotion_name",
  "ds_product_category", "ds_product_category2",
  "ds_product_category3", "ds_product_category4",
  "ds_product_category5", "ds_product_variant",
  "ds_product_custom_label_0", "ds_product_custom_label_1",
  "ds_product_custom_label_2", "ds_product_custom_label_3",
  "ds_product_custom_label_4"
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

      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) {
            return {};
          }
        } catch (e) {
        }
      }

      const s = await pgGetSettings();
      if (!s || !s.enabled || !s.stripUTMParams) return {};

      const cleaned = pgCleanUrl(details.url);
      if (!cleaned || cleaned === details.url) return {};

      console.log("[PrivacyGuard] url_cleaner: cleaned", details.url, "->", cleaned);
      if (typeof pgIncrementStat === "function") {
        pgIncrementStat("cleanedUrls");
      }
      return { redirectUrl: cleaned };
    } catch (e) {
      console.warn("[PrivacyGuard] url_cleaner: error processing request", details?.url, e);
      return {};
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
