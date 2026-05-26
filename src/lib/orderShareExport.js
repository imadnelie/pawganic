import {
  loadPawganicLogoDataUrl,
  pawganicLogoUrl,
  prepareLogoImagesInNode,
} from "./pawganicLogo.js";
import { shareDebug } from "./shareDebug.js";

/** Preload logo; returns data URL or falls back to asset URL. */
export async function resolveShareLogoSrc() {
  try {
    return await loadPawganicLogoDataUrl();
  } catch {
    shareDebug("logo fallback", pawganicLogoUrl);
    return pawganicLogoUrl;
  }
}

/** Ensure export DOM (html-to-image) has inlined logo and loaded images. */
export async function prepareHtmlExportNode(node, logoDataUrl) {
  const src = logoDataUrl || (await resolveShareLogoSrc());
  await prepareLogoImagesInNode(node, src);
  return src;
}

export async function captureNodeAsJpegBlob(node, { toBlob }) {
  await prepareHtmlExportNode(node);
  const blob = await toBlob(node, {
    pixelRatio: 2,
    quality: 0.95,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  if (!blob) throw new Error("Could not generate image.");
  return blob;
}
