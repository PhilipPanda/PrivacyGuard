console.log("[PrivacyGuard] module loaded: proxy_manager");

var pgProxySettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

function pgClampInt(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  n = Math.floor(n);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function pgCleanHost(s) {
  if (!s) return "";
  s = String(s).trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.split(":")[0];
  return s.trim();
}

async function pgSetProxyStatus(obj) {
  try {
    await browser.storage.local.set({
      pg_proxy_status: Object.assign(
        {
          at: new Date().toISOString(),
          applied: false,
          lastError: null,
          mode: "off",
          detail: ""
        },
        obj || {}
      )
    });
  } catch (e) {}
}

async function pgApplyProxy(s) {
  if (!browser.proxy || !browser.proxy.settings || typeof browser.proxy.settings.set !== "function") {
    await pgSetProxyStatus({ applied: false, mode: "off", lastError: "proxy API unavailable" });
    return;
  }

  if (!s.enabled || !s.proxyEnabled) {
    try {
      await browser.proxy.settings.set({ value: { proxyType: "direct" } });
      await pgSetProxyStatus({ applied: true, mode: "off", lastError: null, detail: "" });
    } catch (e) {
      await pgSetProxyStatus({ applied: false, mode: "off", lastError: String(e && e.message ? e.message : e) });
    }
    return;
  }

  const type = (s.proxyType || "socks").toLowerCase();
  const host = pgCleanHost(s.proxyHost);
  const port = pgClampInt(s.proxyPort, 1, 65535);
  const user = String(s.proxyUsername || "");
  const pass = String(s.proxyPassword || "");
  const proxyDNS = !!s.proxyDNS;

  if (!host) {
    await pgSetProxyStatus({ applied: false, mode: type, lastError: "Missing proxy host" });
    return;
  }

  try {
    if (type === "socks") {
      await browser.proxy.settings.set({
        value: {
          proxyType: "manual",
          socks: host,
          socksPort: port,
          socksVersion: 5,
          proxyDNS: proxyDNS
        }
      });
      await pgSetProxyStatus({ applied: true, mode: "socks", lastError: null, detail: host + ":" + port });
      return;
    }

    if (type === "http" || type === "https") {
      const base = host + ":" + port;
      await browser.proxy.settings.set({
        value: {
          proxyType: "manual",
          http: base,
          ssl: base
        }
      });

      if (user || pass) {
        await pgSetProxyStatus({
          applied: true,
          mode: type,
          lastError: null,
          detail: base + " (auth handled by browser prompt)"
        });
      } else {
        await pgSetProxyStatus({ applied: true, mode: type, lastError: null, detail: base });
      }

      return;
    }

    await pgSetProxyStatus({ applied: false, mode: type, lastError: "Unknown proxy type" });
  } catch (e) {
    await pgSetProxyStatus({ applied: false, mode: type, lastError: String(e && e.message ? e.message : e) });
  }
}

(async () => {
  try {
    pgProxySettings = await pgGetSettings();
  } catch (e) {}
  await pgApplyProxy(pgProxySettings);
})();

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;
  if (!changes[key] || !changes[key].newValue) return;

  pgProxySettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS, changes[key].newValue);
  await pgApplyProxy(pgProxySettings);
});
