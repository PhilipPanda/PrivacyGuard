console.log("[PrivacyGuard] module loaded: cryptominer_blocker");

let pgCryptoSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

const PG_CRYPTO_DOMAINS = new Set([
  "coinhive.com", "cdn.coinhive.com", "authedmine.com", "crypto-loot.com",
  "minero.cc", "minero.cc/lib/minero.min.js", "minemytraffic.com",
  "coinnebula.com", "coinhave.com", "jsecoin.com", "minero.cc",
  "statdynamic.com", "cdn.jsecoin.com", "load.jsecoin.com",
  "freecontent.bid", "freecontent.stream", "freecontent.win",
  "ad-miner.com", "nanopool.org", "monerominer.rocks",
  "cryptonight.wasm", "miner.cryptonight", "worker.js",
  "webassembly", "wasm.miner", "minero", "coinhive.min.js",
  "coin-hive.com", "coinlab.biz", "2giga.link", "crypto-webminer",
  "ppoi.org", "projectpoi.com", "xmr.pool", "minexmr.com",
  "supportxmr.com", "hashvault.pro", "nicehash.com",
  "cryptoloot.pro", "minecrunch.co", "pool.rplant.org"
]);

const PG_CRYPTO_PATH_HINTS = [
  "coinhive", "cryptonight", "minero", "miner.js", "miner.min.js",
  "crypto-miner", "webmine", "mining", "wasm-miner", "worker.min.js",
  "cryptoloot", "jsecoin", "authedmine", "minemytraffic"
];

(async () => {
  try {
    pgCryptoSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] cryptominer_blocker: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgCryptoSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldBlockCryptoMiners() {
  return !!(pgCryptoSettings && pgCryptoSettings.enabled && pgCryptoSettings.blockCryptoMiners);
}

function pgUrlLooksLikeCrypto(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  for (const d of PG_CRYPTO_DOMAINS) {
    if (u.includes(d)) return true;
  }
  for (const h of PG_CRYPTO_PATH_HINTS) {
    if (u.includes(h)) return true;
  }
  return false;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!pgShouldBlockCryptoMiners()) return {};
      if (typeof pgIsWhitelistedHostname === "function") {
        try {
          const u = new URL(details.url);
          if (pgIsWhitelistedHostname(u.hostname)) return {};
        } catch (e) {}
      }
      if (details.type !== "script" && details.type !== "xmlhttprequest") return {};
      if (pgUrlLooksLikeCrypto(details.url)) {
        if (typeof pgIncrementStat === "function") pgIncrementStat("blockedCryptominers");
        return { cancel: true };
      }
    } catch (e) {
      console.warn("[PrivacyGuard] cryptominer_blocker: error", details?.url, e);
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
