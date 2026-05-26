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

/**
 * Open WhatsApp with prefilled text.
 * On iOS, use same-tab navigation so Safari does not block the deep link after async work.
 */
export function openWhatsappText(message, { ios = false } = {}) {
  const text = String(message || "").trim();
  if (!text) {
    shareLog("openWhatsappText skipped", "empty message");
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  shareLog("WhatsApp URL length", url.length);
  if (ios) {
    window.location.assign(url);
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
}
