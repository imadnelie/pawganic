import { pawganicLogoUrl } from "../../lib/pawganicLogo.js";
import {
  formatShareMobile,
  getOrderBreakdown,
  money,
  normalizeShareOrder,
} from "../utils/orderShare.js";
import { truncateMapsUrl } from "../utils/orderReceiptPdf.js";

function niceMeal(value) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}

export default function OrderShareCard({ order, forExport = false, logoSrc = pawganicLogoUrl }) {
  const normalizedOrder = normalizeShareOrder(order);
  const items = Array.isArray(normalizedOrder?.items) ? normalizedOrder.items : [];
  const { foodSubtotal, delivery, grandTotal } = getOrderBreakdown(normalizedOrder);

  return (
    <div
      className={`mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm sm:p-5 ${
        forExport ? "min-h-[640px]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-forest">Pawganic</div>
          <div className="text-xs text-slate-500">Order summary</div>
        </div>
        <img
          src={logoSrc}
          alt="Pawganic"
          data-pawganic-logo
          className="h-10 w-auto rounded-md object-contain"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-slate-500">Customer</div>
          <div className="font-semibold">
            {normalizedOrder?.customerFirstName} {normalizedOrder?.customerLastName}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-500">Mobile</div>
          <div className="font-semibold">
            {formatShareMobile(normalizedOrder?.customerMobile) || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-500">Order date</div>
          <div className="font-semibold">
            {normalizedOrder?.createdAt ? new Date(normalizedOrder.createdAt).toLocaleString() : "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-500">Status</div>
          <div className="font-semibold capitalize">{normalizedOrder?.status || "N/A"}</div>
        </div>
      </div>

      {normalizedOrder?.customerCity || normalizedOrder?.customerMapsLink ? (
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {normalizedOrder?.customerCity ? (
            <div>
              <div className="text-xs uppercase text-slate-500">City</div>
              <div className="font-semibold">{normalizedOrder.customerCity}</div>
            </div>
          ) : null}
          {normalizedOrder?.customerMapsLink ? (
            <div className={normalizedOrder?.customerCity ? "" : "sm:col-span-2"}>
              <div className="text-xs uppercase text-slate-500">Location</div>
              <a
                href={normalizedOrder.customerMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block font-semibold text-blue-600 underline decoration-blue-600/30"
              >
                Open in Google Maps
              </a>
              <p className="mt-1 break-all text-xs text-slate-400">
                {truncateMapsUrl(normalizedOrder.customerMapsLink)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Qty</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((it, idx) => {
                const qty = Number(it.quantity || 0);
                const subtotal = Number(it.subtotal ?? qty * Number(it.pricePerUnit || 0));
                return (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2">{niceMeal(it.mealType)}</td>
                    <td className="px-3 py-2">{qty}</td>
                    <td className="px-3 py-2 text-right">{money(subtotal)}</td>
                  </tr>
                );
              })
            ) : (
              <tr className="border-t border-slate-100">
                <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Food subtotal</span>
          <span className="shrink-0 font-semibold tabular-nums">{money(foodSubtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Delivery</span>
          <span className="shrink-0 font-semibold tabular-nums">{money(delivery)}</span>
        </div>
        <div className="mt-1 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between gap-4 text-base">
            <span className="font-bold text-slate-900">Grand total</span>
            <span className="shrink-0 font-bold tabular-nums text-forest">{money(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
