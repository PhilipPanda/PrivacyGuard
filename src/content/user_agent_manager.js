(function() {
  'use strict';

  if (typeof browser === 'undefined' || !browser.runtime) return;

  browser.runtime.sendMessage({
    type: 'GET_SETTINGS'
  }).then(response => {
    if (response && response.settings) {
      const shouldManage = !!(response.settings.enabled && response.settings.manageUserAgent);
      if (shouldManage) {
        initUserAgentSpoofing(response.settings);
      }
    }
  }).catch(() => {
  });

  function initUserAgentSpoofing(settings) {
    const mode = settings.userAgentMode || "random";
    
    if (mode === "random") {
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0"
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return randomUA; },
        configurable: true
      });
    } else if (mode === "custom" && settings.customUserAgent) {
      const customUA = String(settings.customUserAgent).trim();
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return customUA; },
        configurable: true
      });
    } else if (mode === "firefox") {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"; },
        configurable: true
      });
    } else if (mode === "chrome") {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; },
        configurable: true
      });
    } else if (mode === "safari") {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"; },
        configurable: true
      });
    }

    if (navigator.platform) {
      Object.defineProperty(navigator, 'platform', {
        get: function() {
          const ua = navigator.userAgent;
          if (ua.includes("Windows")) return "Win32";
          if (ua.includes("Mac")) return "MacIntel";
          if (ua.includes("Linux")) return "Linux x86_64";
          return navigator.platform;
        },
        configurable: true
      });
    }

    console.log("[PrivacyGuard] user-agent spoofing initialized");
  }
})();
