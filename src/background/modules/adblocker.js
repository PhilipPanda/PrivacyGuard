console.log("[PrivacyGuard] module loaded: adblocker");

var pgAdblockSettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);

var pgAdblockDomains = new Set();   

var pgAdblockAllow = new Set();     

var pgAdblockStatus = {
  ready: false,
  blockedDomains: 0,
  allowDomains: 0,
  sources: [],
  lastUpdated: null,
  lastError: null
};

var PG_ADBLOCK_ALARM_NAME = "pg-adblock-update";

(async () => {
  try {
    pgAdblockSettings = await pgGetSettings();
  } catch (e) {

  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const key = PrivacyGuardConstants.STORAGE_KEY;

  if (changes[key] && changes[key].newValue) {
    pgAdblockSettings = Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      changes[key].newValue
    );
  }
});

function pgLooksLikeDomain(s) {
  if (!s) return false;
  s = s.trim().toLowerCase();

  if (s.includes(" ") || !s.includes(".")) return false;
  if (/^[0-9.]+$/.test(s)) return false;

  if (s.endsWith(".")) s = s.slice(0, -1);

  if (!/^[a-z0-9.-]+$/.test(s)) return false;
  if (s.startsWith("-") || s.endsWith("-")) return false;
  if (s.includes("..")) return false;

  return true;
}

function pgNormalizeDomain(domain) {
  if (!domain) return null;
  domain = domain.trim().toLowerCase();
  if (domain.endsWith(".")) domain = domain.slice(0, -1);
  return domain;
}

function pgIsLocalish(domain) {
  return (
    domain === "localhost" ||
    domain === "localhost.localdomain" ||
    domain === "local" ||
    domain === "broadcasthost" ||
    domain === "127.0.0.1" ||
    domain === "::1"
  );
}

function pgAddBlockedDomain(domain) {
  domain = pgNormalizeDomain(domain);
  if (!domain) return;
  if (pgIsLocalish(domain)) return;
  if (!pgLooksLikeDomain(domain)) return;
  pgAdblockDomains.add(domain);
}

function pgAddAllowedDomain(domain) {
  domain = pgNormalizeDomain(domain);
  if (!domain) return;
  if (pgIsLocalish(domain)) return;
  if (!pgLooksLikeDomain(domain)) return;
  pgAdblockAllow.add(domain);
}

function pgParseHostsLike(text) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const noComment = line.split("#")[0].trim();
    if (!noComment) continue;

    const parts = noComment.split(/\s+/);

    if (parts.length === 1) {
      pgAddBlockedDomain(parts[0]);
      continue;
    }

    const maybeIp = parts[0];
    const host = parts[1];

    if (!/^[0-9.]+$/.test(maybeIp) && maybeIp !== "::1") {
      pgAddBlockedDomain(maybeIp);
      continue;
    }

    pgAddBlockedDomain(host);
  }
}

function pgParseAdblockNetworkRules(text) {
  const lines = text.split(/\r?\n/);

  for (const lineRaw of lines) {
    let line = lineRaw.trim();
    if (!line) continue;

    if (line.startsWith("!") || line.startsWith("[")) continue;

    if (line.includes("##") || line.includes("#@#")) continue;

    if (line.startsWith("/") && line.endsWith("/")) continue;

    if (line.startsWith("@@||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(4));
      if (domain) pgAddAllowedDomain(domain);
      continue;
    }

    if (line.startsWith("||")) {
      const domain = pgExtractDomainFromDoublePipe(line.slice(2));
      if (domain) pgAddBlockedDomain(domain);
      continue;
    }

    if (line.startsWith("|http://") || line.startsWith("|https://")) {
      line = line.slice(1);
    }
    if (line.startsWith("http://") || line.startsWith("https://")) {
      try {
        const u = new URL(line.split("$")[0]);
        if (u.hostname) pgAddBlockedDomain(u.hostname);
      } catch (e) {}
      continue;
    }
  }
}

function pgExtractDomainFromDoublePipe(rest) {

  let s = rest.split("$")[0];

  const caretIdx = s.indexOf("^");
  if (caretIdx >= 0) s = s.slice(0, caretIdx);

  const slashIdx = s.indexOf("/");
  if (slashIdx >= 0) s = s.slice(0, slashIdx);

  s = s.trim();

  if (!s || s.includes("*")) return null;

  return s;
}

async function pgFetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Fetch failed: " + url + " (" + res.status + ")");
  return await res.text();
}

async function pgAdblockUpdateLists() {
  const sources = PrivacyGuardConstants.ADBLOCK_SOURCES.slice();
  pgAdblockStatus.sources = sources;
  pgAdblockStatus.lastError = null;

  const newBlocked = new Set();
  const newAllow = new Set();

  const oldBlocked = pgAdblockDomains;
  const oldAllow = pgAdblockAllow;
  pgAdblockDomains = newBlocked;
  pgAdblockAllow = newAllow;

  try {
    for (const url of sources) {
      const txt = await pgFetchText(url);

      pgParseHostsLike(txt);
      pgParseAdblockNetworkRules(txt);
    }

    pgAdblockDomains = newBlocked;
    pgAdblockAllow = newAllow;

    pgAdblockStatus.ready = true;
    pgAdblockStatus.blockedDomains = pgAdblockDomains.size;
    pgAdblockStatus.allowDomains = pgAdblockAllow.size;
    pgAdblockStatus.lastUpdated = new Date().toISOString();

    console.log("[PrivacyGuard] adblock updated:", pgAdblockDomains.size, "blocked /", pgAdblockAllow.size, "allowed");
    return pgAdblockGetStatus();
  } catch (e) {

    pgAdblockDomains = oldBlocked;
    pgAdblockAllow = oldAllow;

    pgAdblockStatus.lastError = String(e && e.message ? e.message : e);
    console.warn("[PrivacyGuard] adblock update failed:", e);

    return pgAdblockGetStatus();
  }
}

function pgAdblockGetStatus() {
  return Object.assign({}, pgAdblockStatus, {
    blockedDomains: pgAdblockDomains.size,
    allowDomains: pgAdblockAllow.size
  });
}

function pgHostMatchesSet(host, setObj) {
  if (!host) return false;
  host = host.toLowerCase();

  if (setObj.has(host)) return true;

  let cur = host;
  while (true) {
    const idx = cur.indexOf(".");
    if (idx < 0) break;
    cur = cur.slice(idx + 1);
    if (setObj.has(cur)) return true;
  }

  return false;
}

function pgIsBlockedHost(host) {

  if (pgHostMatchesSet(host, pgAdblockAllow)) return false;
  return pgHostMatchesSet(host, pgAdblockDomains);
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const s = pgAdblockSettings;
    if (!s.enabled || !s.blockAds) return {};

    try {
      const u = new URL(details.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return {};

      if (pgIsBlockedHost(u.hostname)) {
        return { cancel: true };
      }
    } catch (e) {
      return {};
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

function pgEnsureAdblockAlarm() {
  try {
    browser.alarms.create(PG_ADBLOCK_ALARM_NAME, { periodInMinutes: 60 * 24 });
  } catch (e) {}
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === PG_ADBLOCK_ALARM_NAME) {
    pgAdblockUpdateLists();
  }
});

pgEnsureAdblockAlarm();
pgAdblockUpdateLists();

