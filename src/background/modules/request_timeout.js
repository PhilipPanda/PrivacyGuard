pgLog("info", "request_timeout", "Module loaded");

var pgTimeoutSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
var pgTimeoutMap = new Map();

function pgIsRequestTimeoutEnabled() {
  return pgIsFeatureEnabled("request_timeout", pgTimeoutSettings);
}

function pgGetRequestTimeoutMs() {
  return pgClamp(pgTimeoutSettings.requestTimeoutMs, 1000, 300000);
}

/**
 * Handle onBeforeRequest to track potential timeout candidate requests.
 * @param {object} details WebRequest details.
 * @returns {object} WebRequest blocking response.
 */
function pgHandleRequestTimeoutBeforeRequest(details) {
  try {
    if (!pgIsRequestTimeoutEnabled()) return {};
    if (!details || details.type === "main_frame") return {};
    if (!details.requestId) return {};

    var timeoutMs = pgGetRequestTimeoutMs();
    var requestId = String(details.requestId);

    var timerId = setTimeout(function() {
      pgTimeoutMap.delete(requestId);
      pgLog("warn", "request_timeout", "Request timed out", {
        url: details.url,
        timeoutMs: timeoutMs
      });
    }, timeoutMs);

    pgTimeoutMap.set(requestId, timerId);
    return {};
  } catch (error) {
    pgLog("warn", "request_timeout", "Failed to process request timeout", { error: String(error) });
    return {};
  }
}

function pgClearTrackedRequest(requestId) {
  var key = String(requestId || "");
  var timerId = pgTimeoutMap.get(key);
  if (!timerId) return;
  clearTimeout(timerId);
  pgTimeoutMap.delete(key);
}

pgSubscribeSettings(function(nextSettings) {
  pgTimeoutSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, nextSettings);
});

browser.webRequest.onBeforeRequest.addListener(
  pgHandleRequestTimeoutBeforeRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onCompleted.addListener(function(details) {
  if (!details) return;
  pgClearTrackedRequest(details.requestId);
}, { urls: ["<all_urls>"] });

browser.webRequest.onErrorOccurred.addListener(function(details) {
  if (!details) return;
  pgClearTrackedRequest(details.requestId);
}, { urls: ["<all_urls>"] });
