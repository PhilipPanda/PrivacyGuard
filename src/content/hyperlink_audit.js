(function() {
  'use strict';

  if (typeof browser === 'undefined' || !browser.runtime || !browser.runtime.sendMessage) return;

  browser.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(function(res) {
    if (!res || !res.settings || !res.settings.enabled || !res.settings.disableHyperlinkAuditing) return;
    stripPingFromLinks();
  }).catch(function() {});

  function stripPingFromLinks() {
    function removePing(node) {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'A' && node.hasAttribute && node.hasAttribute('ping')) {
        node.removeAttribute('ping');
      }
      for (var i = 0; i < node.childNodes.length; i++) {
        removePing(node.childNodes[i]);
      }
    }

    removePing(document.documentElement);

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mut) {
        mut.addedNodes.forEach(function(n) {
          if (n.nodeType === 1) removePing(n);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
