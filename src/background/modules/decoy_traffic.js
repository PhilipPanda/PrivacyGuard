console.log("[PrivacyGuard] module loaded: decoy_traffic");

var pgDecoySettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
var pgDecoyTimerId = null;
var pgDecoyRunning = false;

function pgClearDecoyTimer() {
  if (pgDecoyTimerId !== null) {
    clearTimeout(pgDecoyTimerId);
    pgDecoyTimerId = null;
  }
}

function pgRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pgParseDurationToSeconds(input) {
  if (input === null || input === undefined) return null;

  var s = String(input).trim().toLowerCase();
  if (!s) return null;

  var m = s.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return null;

  var value = parseInt(m[1], 10);
  if (!Number.isFinite(value) || value < 0) return null;

  var unit = m[2] || "m";

  var mult = 60;
  if (unit === "s") mult = 1;
  if (unit === "m") mult = 60;
  if (unit === "h") mult = 60 * 60;
  if (unit === "d") mult = 60 * 60 * 24;

  return value * mult;
}

function pgFormatSecondsCanonical(sec) {
  sec = Math.max(0, Math.floor(sec));

  if (sec % (86400) === 0) return String(sec / 86400) + "d";
  if (sec % (3600) === 0) return String(sec / 3600) + "h";
  if (sec % 60 === 0) return String(sec / 60) + "m";
  return String(sec) + "s";
}

function pgNormalizeHost(line) {
  if (!line) return null;
  var s = String(line).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.split(":")[0];

  if (!s.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (s.includes("..")) return null;

  if (s === "localhost" || s === "127.0.0.1" || s === "::1") return null;

  return s;
}

async function pgLoadDecoySettings() {
  try {
    pgDecoySettings = await pgGetSettings();
  } catch (e) {
    pgDecoySettings = Object.assign({}, PrivacyGuardConstants.DEFAULT_SETTINGS);
  }
}

function pgGetIntervalSecondsFromSettings(s, keyStr, keyOldMinutes, fallbackStr) {
  if (s && typeof s[keyStr] === "string" && s[keyStr].trim()) {
    var parsed = pgParseDurationToSeconds(s[keyStr]);
    if (parsed !== null) return parsed;
  }

  if (s && s[keyOldMinutes] !== undefined && s[keyOldMinutes] !== null) {
    var minutes = Number(s[keyOldMinutes]);
    if (Number.isFinite(minutes) && minutes >= 0) return Math.floor(minutes * 60);
  }

  var fb = pgParseDurationToSeconds(fallbackStr);
  return fb !== null ? fb : 1800;
}

function pgScheduleNextDecoy() {
  pgClearDecoyTimer();

  var s = pgDecoySettings;

  if (!s.enabled || !s.decoyTraffic) return;

  var minSec = pgGetIntervalSecondsFromSettings(
    s,
    "decoyMinInterval",
    "decoyMinMinutes",
    PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval
  );
  var maxSec = pgGetIntervalSecondsFromSettings(
    s,
    "decoyMaxInterval",
    "decoyMaxMinutes",
    PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval
  );

  minSec = Math.max(1, Math.min(minSec, 7 * 86400));
  maxSec = Math.max(1, Math.min(maxSec, 7 * 86400));
  if (maxSec < minSec) maxSec = minSec;

  var delaySec = pgRandomInt(minSec, maxSec);

  pgDecoyTimerId = setTimeout(async () => {
    await pgDoOneDecoyRequest();
    pgScheduleNextDecoy();
  }, delaySec * 1000);

  console.log("[PrivacyGuard] decoy scheduled in", delaySec, "seconds");
}

async function pgDoOneDecoyRequest() {
  if (pgDecoyRunning) return;

  var s = pgDecoySettings;
  if (!s.enabled || !s.decoyTraffic) return;

  var sitesRaw = Array.isArray(s.decoySites) ? s.decoySites : [];
  var sites = sitesRaw.map(pgNormalizeHost).filter(Boolean);

  if (sites.length === 0) return;

  var host = sites[Math.floor(Math.random() * sites.length)];
  var paths = ["/robots.txt", "/favicon.ico", "/humans.txt"];
  var path = paths[Math.floor(Math.random() * paths.length)];
  var url = "https://" + host + path;

  pgDecoyRunning = true;

  var controller = new AbortController();
  var timeout = setTimeout(() => controller.abort(), 8000);

  try {
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal
    });

    await browser.storage.local.set({
      pg_decoy_last: {
        at: new Date().toISOString(),
        url: url
      }
    });

    console.log("[PrivacyGuard] decoy fetched:", url);
  } catch (e) {
    console.log("[PrivacyGuard] decoy fetch failed:", url);
  } finally {
    clearTimeout(timeout);
    pgDecoyRunning = false;
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  var key = PrivacyGuardConstants.STORAGE_KEY;

  if (changes[key] && changes[key].newValue) {
    pgDecoySettings = Object.assign(
      {},
      PrivacyGuardConstants.DEFAULT_SETTINGS,
      changes[key].newValue
    );
    pgScheduleNextDecoy();
  }
});

(async () => {
  await pgLoadDecoySettings();

  var s = pgDecoySettings;

  var minSec = pgGetIntervalSecondsFromSettings(
    s,
    "decoyMinInterval",
    "decoyMinMinutes",
    PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMinInterval
  );
  var maxSec = pgGetIntervalSecondsFromSettings(
    s,
    "decoyMaxInterval",
    "decoyMaxMinutes",
    PrivacyGuardConstants.DEFAULT_SETTINGS.decoyMaxInterval
  );

  try {
    await pgSetSettings(Object.assign({}, s, {
      decoyMinInterval: pgFormatSecondsCanonical(minSec),
      decoyMaxInterval: pgFormatSecondsCanonical(maxSec)
    }));
  } catch (e) {
  }

  pgScheduleNextDecoy();
})();
