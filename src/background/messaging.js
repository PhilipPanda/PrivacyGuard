browser.runtime.onMessage.addListener(async function(msg, sender) {
  try {
    if (!sender || sender.id !== browser.runtime.id) {
      return { error: "Unauthorized message sender" };
    }

    var validated = pgValidateMessage(msg);
    if (!validated.ok) {
      return { error: validated.error };
    }

    switch (validated.type) {
      case PG_MESSAGE_TYPES.GET_SETTINGS: {
        return { settings: await pgGetSettings() };
      }
      case PG_MESSAGE_TYPES.SET_SETTINGS: {
        return { ok: true, settings: await pgSetSettings(msg.settings) };
      }
      case PG_MESSAGE_TYPES.ADBLOCK_GET_STATUS: {
        return { status: typeof pgAdblockGetStatus === "function" ? pgAdblockGetStatus() : null };
      }
      case PG_MESSAGE_TYPES.ADBLOCK_UPDATE: {
        return { status: typeof pgAdblockUpdateLists === "function" ? await pgAdblockUpdateLists() : null };
      }
      case PG_MESSAGE_TYPES.HTTPWARN_ALLOW_ONCE: {
        var tabId = Number(msg.tabId);
        var url = String(msg.url || "");
        return { ok: typeof pgHttpWarnAllowOnce === "function" ? pgHttpWarnAllowOnce(tabId, url) : false };
      }
      case PG_MESSAGE_TYPES.GET_STATS: {
        return { stats: typeof pgGetStats === "function" ? pgGetStats() : null };
      }
      case PG_MESSAGE_TYPES.RESET_STATS: {
        return { stats: typeof pgResetStats === "function" ? await pgResetStats() : null };
      }
      case PG_MESSAGE_TYPES.GET_FEATURES: {
        return { features: pgListFeatures() };
      }
      default: {
        return { error: "Unknown message type" };
      }
    }
  } catch (error) {
    pgLog("error", "messaging", "Failed to process message", {
      type: msg && msg.type ? msg.type : null,
      error: String(error && error.message ? error.message : error)
    });
    return { error: "Internal message handling error" };
  }
});
