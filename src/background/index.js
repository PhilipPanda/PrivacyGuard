browser.runtime.onInstalled.addListener(async () => {
  const settings = await pgGetSettings();
  await pgSetSettings(settings);
});
