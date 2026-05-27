import { loadPawganicLogoDataUrl } from "../../lib/pawganicLogo.js";
import { shareDebug } from "../../lib/shareDebug.js";
import { api } from "../../api.js";
import {
  enrichShareOrder,
  formatShareMobile,
  getOrderBreakdown,
  money,
  normalizeShareOrder,
  pickShareField,
} from "./orderShare.js";

const FOREST = [45, 90, 39];
const SLATE_400 = [148, 163, 184];
const SLATE_500 = [100, 116, 139];
const SLATE_600 = [71, 85, 105];
const SLATE_700 = [51, 65, 85];
const SLATE_900 = [15, 23, 42];
const BLUE_LINK = [37, 99, 235];
const PAGE_BG = [248, 250, 252];
const CARD_BORDER = [226, 232, 240];

const A5_WIDTH = 420;
const A5_HEIGHT = 595;
const PAGE_MARGIN = 20;
const CARD_PAD = 22;
const CARD_RADIUS = 14;
const LOGO_MAX_HEIGHT = 36;

function niceMeal(value) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}

export function truncateMapsUrl(url, maxLen = 48) {
  const s = String(url || "").trim();
  if (!s || s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 3)}...`;
}

function loadLogoForPdf() {
  return loadPawganicLogoDataUrl().then((dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => reject(new Error("Logo failed to decode"));
      img.src = dataUrl;
    });
  });
}

function logoDimensions(naturalWidth, naturalHeight, maxHeight) {
  const aspect = naturalWidth / naturalHeight;
  const h = maxHeight;
  return { width: h * aspect, height: h };
}

function fieldBlock(pdf, label, value, x, y, colWidth) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE_500);
  pdf.text(label.toUpperCase(), x, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...SLATE_900);
  const lines = pdf.splitTextToSize(String(value || "N/A"), colWidth);
  pdf.text(lines, x, y + 13);
  return y + 13 + lines.length * 12;
}

function locationBlock(pdf, mapsLink, x, y, width) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE_500);
  pdf.text("LOCATION", x, y);
  y += 13;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BLUE_LINK);
  pdf.textWithLink("Open in Google Maps", x, y, { url: mapsLink });
  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE_400);
  const urlLines = pdf.splitTextToSize(truncateMapsUrl(mapsLink), width);
  pdf.text(urlLines, x, y);
  return y + urlLines.length * 9 + 8;
}

async function resolveOrderForReceipt(order, options = {}) {
  let enriched = enrichShareOrder(order, options.customer ?? options.customers);
  const city = pickShareField(enriched.customerCity);
  const maps = pickShareField(enriched.customerMapsLink);
  if ((!city || !maps) && enriched.customerId) {
    try {
      const c = await api(`/customers/${enriched.customerId}`);
      enriched = enrichShareOrder(enriched, c);
    } catch {
      /* keep order fields only */
    }
  }
  return normalizeShareOrder(enriched);
}

function measureReceiptHeight(normalized, items, { foodSubtotal, delivery, grandTotal }) {
  const city = pickShareField(normalized.customerCity);
  const mapsLink = pickShareField(normalized.customerMapsLink);
  let h = CARD_PAD;
  h += 52; // header
  h += 14; // divider
  h += 58; // customer + mobile
  if (city) h += 42;
  h += 58; // date + status
  if (mapsLink) h += 52;
  h += 28; // table header
  h += Math.max(items.length, 1) * 24;
  h += 96; // totals (extra spacing before grand total)
  h += CARD_PAD;
  return h;
}

function drawReceiptContent(pdf, normalized, logo, layout) {
  const { cardX, cardY, contentWidth, colWidth, rightX } = layout;
  const items = Array.isArray(normalized?.items) ? normalized.items : [];
  const { foodSubtotal, delivery, grandTotal } = getOrderBreakdown(normalized);
  const city = pickShareField(normalized.customerCity);
  const mapsLink = pickShareField(normalized.customerMapsLink);

  let y = cardY + CARD_PAD;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...FOREST);
  pdf.text("Pawganic", cardX + CARD_PAD, y + 4);

  if (logo) {
    const dims = logoDimensions(logo.width, logo.height, LOGO_MAX_HEIGHT);
    const logoX = cardX + layout.cardWidth - CARD_PAD - dims.width;
    pdf.addImage(logo.dataUrl, "JPEG", logoX, y - 6, dims.width, dims.height);
  }

  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text("Order summary", cardX + CARD_PAD, y);
  y += 12;
  pdf.setDrawColor(...CARD_BORDER);
  pdf.line(cardX + CARD_PAD, y, cardX + layout.cardWidth - CARD_PAD, y);
  y += 18;

  const leftX = cardX + CARD_PAD;
  let yLeft = fieldBlock(
    pdf,
    "Customer",
    `${normalized.customerFirstName || ""} ${normalized.customerLastName || ""}`.trim(),
    leftX,
    y,
    colWidth
  );
  let yRight = fieldBlock(
    pdf,
    "Mobile",
    formatShareMobile(normalized.customerMobile) || "N/A",
    rightX,
    y,
    colWidth
  );
  y = Math.max(yLeft, yRight) + 8;

  if (city) {
    y = fieldBlock(pdf, "City", city, leftX, y, contentWidth) + 8;
  }

  yLeft = fieldBlock(
    pdf,
    "Order date",
    normalized.createdAt ? new Date(normalized.createdAt).toLocaleString() : "N/A",
    leftX,
    y,
    colWidth
  );
  yRight = fieldBlock(
    pdf,
    "Status",
    String(normalized.status || "N/A").replace(/_/g, " "),
    rightX,
    y,
    colWidth
  );
  y = Math.max(yLeft, yRight) + 8;

  if (mapsLink) {
    y = locationBlock(pdf, mapsLink, leftX, y, contentWidth);
  }

  const tableLeft = leftX;
  const tableWidth = contentWidth;
  const tableTop = y;
  const colItem = tableLeft + 4;
  const colQty = tableLeft + tableWidth * 0.52;
  const colSub = tableLeft + tableWidth - 4;

  pdf.setFillColor(248, 250, 252);
  pdf.rect(tableLeft, tableTop, tableWidth, 20, "F");
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.5);
  pdf.rect(tableLeft, tableTop, tableWidth, 20, "S");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_700);
  pdf.text("Item", colItem, tableTop + 13);
  pdf.text("Qty", colQty, tableTop + 13);
  pdf.text("Subtotal", colSub, tableTop + 13, { align: "right" });
  y = tableTop + 20;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_900);

  if (items.length) {
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const subtotal = Number(it.subtotal ?? qty * Number(it.pricePerUnit || 0));
      const rowH = 22;
      pdf.setDrawColor(241, 245, 249);
      pdf.line(tableLeft, y + rowH, tableLeft + tableWidth, y + rowH);
      pdf.text(niceMeal(it.mealType), colItem, y + 14);
      pdf.text(String(qty), colQty, y + 14);
      pdf.text(money(subtotal), colSub, y + 14, { align: "right" });
      y += rowH;
    }
  } else {
    pdf.setTextColor(...SLATE_500);
    pdf.text("No items", colItem, y + 14);
    y += 22;
  }

  pdf.rect(tableLeft, tableTop, tableWidth, y - tableTop, "S");
  y += 16;

  const labelX = tableLeft;
  const valueX = tableLeft + tableWidth;
  const totalsRow = (label, value, { bold = false, lineGap = 18 } = {}) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 12 : 10);
    pdf.setTextColor(...(bold ? SLATE_900 : SLATE_600));
    pdf.text(label, labelX, y);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...(bold ? FOREST : SLATE_900));
    pdf.text(value, valueX, y, { align: "right" });
    y += lineGap;
  };

  totalsRow("Food subtotal", money(foodSubtotal), { lineGap: 20 });
  totalsRow("Delivery", money(delivery), { lineGap: 20 });
  y += 6;
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.5);
  pdf.line(labelX, y, valueX, y);
  y += 16;
  totalsRow("Grand total", money(grandTotal), { bold: true, lineGap: 22 });

  return y + CARD_PAD;
}

/**
 * Pawganic order receipt PDF (A5, centered card, clickable Maps link).
 */
export async function generateOrderReceiptPdf(order, options = {}) {
  const normalized = await resolveOrderForReceipt(order, options);
  const items = Array.isArray(normalized?.items) ? normalized.items : [];
  const breakdown = getOrderBreakdown(normalized);

  let logo = null;
  try {
    logo = await loadLogoForPdf();
    shareDebug("PDF logo loaded", true);
  } catch (e) {
    shareDebug("PDF logo failed", e?.message || e);
    logo = null;
  }

  const cardX = PAGE_MARGIN;
  const cardWidth = A5_WIDTH - PAGE_MARGIN * 2;
  const contentWidth = cardWidth - CARD_PAD * 2;
  const colWidth = contentWidth / 2 - 6;
  const rightX = cardX + CARD_PAD + contentWidth / 2 + 6;

  const cardHeight = measureReceiptHeight(normalized, items, breakdown);
  const cardY = Math.max(PAGE_MARGIN, (A5_HEIGHT - cardHeight) / 2);

  const layout = { cardX, cardY, cardWidth, contentWidth, colWidth, rightX };

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [A5_WIDTH, A5_HEIGHT] });

  pdf.setFillColor(...PAGE_BG);
  pdf.rect(0, 0, A5_WIDTH, A5_HEIGHT, "F");

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.75);
  if (typeof pdf.roundedRect === "function") {
    pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, CARD_RADIUS, CARD_RADIUS, "FD");
  } else {
    pdf.rect(cardX, cardY, cardWidth, cardHeight, "FD");
  }

  drawReceiptContent(pdf, normalized, logo, layout);

  return pdf;
}
