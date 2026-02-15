var pgFeatureRegistry = new Map();

/**
 * Register a feature entry.
 * @param {string} name Feature identifier.
 * @param {object} descriptor Feature metadata and hooks.
 * @returns {void}
 */
function pgRegisterFeature(name, descriptor) {
  var id = String(name || "").trim();
  if (!id) return;
  if (!descriptor || typeof descriptor !== "object") return;

  pgFeatureRegistry.set(id, Object.assign({ enabledByDefault: true }, descriptor));
}

/**
 * Return all registered features.
 * @returns {Array<object>} Features list.
 */
function pgListFeatures() {
  var features = [];
  pgFeatureRegistry.forEach(function(descriptor, id) {
    features.push({
      id: id,
      enabledByDefault: !!descriptor.enabledByDefault,
      settingKey: descriptor.settingKey || null,
      description: descriptor.description || ""
    });
  });
  return features;
}

/**
 * Returns whether a feature should be enabled for current settings.
 * @param {string} name Feature identifier.
 * @param {object} settings Current settings.
 * @returns {boolean} True if enabled.
 */
function pgIsFeatureEnabled(name, settings) {
  var descriptor = pgFeatureRegistry.get(String(name || ""));
  if (!descriptor) return false;

  var s = settings && typeof settings === "object" ? settings : {};
  if (s.enabled === false) return false;
  if (!descriptor.settingKey) return !!descriptor.enabledByDefault;

  return !!s[descriptor.settingKey];
}
