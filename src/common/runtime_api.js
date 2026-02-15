/**
 * Send a runtime message and validate response shape.
 * @param {object} payload Message payload.
 * @returns {Promise<object>} Message response.
 */
async function pgSendMessage(payload) {
  var response = await browser.runtime.sendMessage(payload);
  if (response && response.error) {
    throw new Error(String(response.error));
  }
  return response || {};
}

/**
 * Fetch current settings from background.
 * @returns {Promise<object>} Settings object.
 */
async function pgApiGetSettings() {
  var response = await pgSendMessage({ type: PrivacyGuardConstants.MSG.GET_SETTINGS });
  return response.settings || {};
}

/**
 * Update settings in background.
 * @param {object} changes Partial settings changes.
 * @returns {Promise<object>} Updated settings.
 */
async function pgApiSetSettings(changes) {
  var response = await pgSendMessage({
    type: PrivacyGuardConstants.MSG.SET_SETTINGS,
    settings: changes
  });
  return response.settings || {};
}
