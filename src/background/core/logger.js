var PG_LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

var pgLogLevelName = "info";

function pgSetLogLevel(level) {
  var next = String(level || "").toLowerCase();
  if (PG_LOG_LEVELS[next]) {
    pgLogLevelName = next;
  }
}

function pgShouldLog(level) {
  var target = PG_LOG_LEVELS[String(level || "").toLowerCase()] || PG_LOG_LEVELS.info;
  return target >= PG_LOG_LEVELS[pgLogLevelName];
}

function pgLog(level, context, message, meta) {
  var lvl = String(level || "info").toLowerCase();
  if (!pgShouldLog(lvl)) return;

  var prefix = "[PrivacyGuard][" + lvl.toUpperCase() + "][" + String(context || "core") + "]";
  var details = meta && typeof meta === "object" ? meta : undefined;

  if (lvl === "error") {
    console.error(prefix, message, details || "");
    return;
  }
  if (lvl === "warn") {
    console.warn(prefix, message, details || "");
    return;
  }
  if (lvl === "debug") {
    console.debug(prefix, message, details || "");
    return;
  }
  console.log(prefix, message, details || "");
}
