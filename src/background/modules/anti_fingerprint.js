console.log("[PrivacyGuard] module loaded: anti_fingerprint");

var pgAfSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var PG_FP_PATH_SNIPPETS = [
  "fingerprintjs",
  "fingerprint-js",
  "fpjs",
  "fingerprint2",
  "fingerprintjs2",
  "clientjs",
  "evercookie",
  "canvas-fingerprint",
  "devicefingerprint",
  "fontfingerprint",
  "browser-fingerprint"
];

(async () => {
  try {
    pgAfSettings = await pgGetSettings();
  } catch (e) {}
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgAfSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldAntiFp() {
  return !!(pgAfSettings && pgAfSettings.enabled && pgAfSettings.antiFingerprint);
}

function pgUrlLooksLikeFpLib(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  for (const s of PG_FP_PATH_SNIPPETS) {
    if (u.includes(s)) return true;
  }
  return false;
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!pgShouldAntiFp()) return {};

    const headers = details.requestHeaders || [];
    let hasDnt = false;
    let hasGpc = false;

    for (const h of headers) {
      const name = String(h.name || "").toLowerCase();
      if (name === "dnt") hasDnt = true;
      if (name === "sec-gpc") hasGpc = true;
    }

    if (!hasDnt) headers.push({ name: "DNT", value: "1" });
    if (!hasGpc) headers.push({ name: "Sec-GPC", value: "1" });

    return { requestHeaders: headers };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!pgShouldAntiFp()) return {};
    if (details.type !== "script") return {};

    try {
      const u = new URL(details.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return {};
      if (pgUrlLooksLikeFpLib(details.url)) return { cancel: true };
    } catch (e) {
      return {};
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
