import { formatKg, orderItemBreakdownLines, orderItemBreakdownTotalKg } from "../../lib/productKg.js";

/** Per-product kg lines for order table cells and mobile cards. */
export default function OrderItemsBreakdown({ order, showTotal = true, compact = false }) {
  const lines = orderItemBreakdownLines(order);
  const totalKg = orderItemBreakdownTotalKg(order);

  if (!lines.length) {
    return <span className="text-slate-500">—</span>;
  }

  if (compact) {
    return (
      <div className="space-y-1 text-sm">
        {lines.map((line, idx) => (
          <div key={idx} className="text-slate-700">
            {line.label}: <span className="font-medium tabular-nums">{formatKg(line.qtyKg)} kg</span>
          </div>
        ))}
        {showTotal && lines.length > 1 ? (
          <div className="border-t border-slate-100 pt-1 text-xs font-semibold text-slate-600">
            Total items: {formatKg(totalKg)} kg
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {lines.map((line, idx) => (
        <li key={idx}>
          {line.label} — <span className="font-medium tabular-nums">{formatKg(line.qtyKg)} kg</span>
        </li>
      ))}
    </ul>
  );
}
