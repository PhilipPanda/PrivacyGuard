async function pgGetSettings() {
  const key = PrivacyGuardConstants.STORAGE_KEY;
  const stored = await browser.storage.local.get(key);
  return Object.assign(
    {},
    PrivacyGuardConstants.DEFAULT_SETTINGS,
    stored[key] || {}
  );
}

async function pgSetSettings(nextSettings) {
  const key = PrivacyGuardConstants.STORAGE_KEY;
  await browser.storage.local.set({ [key]: nextSettings });
  return nextSettings;
}
