async function pgGetSettings() {
  const res = await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.GET_SETTINGS
  });
  return res.settings || {};
}

async function pgSetSettings(changes) {
  await browser.runtime.sendMessage({
    type: PrivacyGuardConstants.MSG.SET_SETTINGS,
    settings: changes
  });
}

function pgSetUIEnabled(isEnabled) {
  const pill = document.getElementById("statusPill");
  if (pill) {
    pill.textContent = isEnabled ? "ACTIVE" : "OFF";
    pill.style.opacity = isEnabled ? "1" : ".65";
  }

  const btn = document.getElementById("masterBtn");
  if (btn) btn.setAttribute("aria-pressed", isEnabled ? "true" : "false");

  const img = document.getElementById("masterIcon");
  if (img) {
    const nextSrc = isEnabled
      ? "../../assets/icons/icon-1024-on.png"
      : "../../assets/icons/icon-1024-off.png";

    if (img.src && img.src.endsWith(nextSrc)) return;

    img.classList.add("isFading");

    setTimeout(() => {
      img.src = nextSrc;
      requestAnimationFrame(() => img.classList.remove("isFading"));
    }, 130);
  }
}

async function pgLoadPopup() {
  const s = await pgGetSettings();
  pgSetUIEnabled(!!s.enabled);
}

document.addEventListener("DOMContentLoaded", async () => {
  await pgLoadPopup();

  const masterBtn = document.getElementById("masterBtn");
  if (masterBtn) {
    masterBtn.addEventListener("click", async () => {
      const s = await pgGetSettings();
      const next = !s.enabled;
      await pgSetSettings({ enabled: next });
      pgSetUIEnabled(next);
    });
  }

  const openBtn = document.getElementById("openOptions");
  if (openBtn) {
    openBtn.addEventListener("click", async () => {
      if (browser.runtime.openOptionsPage) {
        await browser.runtime.openOptionsPage();
      } else {
        await browser.tabs.create({ url: browser.runtime.getURL("src/options/options.html") });
      }
      window.close();
    });
  }
});
