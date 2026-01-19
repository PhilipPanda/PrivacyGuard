console.log("[PrivacyGuard] module loaded: auto_delete_cookies");

var pgAutoDeleteSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var PG_AUTO_DELETE_ALARM_NAME = "pg-auto-delete-cookies";

(async () => {
  try {
    pgAutoDeleteSettings = await pgGetSettings();
    pgScheduleCookieCleanup();
  } catch (e) {
    console.warn("[PrivacyGuard] auto_delete_cookies: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgAutoDeleteSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
    pgScheduleCookieCleanup();
  }
});

function pgParseDurationToSeconds(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = m[2] || "m";
  let mult = 60;
  if (unit === "s") mult = 1;
  if (unit === "m") mult = 60;
  if (unit === "h") mult = 3600;
  if (unit === "d") mult = 86400;
  return value * mult;
}

function pgShouldAutoDeleteCookies() {
  return !!(pgAutoDeleteSettings && pgAutoDeleteSettings.enabled && pgAutoDeleteSettings.autoDeleteCookies);
}

async function pgCleanupOldCookies() {
  if (!pgShouldAutoDeleteCookies()) return;
  
  try {
    const lifetimeStr = pgAutoDeleteSettings.cookieLifetime || "7d";
    const lifetimeSeconds = pgParseDurationToSeconds(lifetimeStr);
    if (!lifetimeSeconds || lifetimeSeconds <= 0) return;
    
    const now = Date.now();
    const maxAge = lifetimeSeconds * 1000;
    const cutoffTime = now - maxAge;
    
    const allCookies = await browser.cookies.getAll({});
    let deletedCount = 0;
    
    for (const cookie of allCookies) {
      if (!cookie.expirationDate) {
        continue;
      }
      
      const expirationTime = cookie.expirationDate * 1000;
      
      if (expirationTime < cutoffTime) {
        try {
          const url = (cookie.secure ? "https://" : "http://") + 
                      cookie.domain.replace(/^\./, "") + 
                      (cookie.path || "/");
          await browser.cookies.remove({
            url: url,
            name: cookie.name,
            storeId: cookie.storeId
          });
          deletedCount++;
        } catch (e) {
        }
      } else if (cookie.expirationDate === 0) {
        const creationTime = cookie.creationDate || 0;
        if (creationTime > 0 && creationTime < cutoffTime) {
          try {
            const url = (cookie.secure ? "https://" : "http://") + 
                        cookie.domain.replace(/^\./, "") + 
                        (cookie.path || "/");
            await browser.cookies.remove({
              url: url,
              name: cookie.name,
              storeId: cookie.storeId
            });
            deletedCount++;
          } catch (e) {
          }
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log("[PrivacyGuard] auto_delete_cookies: deleted", deletedCount, "old cookies");
    }
  } catch (e) {
    console.warn("[PrivacyGuard] auto_delete_cookies: error cleaning up cookies", e);
  }
}

function pgScheduleCookieCleanup() {
  try {
    browser.alarms.clear(PG_AUTO_DELETE_ALARM_NAME);
    
    if (!pgShouldAutoDeleteCookies()) return;
    
    const lifetimeStr = pgAutoDeleteSettings.cookieLifetime || "7d";
    const lifetimeSeconds = pgParseDurationToSeconds(lifetimeStr);
    if (!lifetimeSeconds || lifetimeSeconds <= 0) return;
    
    const checkInterval = Math.min(lifetimeSeconds / 2, 3600);
    
    browser.alarms.create(PG_AUTO_DELETE_ALARM_NAME, {
      periodInMinutes: Math.max(1, Math.floor(checkInterval / 60))
    });
  } catch (e) {
    console.warn("[PrivacyGuard] auto_delete_cookies: failed to schedule cleanup", e);
  }
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm && alarm.name === PG_AUTO_DELETE_ALARM_NAME) {
    await pgCleanupOldCookies();
  }
});

pgScheduleCookieCleanup();
setTimeout(() => pgCleanupOldCookies(), 5000);
