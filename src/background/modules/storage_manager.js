pgLog("info", "storage_manager", "Module loaded");

var pgStorageSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
var pgTabOrigins = new Map();

function pgShouldManageStorage() {
  return pgIsFeatureEnabled("storage_manager", pgStorageSettings);
}

function pgTrackTabOrigin(tabId, tab) {
  if (!tab || !tab.url) return;

  var parsed = pgSafeParseUrl(tab.url);
  if (!parsed) return;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;

  pgTabOrigins.set(tabId, parsed.origin);
}

async function pgHandleTabClosed(tabId) {
  if (!pgShouldManageStorage()) return;

  var mode = pgStorageSettings.storageMode || "clear-on-close";
  if (mode !== "clear-on-close") return;

  var origin = pgTabOrigins.get(tabId);
  pgTabOrigins.delete(tabId);
  if (!origin) return;

  try {
    await browser.browsingData.remove(
      { origins: [origin] },
      { localStorage: true, indexedDB: true }
    );
    pgLog("debug", "storage_manager", "Cleared storage for origin", { origin: origin });
  } catch (error) {
    pgLog("warn", "storage_manager", "Failed to clear origin storage", {
      origin: origin,
      error: String(error)
    });
  }
}

pgSubscribeSettings(function(nextSettings) {
  pgStorageSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, nextSettings);
});

browser.tabs.onUpdated.addListener(function(tabId, _changeInfo, tab) {
  pgTrackTabOrigin(tabId, tab);
});

browser.tabs.onRemoved.addListener(function(tabId) {
  pgHandleTabClosed(tabId).catch(function(error) {
    pgLog("warn", "storage_manager", "Tab close handler failed", { error: String(error) });
  });
});
