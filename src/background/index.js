browser.runtime.onInstalled.addListener(async function(details) {
  try {
    await pgInitSettings();
    pgLog("info", "bootstrap", "Extension installed/updated", { reason: details.reason });

    if (details.reason === "install" && typeof pgAdblockUpdateLists === "function") {
      setTimeout(function() {
        pgAdblockUpdateLists().catch(function(error) {
          pgLog("warn", "bootstrap", "Failed to initialize adblock on install", { error: String(error) });
        });
      }, 1000);
    }
  } catch (error) {
    pgLog("error", "bootstrap", "onInstalled handler failed", { error: String(error) });
  }
});

(async function bootstrapPrivacyGuard() {
  try {
    await pgInitSettings();
    pgLog("info", "bootstrap", "Background initialized", {
      version: PrivacyGuardConstants.VERSION,
      features: pgListFeatures().length
    });
  } catch (error) {
    pgLog("error", "bootstrap", "Background bootstrap failed", { error: String(error) });
  }
})();
