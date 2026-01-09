var PrivacyGuardConstants = {
  STORAGE_KEY: "settings",
  
  VERSION: "0.1.2",
  EXTENSION_NAME: "PrivacyGuard",

  DEFAULT_SETTINGS: {
    enabled: true,

    alwaysHTTPS: true,
    stripUTMParams: true,
    blockAds: true,

    decoyTraffic: false,
    decoyMinInterval: "30m",
    decoyMaxInterval: "2h",
    decoySites: [
      "wikipedia.org",
      "mozilla.org",
      "bbc.com",
      "reuters.com",
      "theguardian.com",
      "apnews.com",
      "nasa.gov",
      "who.int",
      "openstreetmap.org"
    ],

    proxyEnabled: false,
    proxyType: "socks",
    proxyHost: "",
    proxyPort: 1080,
    proxyUsername: "",
    proxyPassword: "",
    proxyDNS: true,

    antiFingerprint: false,

    manageReferrer: false,
    referrerMode: "no-referrer",

    manageUserAgent: false,
    userAgentMode: "random",
    customUserAgent: "",

    blockTrackers: false,
    blockThirdPartyCookies: false,
    
    autoDeleteCookies: false,
    cookieLifetime: "7d"
  },

  ADBLOCK_SOURCES: [
    "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext",
    "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
    "https://filters.adtidy.org/extension/ublock/filters/2.txt",
    "https://filters.adtidy.org/extension/ublock/filters/3.txt",
    "https://easylist.to/easylist/easylist.txt",
    "https://easylist.to/easylist/easyprivacy.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt"
  ],

  ADBLOCK_UPDATE_INTERVAL_MINUTES: 60 * 24, // 24 hours
  ADBLOCK_FETCH_TIMEOUT_MS: 30000, // 30 seconds

  MSG: {
    GET_SETTINGS: "GET_SETTINGS",
    SET_SETTINGS: "SET_SETTINGS",

    ADBLOCK_GET_STATUS: "ADBLOCK_GET_STATUS",
    ADBLOCK_UPDATE: "ADBLOCK_UPDATE",

    HTTPWARN_ALLOW_ONCE: "HTTPWARN_ALLOW_ONCE"
  },
  
  HTTP_WARN_BYPASS_TIMEOUT_MS: 30000, // 30 seconds
  
  DECOY_REQUEST_TIMEOUT_MS: 8000, // 8 seconds
  DECOY_MIN_INTERVAL_SECONDS: 1,
  DECOY_MAX_INTERVAL_SECONDS: 7 * 86400, // 7 days
};
