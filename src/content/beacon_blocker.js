(function() {
  'use strict';

  if (typeof browser === 'undefined' || !browser.runtime) return;

  browser.runtime.sendMessage({
    type: 'GET_SETTINGS'
  }).then(response => {
    if (response && response.settings) {
      const shouldBlock = !!(response.settings.enabled && response.settings.blockBeacons);
      if (shouldBlock) {
        initBeaconBlocking();
      }
    }
  }).catch(() => {
  });

  function initBeaconBlocking() {
    try {
      if (navigator.sendBeacon) {
        const originalSendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function(url, data) {
          console.log("[PrivacyGuard] beacon_blocker: blocked navigator.sendBeacon", url);
          return false;
        };
      }

      if (window.Image) {
        const originalImage = window.Image;
        window.Image = function() {
          const img = new originalImage();
          const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
          
          Object.defineProperty(img, 'src', {
            set: function(value) {
              const url = String(value || "");
              if (url.includes("/beacon") || url.includes("/pixel") || url.includes("/track") || url.includes("1x1.gif") || url.includes("1x1.png") || url.includes("clear.gif") || url.includes("spacer.gif")) {
                console.log("[PrivacyGuard] beacon_blocker: blocked tracking pixel", url);
                return;
              }
              return originalSrcSetter.call(this, value);
            },
            get: function() {
              return this.getAttribute('src') || '';
            },
            configurable: true
          });
          
          return img;
        };
      }

      if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          const urlStr = String(url || "");
          if (urlStr.includes("/beacon") || urlStr.includes("/pixel") || urlStr.includes("/track") || urlStr.includes("/collect") || urlStr.includes("/analytics")) {
            console.log("[PrivacyGuard] beacon_blocker: blocked fetch beacon", urlStr);
            return Promise.reject(new Error("Blocked by PrivacyGuard"));
          }
          return originalFetch.apply(this, arguments);
        };
      }

      if (window.XMLHttpRequest) {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          const urlStr = String(url || "");
          if (urlStr.includes("/beacon") || urlStr.includes("/pixel") || urlStr.includes("/track") || urlStr.includes("/collect") || urlStr.includes("/analytics")) {
            console.log("[PrivacyGuard] beacon_blocker: blocked XHR beacon", urlStr);
            this._blocked = true;
            return;
          }
          return originalOpen.apply(this, arguments);
        };
        
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
          if (this._blocked) {
            return;
          }
          return originalSend.apply(this, arguments);
        };
      }

      console.log("[PrivacyGuard] beacon_blocker: initialized");
    } catch (e) {
    }
  }
})();
