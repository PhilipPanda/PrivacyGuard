console.log("[PrivacyGuard] module loaded: privacy_stats");

var pgPrivacyStats = {
  blockedAds: 0,
  blockedBeacons: 0,
  blockedCookies: 0,
  blockedFingerprints: 0,
  cleanedUrls: 0,
  upgradedHttps: 0,
  blockedTrackers: 0,
  blockedCryptominers: 0,
  lastReset: Date.now()
};

const PG_STATS_KEY = "pg_privacy_stats";
var pgStatsSaveTimer = null;
const PG_STATS_SAVE_DEBOUNCE_MS = 2000;

(async () => {
  try {
    const stored = await browser.storage.local.get(PG_STATS_KEY);
    if (stored && stored[PG_STATS_KEY]) {
      const loaded = stored[PG_STATS_KEY];
      Object.keys(pgPrivacyStats).forEach(function(k) {
        if (loaded.hasOwnProperty(k) && typeof loaded[k] === "number") {
          pgPrivacyStats[k] = loaded[k];
        }
      });
      if (loaded.lastReset) pgPrivacyStats.lastReset = loaded.lastReset;
    }
  } catch (e) {
    console.warn("[PrivacyGuard] privacy_stats: failed to load stats", e);
  }
})();

function pgIncrementStat(statName) {
  if (pgPrivacyStats.hasOwnProperty(statName) && typeof pgPrivacyStats[statName] === "number") {
    pgPrivacyStats[statName]++;
    pgScheduleSaveStats();
  }
}

function pgScheduleSaveStats() {
  if (pgStatsSaveTimer) clearTimeout(pgStatsSaveTimer);
  pgStatsSaveTimer = setTimeout(function() {
    pgStatsSaveTimer = null;
    pgSaveStats();
  }, PG_STATS_SAVE_DEBOUNCE_MS);
}

async function pgSaveStats() {
  try {
    await browser.storage.local.set({ [PG_STATS_KEY]: pgPrivacyStats });
  } catch (e) {
    console.warn("[PrivacyGuard] privacy_stats: failed to save stats", e);
  }
}

function pgGetStats() {
  return Object.assign({}, pgPrivacyStats);
}

async function pgResetStats() {
  pgPrivacyStats = {
    blockedAds: 0,
    blockedBeacons: 0,
    blockedCookies: 0,
    blockedFingerprints: 0,
    cleanedUrls: 0,
    upgradedHttps: 0,
    blockedTrackers: 0,
    blockedCryptominers: 0,
    lastReset: Date.now()
  };
  if (pgStatsSaveTimer) clearTimeout(pgStatsSaveTimer);
  pgStatsSaveTimer = null;
  await pgSaveStats();
  return pgGetStats();
}

function pgGetTotalBlocked() {
  return (pgPrivacyStats.blockedAds || 0) +
         (pgPrivacyStats.blockedBeacons || 0) +
         (pgPrivacyStats.blockedCookies || 0) +
         (pgPrivacyStats.blockedFingerprints || 0) +
         (pgPrivacyStats.blockedTrackers || 0) +
         (pgPrivacyStats.blockedCryptominers || 0);
}
