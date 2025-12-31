browser.runtime.onMessage.addListener(async (msg) => {
  try {
    if (!msg || !msg.type) return {};

    if (msg.type === PrivacyGuardConstants.MSG.GET_SETTINGS) {
      const s = await pgGetSettings();
      return { settings: s };
    }

    if (msg.type === PrivacyGuardConstants.MSG.SET_SETTINGS) {
      const cur = await pgGetSettings();
      const next = Object.assign({}, cur, msg.settings || {});
      await pgSetSettings(next);
      return { ok: true, settings: next };
    }

    if (msg.type === PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS) {
      if (typeof pgAdblockGetStatus === "function") return { status: pgAdblockGetStatus() };
      return { status: null };
    }

    if (msg.type === PrivacyGuardConstants.MSG.ADBLOCK_UPDATE) {
      if (typeof pgAdblockUpdateLists === "function") return { status: await pgAdblockUpdateLists() };
      return { status: null };
    }

    if (msg.type === PrivacyGuardConstants.MSG.HTTPWARN_ALLOW_ONCE) {
      const tabId = Number(msg.tabId);
      const url = String(msg.url || "");
      const ok = pgHttpWarnAllowOnce(tabId, url);
      return { ok: ok };
    }

    return {};
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
});
