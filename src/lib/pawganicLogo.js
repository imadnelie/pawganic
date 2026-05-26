import logoAssetUrl from "../../imgs/PawganicLogo.jpg";
import { shareDebug } from "./shareDebug.js";

/** Vite-resolved URL (hashed in production under /assets/…). */
export const pawganicLogoUrl = logoAssetUrl;

let cachedDataUrl = null;
let loadPromise = null;

/**
 * Load logo as a data URL via fetch — avoids CORS/canvas taint issues with
 * crossOrigin on production static assets and works reliably in jsPDF / html-to-image.
 */
export function loadPawganicLogoDataUrl() {
  if (cachedDataUrl) return Promise.resolve(cachedDataUrl);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    shareDebug("logo asset URL", pawganicLogoUrl);
    const res = await fetch(pawganicLogoUrl, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Logo fetch failed (${res.status})`);
    }
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Logo read failed"));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:")) {
      throw new Error("Invalid logo data URL");
    }
    cachedDataUrl = dataUrl;
    shareDebug("logo data URL ready", true);
    return dataUrl;
  })().catch((err) => {
    loadPromise = null;
    shareDebug("logo load failed", err?.message || err);
    throw err;
  });

  return loadPromise;
}

/** Apply data URL to logo imgs and wait until every img in root has loaded. */
export async function prepareLogoImagesInNode(root, logoDataUrl) {
  if (!root) return;
  const src = logoDataUrl || (await loadPawganicLogoDataUrl());
  const logoImgs = root.querySelectorAll("img[data-pawganic-logo]");
  for (const img of logoImgs) {
    img.removeAttribute("crossorigin");
    img.src = src;
  }
  await waitForImages(root);
  shareDebug("logo images ready in export node", logoImgs.length);
}

export function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );
}
