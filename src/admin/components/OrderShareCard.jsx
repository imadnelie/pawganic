import pawganicLogo from "../../../imgs/PawganicLogo.jpg";
import { getOrderBreakdown, money, normalizeShareOrder } from "../utils/orderShare.js";

function niceMeal(value) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}

export default function OrderShareCard({ order, forExport = false }) {
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
        <img src={pawganicLogo} alt="Pawganic" className="h-10 w-auto rounded-md object-contain" />
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
          <div className="font-semibold">{normalizedOrder?.customerMobile || "N/A"}</div>
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

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Food subtotal</span>
          <span className="font-semibold">{money(foodSubtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Delivery</span>
          <span className="font-semibold">{money(delivery)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base">
          <span className="font-semibold text-slate-900">Grand total</span>
          <span className="font-bold text-forest">{money(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
