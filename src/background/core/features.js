pgRegisterFeature("always_https", {
  settingKey: "alwaysHTTPS",
  description: "Upgrade top-level navigation from HTTP to HTTPS when possible."
});

pgRegisterFeature("url_cleaner", {
  settingKey: "stripUTMParams",
  description: "Remove known tracking query parameters."
});

pgRegisterFeature("adblocker", {
  settingKey: "blockAds",
  description: "Block known ad and tracker domains."
});

pgRegisterFeature("request_timeout", {
  settingKey: "requestTimeout",
  description: "Abort long-running subresource requests."
});

pgRegisterFeature("storage_manager", {
  settingKey: "manageStorage",
  description: "Clear or restrict site storage data."
});

pgRegisterFeature("proxy_manager", {
  settingKey: "proxyEnabled",
  description: "Route traffic through user-configured proxy."
});
