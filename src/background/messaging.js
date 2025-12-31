browser.runtime.onMessage.addListener(async (msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === PrivacyGuardConstants.MSG.GET_SETTINGS) {
    return { settings: await pgGetSettings() };
  }

  if (msg.type === PrivacyGuardConstants.MSG.SET_SETTINGS) {
    const current = await pgGetSettings();
    const merged = Object.assign({}, current, msg.settings || {});
    await pgSetSettings(merged);
    return { settings: merged };
  }

  if (msg.type === PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS) {
    if (typeof pgAdblockGetStatus === "function") {
      return { status: pgAdblockGetStatus() };
    }
    return { status: { ready: false, blockedDomains: 0, lastError: "Adblock module not loaded" } };
  }

  if (msg.type === PrivacyGuardConstants.MSG.ADBLOCK_UPDATE) {
    if (typeof pgAdblockUpdateLists === "function") {
      const status = await pgAdblockUpdateLists();
      return { status };
    }
    return { status: { ready: false, blockedDomains: 0, lastError: "Adblock module not loaded" } };
  }
});
