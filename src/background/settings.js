/**
 * Load extension settings cache from storage.
 * @returns {Promise<object>} Loaded settings.
 */
async function pgInitSettings() {
  return pgLoadSettings();
}

/**
 * Persist extension settings.
 * @param {object} nextSettings Settings object to persist.
 * @returns {Promise<object>} Stored settings snapshot.
 */
async function pgSetSettings(nextSettings) {
  return pgUpdateSettings(nextSettings);
}
