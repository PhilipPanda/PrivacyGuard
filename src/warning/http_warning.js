function pgGetParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function pgToHttps(httpUrl) {
  try {
    const u = new URL(httpUrl);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch (e) {
    return null;
  }
}

async function pgGetTabIdFallback() {
  const qs = await browser.tabs.query({ active: true, currentWindow: true });
  if (qs && qs[0] && Number.isFinite(qs[0].id)) return qs[0].id;
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const originalUrl = pgGetParam("url") || "";
  const tabIdParam = Number(pgGetParam("tabId"));
  const tabId = Number.isFinite(tabIdParam) && tabIdParam >= 0 ? tabIdParam : await pgGetTabIdFallback();

  const dest = document.getElementById("dest");
  if (dest) dest.textContent = originalUrl;

  const goBack = document.getElementById("goBack");
  const tryHttps = document.getElementById("tryHttps");
  const cont = document.getElementById("continue");

  if (goBack) {
    goBack.addEventListener("click", async () => {
      if (Number.isFinite(tabId)) {
        try {
          await browser.tabs.goBack(tabId);
          return;
        } catch (e) {}
        try {
          await browser.tabs.update(tabId, { url: "about:blank" });
          return;
        } catch (e) {}
      }
      window.close();
    });
  }

  if (tryHttps) {
    tryHttps.addEventListener("click", async () => {
      const httpsUrl = pgToHttps(originalUrl);
      if (!httpsUrl) return;
      if (Number.isFinite(tabId)) {
        await browser.tabs.update(tabId, { url: httpsUrl });
      }
    });
  }

  if (cont) {
    cont.addEventListener("click", async () => {
      if (!Number.isFinite(tabId) || !originalUrl) return;

      await browser.runtime.sendMessage({
        type: PrivacyGuardConstants.MSG.HTTPWARN_ALLOW_ONCE,
        tabId: tabId,
        url: originalUrl
      });

      await browser.tabs.update(tabId, { url: originalUrl });
    });
  }
});
