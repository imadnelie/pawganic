import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import OrderShareCard from "./OrderShareCard.jsx";
import { generateOrderReceiptPdf } from "../utils/orderReceiptPdf.js";
import { captureNodeAsJpegBlob, resolveShareLogoSrc } from "../../lib/orderShareExport.js";
import { shareDebug } from "../../lib/shareDebug.js";
import {
  buildWhatsAppMessage,
  enrichShareOrder,
  normalizeShareOrder,
  orderFileBaseName,
} from "../utils/orderShare.js";

function openWhatsappText(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

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
      downloadBlob(blob, `${orderFileBaseName(normalizedOrder)}.jpg`);
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

  const onShareWhatsApp = async () => {
    setBusyAction("wa");
    setInfo("");
    const message = buildWhatsAppMessage(normalizedOrder);
    shareDebug("WhatsApp message", message);
    shareDebug("message empty?", !String(message || "").trim());

    try {
      const blob = await generateJpegBlob();
      const filename = `${orderFileBaseName(normalizedOrder)}.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      shareDebug("navigator.canShare({ files })", canShareFiles);

      // Reliable text: wa.me always prefills the order summary (native file share often drops text).
      openWhatsappText(message);
      shareDebug("share path", "wa.me text opened");

      if (canShareFiles) {
        try {
          await navigator.share({
            title: "Pawganic Order Summary",
            text: message,
            files: [file],
          });
          shareDebug("share path", "wa.me + native share (files + text attempted)");
          setInfo(
            "WhatsApp opened with the order text. If the image did not attach, use the share sheet or attach the downloaded image."
          );
          return;
        } catch (e) {
          if (e?.name === "AbortError") {
            setInfo("WhatsApp opened with the order text.");
            return;
          }
          shareDebug("native share failed", e?.message || e);
        }
      }

      downloadBlob(blob, filename);
      shareDebug("share path", "wa.me + image download");
      setInfo("WhatsApp opened with the order text. The order image was downloaded — attach it in the chat.");
    } catch (e) {
      shareDebug("share error", e?.message || e);
      openWhatsappText(message);
      shareDebug("share path", "wa.me only (export failed)");
      setInfo(e?.message || "Could not generate image. WhatsApp opened with order text only.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <Modal open={open} title="Share order" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-500">
          Share via WhatsApp. On supported mobile browsers, this tries native file sharing first. Otherwise,
          a WhatsApp text message opens and you can attach the downloaded file manually.
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
