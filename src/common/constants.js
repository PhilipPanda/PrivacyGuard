var PrivacyGuardConstants = {
  STORAGE_KEY: "settings",

  DEFAULT_SETTINGS: {
    enabled: true,

    alwaysHTTPS: true,
    stripUTMParams: true,
    blockAds: true,

    decoyTraffic: false,
    decoyMinInterval: "1s",
    decoyMaxInterval: "24h",
    decoySites: [
      "wikipedia.org",
      "mozilla.org",
      "bbc.com",
      "reuters.com",
      "theguardian.com",
      "apnews.com",
      "nytimes.com",
      "nasa.gov",
      "who.int",
      "openstreetmap.org"
    ],

    blockTrackers: false,
    blockThirdPartyCookies: false
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

  MSG: {
    GET_SETTINGS: "GET_SETTINGS",
    SET_SETTINGS: "SET_SETTINGS",

    ADBLOCK_GET_STATUS: "ADBLOCK_GET_STATUS",
    ADBLOCK_UPDATE: "ADBLOCK_UPDATE"
  }
};
