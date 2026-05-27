import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import OrderShareCard from "./OrderShareCard.jsx";
import { generateOrderReceiptPdf } from "../utils/orderReceiptPdf.js";
import { captureNodeAsJpegBlob, resolveShareLogoSrc } from "../../lib/orderShareExport.js";
import { shareDebug } from "../../lib/shareDebug.js";
import {
  canShareFiles,
  copyShareText,
  isIosDevice,
  openWhatsappOnIos,
  openWhatsappText,
  shareLog,
} from "../../lib/sharePlatform.js";
import {
  buildWhatsAppMessage,
  enrichShareOrder,
  normalizeShareOrder,
  orderFileBaseName,
} from "../utils/orderShare.js";

const IOS_WHATSAPP_INFO =
  "Order text copied. WhatsApp will open now. Paste the text in the chat and attach the downloaded receipt if needed.";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OrderShareModal({ open, order, onClose, customers, customer }) {
  const normalizedOrder = normalizeShareOrder(enrichShareOrder(order, customer ?? customers));
  const exportRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");
  const [info, setInfo] = useState("");
  const [exportLogoSrc, setExportLogoSrc] = useState(null);
  const isBusy = Boolean(busyAction);
  const ios = isIosDevice();

  useEffect(() => {
    if (!open) {
      setExportLogoSrc(null);
      return;
    }
    let cancelled = false;
    resolveShareLogoSrc()
      .then((src) => {
        if (!cancelled) setExportLogoSrc(src);
      })
      .catch(() => {
        if (!cancelled) setExportLogoSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, normalizedOrder?.id]);

  if (!open || !normalizedOrder) return null;

  const whatsappMessage = () => buildWhatsAppMessage(normalizedOrder);
  const jpgFilename = () => `${orderFileBaseName(normalizedOrder)}.jpg`;

  const ensureExportNode = () => {
    if (!exportRef.current) throw new Error("Order card is not ready yet. Please try again.");
    return exportRef.current;
  };

  const loadShareLibs = async () => {
    const { toBlob } = await import("html-to-image");
    return { toBlob };
  };

  const generateJpegBlob = async () => {
    const node = ensureExportNode();
    const { toBlob } = await loadShareLibs();
    return captureNodeAsJpegBlob(node, { toBlob });
  };

  const onDownloadJpg = async () => {
    setBusyAction("jpg");
    setInfo("");
    try {
      const blob = await generateJpegBlob();
      downloadBlob(blob, jpgFilename());
      setInfo("Receipt image downloaded.");
    } catch (e) {
      setInfo(e.message || "Failed to export JPG.");
    } finally {
      setBusyAction("");
    }
  };

  const onDownloadPdf = async () => {
    setBusyAction("pdf");
    setInfo("");
    try {
      const pdf = await generateOrderReceiptPdf(order, { customers, customer });
      pdf.save(`${orderFileBaseName(normalizedOrder)}.pdf`);
    } catch (e) {
      setInfo(e.message || "Failed to export PDF.");
    } finally {
      setBusyAction("");
    }
  };

  const onCopyOrderText = async () => {
    setBusyAction("copy");
    setInfo("");
    const message = whatsappMessage();
    shareLog("generated WhatsApp text", message);
    const copied = await copyShareText(message);
    setInfo(copied ? "Order text copied to clipboard." : "Could not copy — select and copy the text from the card below.");
    setBusyAction("");
  };

  const onManualOpenWhatsapp = async () => {
    const message = whatsappMessage();
    if (!message.trim()) {
      setInfo("Order text is empty.");
      return;
    }
    shareLog("generated WhatsApp text", message);
    if (ios) {
      setBusyAction("wa-open");
      const copied = await copyShareText(message);
      setInfo(copied ? "Order text copied. Opening WhatsApp…" : "Opening WhatsApp — tap Copy order text if paste is empty.");
      openWhatsappOnIos(message);
      setBusyAction("");
      return;
    }
    openWhatsappText(message, { ios: false });
  };

  const onShareWhatsApp = async () => {
    setBusyAction("wa");
    setInfo("");

    const message = whatsappMessage();
    const filename = jpgFilename();

    shareLog("isIOS", ios);
    shareLog("generated WhatsApp text", message);
    shareDebug("WhatsApp message", message);

    if (!message.trim()) {
      setInfo("Order text is empty — cannot share.");
      setBusyAction("");
      return;
    }

    if (ios) {
      shareLog("share path", "ios-copy-download-whatsapp-scheme");
      try {
        const copied = await copyShareText(message);
        shareLog("clipboard copy ok", copied);
        const blob = await generateJpegBlob();
        downloadBlob(blob, filename);
        setInfo(
          copied
            ? IOS_WHATSAPP_INFO
            : `${IOS_WHATSAPP_INFO} If paste is empty, tap Copy order text below.`
        );
        openWhatsappOnIos(message);
      } catch (e) {
        shareLog("ios share failed", e?.message || e);
        const copied = await copyShareText(message);
        setInfo(
          copied
            ? `${e?.message || "Image export failed."} Order text is copied — paste in WhatsApp and attach the JPG if you downloaded it.`
            : e?.message || "Share failed. Use the manual steps below."
        );
        openWhatsappOnIos(message);
      } finally {
        setBusyAction("");
      }
      return;
    }

    try {
      const blob = await generateJpegBlob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      const canShare = canShareFiles(file);
      shareLog("navigator.canShare({ files })", canShare);

      if (canShare) {
        shareLog("share path", "native-share-files");
        try {
          await navigator.share({
            title: "Pawganic Order Summary",
            text: message,
            files: [file],
          });
          setInfo("Shared via your device. Pick WhatsApp to send the image and text.");
          return;
        } catch (e) {
          if (e?.name === "AbortError") {
            setInfo("Share cancelled.");
            return;
          }
          shareLog("native share failed", e?.message || e);
        }
      }

      shareLog("share path", "wa.me-then-download");
      openWhatsappText(message, { ios: false });
      downloadBlob(blob, filename);
      setInfo("WhatsApp opened with the order text. The receipt image was downloaded — attach it in the chat.");
    } catch (e) {
      shareLog("share error", e?.message || e);
      openWhatsappText(message, { ios: false });
      shareLog("share path", "wa.me-only-after-error");
      setInfo(e?.message || "Could not export image. WhatsApp opened with order text only.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <Modal open={open} title="Share order" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-500">
          {ios
            ? "On iPhone, order text is copied to your clipboard, the receipt JPG downloads, then WhatsApp opens. Paste the text in a chat and attach the image if needed."
            : "Share via WhatsApp. On Android and desktop, your device may offer a direct share with the image."}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={onShareWhatsApp}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busyAction === "wa" ? "Sharing..." : "Share via WhatsApp"}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onDownloadPdf}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {busyAction === "pdf" ? "Generating..." : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onDownloadJpg}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {busyAction === "jpg" ? "Generating..." : "Download JPG"}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">Manual steps</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCopyOrderText}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              {busyAction === "copy" ? "Copying..." : "Copy order text"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onDownloadJpg}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              Download JPG
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onManualOpenWhatsapp}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-60"
            >
              Open WhatsApp
            </button>
          </div>
        </div>

        {info ? <p className="text-xs text-slate-600">{info}</p> : null}
        <OrderShareCard order={normalizedOrder} logoSrc={exportLogoSrc || undefined} />
      </div>

      <div className="pointer-events-none fixed -left-[200vw] top-0 z-[-1]">
        <div ref={exportRef} style={{ width: 820, background: "#fff", padding: 12 }}>
          <OrderShareCard order={normalizedOrder} forExport logoSrc={exportLogoSrc || undefined} />
        </div>
      </div>
    </Modal>
  );
}
