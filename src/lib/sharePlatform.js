/** Always-on console logging for share debugging (including production on iPhone). */
export function shareLog(label, value) {
  if (value === undefined) {
    console.log(`[share] ${label}`);
    return;
  }
  console.log(`[share] ${label}:`, value);
}

/** iPhone, iPad, and iPadOS desktop mode. */
export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1;
}

export function canShareFiles(file) {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Copy share text to clipboard (used on iOS before opening WhatsApp). */
export async function copyShareText(text) {
  const value = String(text || "").trim();
  if (!value) {
    shareLog("copyShareText skipped", "empty message");
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      shareLog("copyShareText", "navigator.clipboard.writeText");
      return true;
    }
  } catch (e) {
    shareLog("copyShareText clipboard API failed", e?.message || e);
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    shareLog("copyShareText", ok ? "execCommand" : "execCommand failed");
    return ok;
  } catch (e) {
    shareLog("copyShareText fallback failed", e?.message || e);
    return false;
  }
}

/**
 * iOS: open WhatsApp app via custom URL scheme; fall back to wa.me if the app likely did not open.
 */
export function openWhatsappOnIos(message) {
  const text = String(message || "").trim();
  if (!text) {
    shareLog("openWhatsappOnIos skipped", "empty message");
    return;
  }
  const encoded = encodeURIComponent(text);
  const appUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://wa.me/?text=${encoded}`;
  shareLog("WhatsApp app URL length", appUrl.length);

  let appOpened = false;
  const markOpened = () => {
    appOpened = true;
  };
  const onVisibility = () => {
    if (document.hidden) markOpened();
  };

  document.addEventListener("visibilitychange", onVisibility, { passive: true });
  window.addEventListener("pagehide", markOpened, { passive: true });
  window.addEventListener("blur", markOpened, { passive: true });

  shareLog("share path", "ios-whatsapp-scheme");
  window.location.assign(appUrl);

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", markOpened);
    window.removeEventListener("blur", markOpened);
    if (!appOpened) {
      shareLog("share path", "ios-wa.me-fallback");
      window.location.assign(webUrl);
    }
  }, 1200);
}

/**
 * Open WhatsApp with prefilled text (Android / desktop / manual web open).
 */
export function openWhatsappText(message, { ios = false } = {}) {
  const text = String(message || "").trim();
  if (!text) {
    shareLog("openWhatsappText skipped", "empty message");
    return;
  }
  if (ios) {
    openWhatsappOnIos(text);
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  shareLog("share path", "wa.me");
  shareLog("WhatsApp URL length", url.length);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
}
