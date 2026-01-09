async function pgGetSettings() {
  try {
    const key = PrivacyGuardConstants.STORAGE_KEY;
    const stored = await browser.storage.local.get(key);
    
    if (!stored || typeof stored !== "object") {
      return Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
    }
    
    const settings = stored[key];
    if (!settings || typeof settings !== "object") {
      return Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
    }
    
    // Merge with defaults to ensure all keys exist
    return Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      settings
    );
  } catch (e) {
    console.error("[PrivacyGuard] settings: failed to get settings", e);
    return Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
  }
}

async function pgSetSettings(nextSettings) {
  try {
    if (!nextSettings || typeof nextSettings !== "object") {
      throw new Error("Invalid settings object");
    }
    
    const key = PrivacyGuardConstants.STORAGE_KEY;
    
    // Validate and merge with defaults
    const validated = Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      nextSettings
    );
    
    await browser.storage.local.set({ [key]: validated });
    return validated;
  } catch (e) {
    console.error("[PrivacyGuard] settings: failed to set settings", e);
    throw e;
  }
}
