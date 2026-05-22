import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { inventoryCategoryLabel } from "../../lib/constants.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    api("/inventory/stock")
      .then(setRows)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Ingredient inventory</h1>
      <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
        Stock levels from purchases minus batch usage (FIFO lots on the server).
      </p>

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Item</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Category</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Unit</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Available</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Avg cost</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No purchase lines with remaining quantity yet. Add a purchase to seed inventory.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.inventoryItemId} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-900">{r.itemName}</td>
                  <td className="px-3 py-3 text-slate-600">{inventoryCategoryLabel(r.category)}</td>
                  <td className="px-3 py-3 text-slate-600">{r.unit}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-800">{r.quantityAvailable}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{money(r.averageCostDisplay)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{money(r.stockValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
