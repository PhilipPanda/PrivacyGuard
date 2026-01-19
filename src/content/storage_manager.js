(function() {
  'use strict';

  if (typeof browser === 'undefined' || !browser.runtime) return;

  browser.runtime.sendMessage({
    type: 'GET_SETTINGS'
  }).then(response => {
    if (response && response.settings) {
      const shouldManage = !!(response.settings.enabled && response.settings.manageStorage);
      if (shouldManage) {
        const mode = response.settings.storageMode || "clear-on-close";
        initStorageManagement(mode);
      }
    }
  }).catch(() => {
  });

  function initStorageManagement(mode) {
    if (mode === "block") {
      try {
        const originalLocalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          console.log("[PrivacyGuard] storage_manager: blocked localStorage.setItem", key);
          return;
        };
        
        const originalSessionSetItem = sessionStorage.setItem;
        sessionStorage.setItem = function(key, value) {
          console.log("[PrivacyGuard] storage_manager: blocked sessionStorage.setItem", key);
          return;
        };
        
        if (window.indexedDB) {
          const originalOpen = indexedDB.open;
          indexedDB.open = function() {
            console.log("[PrivacyGuard] storage_manager: blocked indexedDB.open");
            return {
              onerror: null,
              onsuccess: null,
              onblocked: null,
              addEventListener: function() {},
              removeEventListener: function() {}
            };
          };
        }
      } catch (e) {
      }
    } else if (mode === "clear-on-navigation") {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function() {
        clearStorage();
        return originalPushState.apply(this, arguments);
      };
      
      history.replaceState = function() {
        clearStorage();
        return originalReplaceState.apply(this, arguments);
      };
      
      window.addEventListener('popstate', clearStorage);
    }
    
    console.log("[PrivacyGuard] storage_manager: initialized with mode", mode);
  }

  function clearStorage() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
    }
  }
})();
