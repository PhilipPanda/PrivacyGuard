browser.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log("[PrivacyGuard] installed/updated:", details.reason);
    
    const settings = await pgGetSettings();
    await pgSetSettings(settings);
    
    // Initialize adblock on install
    if (details.reason === "install" && typeof pgAdblockUpdateLists === "function") {
      setTimeout(() => {
        pgAdblockUpdateLists().catch(e => {
          console.warn("[PrivacyGuard] failed to initialize adblock on install", e);
        });
      }, 1000);
    }
  } catch (e) {
    console.error("[PrivacyGuard] onInstalled handler failed", e);
  }
});
