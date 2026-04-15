import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import OrderShareCard from "./OrderShareCard.jsx";
import { buildWhatsAppMessage, normalizeShareOrder, orderFileBaseName } from "../utils/orderShare.js";

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

export default function OrderShareModal({ open, order, onClose }) {
  const normalizedOrder = normalizeShareOrder(order);
  const exportRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");
  const [info, setInfo] = useState("");
  const isBusy = Boolean(busyAction);

  if (!open || !normalizedOrder) return null;

  const ensureExportNode = () => {
    if (!exportRef.current) throw new Error("Order card is not ready yet. Please try again.");
    return exportRef.current;
  };

  const loadShareLibs = async () => {
    const [{ toBlob, toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
    return { toBlob, toJpeg, jsPDF };
  };

  const generateJpegBlob = async () => {
    const node = ensureExportNode();
    const { toBlob } = await loadShareLibs();
    const blob = await toBlob(node, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    if (!blob) throw new Error("Could not generate image.");
    return blob;
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
      const node = ensureExportNode();
      const { toJpeg, jsPDF } = await loadShareLibs();
      const jpegDataUrl = await toJpeg(node, {
        pixelRatio: 2,
        quality: 0.95,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(jpegDataUrl);
      const maxWidth = pageWidth - 48;
      const ratio = maxWidth / imgProps.width;
      const imgWidth = maxWidth;
      const imgHeight = imgProps.height * ratio;
      const y = Math.max(24, (pageHeight - imgHeight) / 2);
      pdf.addImage(jpegDataUrl, "JPEG", 24, y, imgWidth, imgHeight);
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
    try {
      const blob = await generateJpegBlob();
      const file = new File([blob], `${orderFileBaseName(normalizedOrder)}.jpg`, { type: "image/jpeg" });
      const canNativeShareFile =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canNativeShareFile) {
        await navigator.share({
          title: "Pawganic Order Summary",
          text: message,
          files: [file],
        });
        return;
      }

      openWhatsappText(message);
      setInfo("Direct file share is not supported on this browser. Download JPG/PDF first, then attach in WhatsApp.");
    } catch (e) {
      openWhatsappText(message);
      setInfo("Used WhatsApp text fallback. If you need attachment, download JPG or PDF first.");
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
        <OrderShareCard order={normalizedOrder} />
      </div>

      <div className="pointer-events-none fixed -left-[200vw] top-0 z-[-1]">
        <div ref={exportRef} style={{ width: 820, background: "#fff", padding: 12 }}>
          <OrderShareCard order={normalizedOrder} forExport />
        </div>
      </div>
    </Modal>
  );
}
