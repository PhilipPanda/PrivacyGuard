browser.runtime.onMessage.addListener(async (msg, sender) => {
  try {
    if (!msg || typeof msg !== "object" || !msg.type) {
      return { error: "Invalid message format" };
    }

    const msgType = String(msg.type);

    if (msgType === PrivacyGuardConstants.MSG.GET_SETTINGS || msgType === "GET_SETTINGS") {
      const s = await pgGetSettings();
      return { settings: s };
    }

    if (msgType === PrivacyGuardConstants.MSG.SET_SETTINGS) {
      if (!msg.settings || typeof msg.settings !== "object") {
        return { error: "Invalid settings object" };
      }
      
      const cur = await pgGetSettings();
      const next = Object.assign({}, cur, msg.settings);
      await pgSetSettings(next);
      return { ok: true, settings: next };
    }

    if (msgType === PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS) {
      if (typeof pgAdblockGetStatus === "function") {
        return { status: pgAdblockGetStatus() };
      }
      return { status: null };
    }

    if (msgType === PrivacyGuardConstants.MSG.ADBLOCK_UPDATE) {
      if (typeof pgAdblockUpdateLists === "function") {
        return { status: await pgAdblockUpdateLists() };
      }
      return { status: null };
    }

    if (msgType === PrivacyGuardConstants.MSG.HTTPWARN_ALLOW_ONCE) {
      const tabId = Number(msg.tabId);
      const url = String(msg.url || "");
      
      if (!Number.isFinite(tabId) || tabId < 0) {
        return { ok: false, error: "Invalid tabId" };
      }
      
      if (!url) {
        return { ok: false, error: "Invalid url" };
      }
      
      const ok = pgHttpWarnAllowOnce(tabId, url);
      return { ok: ok };
    }

    if (msgType === "GET_STATS") {
      if (typeof pgGetStats === "function") {
        return { stats: pgGetStats() };
      }
      return { stats: null };
    }

    if (msgType === "RESET_STATS") {
      if (typeof pgResetStats === "function") {
        return { stats: await pgResetStats() };
      }
      return { stats: null };
    }

    return { error: "Unknown message type" };
  } catch (e) {
    const errorMsg = String(e && e.message ? e.message : e);
    console.error("[PrivacyGuard] messaging: error handling message", msg?.type, errorMsg);
    return { error: errorMsg };
  }
});
