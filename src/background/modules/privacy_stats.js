console.log("[PrivacyGuard] module loaded: privacy_stats");

var pgPrivacyStats = {
  blockedAds: 0,
  blockedBeacons: 0,
  blockedCookies: 0,
  blockedFingerprints: 0,
  cleanedUrls: 0,
  upgradedHttps: 0,
  blockedTrackers: 0,
  lastReset: Date.now()
};

const PG_STATS_KEY = "pg_privacy_stats";

(async () => {
  try {
    const stored = await browser.storage.local.get(PG_STATS_KEY);
    if (stored && stored[PG_STATS_KEY]) {
      Object.assign(pgPrivacyStats, stored[PG_STATS_KEY]);
    }
  } catch (e) {
    console.warn("[PrivacyGuard] privacy_stats: failed to load stats", e);
  }
})();

function pgIncrementStat(statName) {
  if (pgPrivacyStats.hasOwnProperty(statName)) {
    pgPrivacyStats[statName]++;
    pgSaveStats();
  }
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
    lastReset: Date.now()
  };
  await pgSaveStats();
  return pgGetStats();
}

function pgGetTotalBlocked() {
  return pgPrivacyStats.blockedAds + 
         pgPrivacyStats.blockedBeacons + 
         pgPrivacyStats.blockedCookies + 
         pgPrivacyStats.blockedFingerprints +
         pgPrivacyStats.blockedTrackers;
}
