var PG_MESSAGE_TYPES = Object.freeze({
  GET_SETTINGS: PrivacyGuardConstants.MSG.GET_SETTINGS,
  SET_SETTINGS: PrivacyGuardConstants.MSG.SET_SETTINGS,
  ADBLOCK_GET_STATUS: PrivacyGuardConstants.MSG.ADBLOCK_GET_STATUS,
  ADBLOCK_UPDATE: PrivacyGuardConstants.MSG.ADBLOCK_UPDATE,
  HTTPWARN_ALLOW_ONCE: PrivacyGuardConstants.MSG.HTTPWARN_ALLOW_ONCE,
  GET_STATS: "GET_STATS",
  RESET_STATS: "RESET_STATS",
  GET_FEATURES: "GET_FEATURES"
});

/**
 * Validate incoming runtime message payload.
 * @param {unknown} message Message candidate.
 * @returns {{ok:boolean,type?:string,error?:string}}
 */
function pgValidateMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, error: "Message must be an object" };
  }

  var type = String(message.type || "");
  if (!Object.values(PG_MESSAGE_TYPES).includes(type)) {
    return { ok: false, error: "Unsupported message type" };
  }

  if (type === PG_MESSAGE_TYPES.SET_SETTINGS) {
    if (!message.settings || typeof message.settings !== "object") {
      return { ok: false, error: "Invalid settings payload" };
    }
  }

  if (type === PG_MESSAGE_TYPES.HTTPWARN_ALLOW_ONCE) {
    if (!Number.isFinite(Number(message.tabId)) || Number(message.tabId) < 0) {
      return { ok: false, error: "Invalid tabId" };
    }
    if (!String(message.url || "").trim()) {
      return { ok: false, error: "Invalid url" };
    }
  }

  return { ok: true, type: type };
}
