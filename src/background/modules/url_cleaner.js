var PG_TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_name", "utm_reader", "utm_viz", "utm_pubref",

  "gclid", "dclid", "gbraid", "wbraid", "msclkid",

  "fbclid", "igshid", "ttclid", "twclid", "li_fat_id",

  "mc_cid", "mc_eid", "vero_conv", "vero_id"
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
    if (details.type !== "main_frame") return {};

    const s = await pgGetSettings();
    if (!s.enabled || !s.stripUTMParams) return {};

    const cleaned = pgCleanUrl(details.url);
    if (!cleaned || cleaned === details.url) return {};

    return { redirectUrl: cleaned };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
