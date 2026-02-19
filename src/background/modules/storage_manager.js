console.log("[PrivacyGuard] module loaded: storage_manager");

var pgStorageSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

(async () => {
  try {
    pgStorageSettings = await pgGetSettings();
  } catch (e) {
    console.warn("[PrivacyGuard] storage_manager: failed to load settings", e);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (changes[key] && changes[key].newValue) {
    pgStorageSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  }
});

function pgShouldManageStorage() {
  return !!(pgStorageSettings && pgStorageSettings.enabled && pgStorageSettings.manageStorage);
}

var pgTabUrls = new Map();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        pgTabUrls.set(tabId, url.origin);
      }
    } catch (e) {
    }
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        pgTabUrls.set(tabId, url.origin);
      }
    } catch (e) {
    }
  }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  if (!pgShouldManageStorage()) return;
  
  try {
    const mode = pgStorageSettings.storageMode || "clear-on-close";
    
    if (mode === "clear-on-close") {
      const origin = pgTabUrls.get(tabId);
      if (origin) {
        try {
          await browser.browsingData.remove(
            { origins: [origin] },
            {
              localStorage: true,
              indexedDB: true
            }
          );
          console.log("[PrivacyGuard] storage_manager: cleared storage for", origin);
        } catch (e) {
        }
        pgTabUrls.delete(tabId);
      }
    }
  } catch (e) {
    console.warn("[PrivacyGuard] storage_manager: error clearing storage", e);
  }
});
