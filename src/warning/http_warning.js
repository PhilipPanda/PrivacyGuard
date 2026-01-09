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
  try {
    const originalUrl = pgGetParam("url") || "";
    const tabIdParam = Number(pgGetParam("tabId"));
    const tabId = Number.isFinite(tabIdParam) && tabIdParam >= 0 ? tabIdParam : await pgGetTabIdFallback();

    const dest = document.getElementById("dest");
    if (dest) {
      dest.textContent = originalUrl || "Unknown URL";
    }

    const goBack = document.getElementById("goBack");
    const tryHttps = document.getElementById("tryHttps");
    const cont = document.getElementById("continue");

    if (goBack) {
      goBack.addEventListener("click", async () => {
        try {
          if (Number.isFinite(tabId) && tabId >= 0) {
            try {
              await browser.tabs.goBack(tabId);
              return;
            } catch (e) {
              console.warn("[PrivacyGuard] http_warning: goBack failed, trying about:blank", e);
            }
            try {
              await browser.tabs.update(tabId, { url: "about:blank" });
              return;
            } catch (e) {
              console.warn("[PrivacyGuard] http_warning: update to about:blank failed", e);
            }
          }
          window.close();
        } catch (e) {
          console.error("[PrivacyGuard] http_warning: goBack handler failed", e);
          window.close();
        }
      });
    }

    if (tryHttps) {
      tryHttps.addEventListener("click", async () => {
        try {
          const httpsUrl = pgToHttps(originalUrl);
          if (!httpsUrl) {
            alert("Could not convert URL to HTTPS.");
            return;
          }
          
          if (Number.isFinite(tabId) && tabId >= 0) {
            await browser.tabs.update(tabId, { url: httpsUrl });
          }
        } catch (e) {
          console.error("[PrivacyGuard] http_warning: tryHttps handler failed", e);
          alert("Failed to upgrade to HTTPS. Please try again.");
        }
      });
    }

    if (cont) {
      cont.addEventListener("click", async () => {
        try {
          if (!Number.isFinite(tabId) || tabId < 0 || !originalUrl) {
            alert("Invalid tab or URL. Cannot continue.");
            return;
          }

          await browser.runtime.sendMessage({
            type: PrivacyGuardConstants.MSG.HTTPWARN_ALLOW_ONCE,
            tabId: tabId,
            url: originalUrl
          });

          await browser.tabs.update(tabId, { url: originalUrl });
        } catch (e) {
          console.error("[PrivacyGuard] http_warning: continue handler failed", e);
          alert("Failed to continue. Please try again.");
        }
      });
    }
  } catch (e) {
    console.error("[PrivacyGuard] http_warning: initialization failed", e);
  }
});
