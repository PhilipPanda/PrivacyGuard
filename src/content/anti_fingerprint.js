(function() {
  "use strict";

  if (typeof browser === "undefined" || !browser.runtime || !browser.runtime.sendMessage) return;

  init().catch(function() {
    // Do not throw in page context.
  });

  async function init() {
    var response = await browser.runtime.sendMessage({ type: "GET_SETTINGS" });
    var settings = response && response.settings ? response.settings : null;
    var enabled = !!(settings && settings.enabled && settings.antiFingerprint);
    if (!enabled) return;

    applyCanvasNoiseProtection();
    applyTimingProtection();
    applyHardwareProtection();
  }

  function applyCanvasNoiseProtection() {
    if (!window.HTMLCanvasElement || !window.CanvasRenderingContext2D) return;

    var originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    var originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    if (typeof originalToDataURL === "function") {
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        pgAddCanvasNoise(this);
        return originalToDataURL.call(this, type, quality);
      };
    }

    if (typeof originalGetImageData === "function") {
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        var imageData = originalGetImageData.call(this, sx, sy, sw, sh);
        pgMutateImageData(imageData);
        return imageData;
      };
    }
  }

  function applyTimingProtection() {
    if (!window.Performance || typeof Performance.now !== "function") return;
    var originalNow = Performance.now;
    Performance.now = function() {
      return Math.floor(originalNow.call(performance));
    };
  }

  function applyHardwareProtection() {
    try {
      var hcDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "hardwareConcurrency");
      if (hcDescriptor && typeof hcDescriptor.get === "function") {
        Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
          get: function() {
            var value = Number(hcDescriptor.get.call(this) || 4);
            return Math.min(Math.max(2, value), 8);
          },
          configurable: true
        });
      }
    } catch (_error) {}
  }

  function pgAddCanvasNoise(canvas) {
    try {
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pgMutateImageData(imageData);
      ctx.putImageData(imageData, 0, 0);
    } catch (_error) {}
  }

  function pgMutateImageData(imageData) {
    if (!imageData || !imageData.data) return;
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 64) {
      data[i] = Math.min(255, data[i] + 1);
    }
  }
})();
