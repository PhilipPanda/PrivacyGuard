(function() {
  'use strict';

  initAntiFingerprinting();
  
  if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.sendMessage({
      type: 'GET_SETTINGS'
    }).then(response => {
      if (response && response.settings) {
        const shouldBeEnabled = !!(response.settings.enabled && response.settings.antiFingerprint);
        if (!shouldBeEnabled) {
          console.log("[PrivacyGuard] anti-fingerprinting disabled by settings");
        }
      }
    }).catch(() => {
    });
  }

  function initAntiFingerprinting() {
  
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  
  function addCanvasNoise(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < 0.01) {
          const noise = (Math.random() - 0.5) * 10;
          data[i] = Math.min(255, Math.max(0, data[i] + noise));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
    }
  }
  
  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    addCanvasNoise(this);
    return originalToDataURL.apply(this, arguments);
  };
  
  HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
    addCanvasNoise(this);
    return originalToBlob.apply(this, arguments);
  };
  
  CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
    const imageData = originalGetImageData.apply(this, arguments);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < 0.01) {
        const noise = (Math.random() - 0.5) * 10;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
    }
    
    return imageData;
  };
  
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) {
      return 'Intel Inc.';
    }
    if (parameter === 37446) {
      return 'Intel Iris OpenGL Engine';
    }
    return getParameter.apply(this, arguments);
  };
  
  const originalPerformanceNow = Performance.now;
  Performance.now = function() {
    return Math.floor(originalPerformanceNow.apply(this, arguments) / 100) * 100;
  };
  
  if (navigator.getBattery) {
    const originalGetBattery = navigator.getBattery;
    navigator.getBattery = function() {
      return originalGetBattery.apply(this, arguments).then(function(battery) {
        const originalLevel = battery.level;
        const originalCharging = battery.charging;
        
        Object.defineProperty(battery, 'level', {
          get: function() {
            return Math.round(originalLevel * 10) / 10;
          }
        });
        
        return battery;
      });
    };
  }
  
  const originalScreenWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width');
  const originalScreenHeight = Object.getOwnPropertyDescriptor(Screen.prototype, 'height');
  
  Object.defineProperty(Screen.prototype, 'width', {
    get: function() {
      const width = originalScreenWidth.get.apply(this);
      return Math.floor(width / 10) * 10;
    }
  });
  
  Object.defineProperty(Screen.prototype, 'height', {
    get: function() {
      const height = originalScreenHeight.get.apply(this);
      return Math.floor(height / 10) * 10;
    }
  });
  
  const originalPluginsLength = Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins');
  Object.defineProperty(navigator, 'plugins', {
    get: function() {
      const plugins = originalPluginsLength.get.apply(this);
      return {
        length: Math.min(plugins.length, 3),
        item: function(index) {
          return plugins.item ? plugins.item(index) : plugins[index] || null;
        },
        namedItem: function(name) {
          return plugins.namedItem ? plugins.namedItem(name) : null;
        },
        refresh: function() {}
      };
    }
  });
  
  if (document.fonts && document.fonts.check) {
    const originalCheck = document.fonts.check;
    document.fonts.check = function(font) {
      const uncommonFonts = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
      if (typeof font === 'string' && !uncommonFonts.some(f => font.includes(f))) {
        return false;
      }
      return originalCheck.apply(this, arguments);
    };
  }
  
  const originalHardwareConcurrency = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency');
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: function() {
      const cores = originalHardwareConcurrency.get.apply(this);
      return Math.min(cores, 4);
    }
  });
  
  if (navigator.deviceMemory) {
    const originalDeviceMemory = Object.getOwnPropertyDescriptor(Navigator.prototype, 'deviceMemory');
    Object.defineProperty(navigator, 'deviceMemory', {
      get: function() {
        const memory = originalDeviceMemory.get.apply(this);
        return Math.min(memory || 8, 8);
      }
    });
  }
  
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function() {
    const offset = originalGetTimezoneOffset.apply(this);
    return Math.floor(offset / 60) * 60;
  };
  
  const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
  RTCPeerConnection.prototype.createOffer = function() {
    return originalCreateOffer.apply(this, arguments).then(function(offer) {
      if (offer.sdp) {
        offer.sdp = offer.sdp.replace(/\d+\.\d+\.\d+\.\d+/g, '0.0.0.0');
      }
      return offer;
    });
  };
  
    console.log("[PrivacyGuard] anti-fingerprinting content script initialized");
  }
})();
