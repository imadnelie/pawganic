import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

const DISPLAY_GROUPS = [
  { key: "boxes", title: "Boxes" },
  { key: "stickers", title: "Stickers" },
  { key: "vegetables", title: "Vegetables" },
  { key: "protein", title: "Protein" },
  { key: "carb", title: "Carb" },
  { key: "other", title: "Other" },
];

/** Display-only grouping; does not change stored category values. */
function displayGroupKey(row) {
  const cat = String(row.category || "").toLowerCase();
  const name = String(row.itemName || "").toLowerCase();
  if (cat === "packaging" && name.includes("box")) return "boxes";
  if (cat === "sticker") return "stickers";
  if (cat === "vegetable") return "vegetables";
  if (cat === "protein") return "protein";
  if (cat === "carb") return "carb";
  return "other";
}

function groupInventoryRows(rows) {
  const buckets = Object.fromEntries(DISPLAY_GROUPS.map((g) => [g.key, []]));
  for (const row of rows) {
    const key = displayGroupKey(row);
    buckets[key].push(row);
  }
  return DISPLAY_GROUPS.map(({ key, title }) => {
    const items = [...buckets[key]].sort((a, b) =>
      String(a.itemName || "").localeCompare(String(b.itemName || ""))
    );
    const stockValueTotal = items.reduce((sum, r) => sum + Number(r.stockValue || 0), 0);
    return { key, title, items, stockValueTotal };
  }).filter((g) => g.items.length > 0);
}

function InventoryGroupTable({ group }) {
  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-slate-900">{group.title}</h2>
        <p className="text-xs text-slate-500">
          {group.items.length} item{group.items.length === 1 ? "" : "s"} · Group stock value{" "}
          <span className="font-semibold text-slate-700">{money(group.stockValueTotal)}</span>
        </p>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[480px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Item</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Unit</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Available</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Avg cost</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {group.items.map((r) => (
              <tr key={r.inventoryItemId} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium text-slate-900">{r.itemName}</td>
                <td className="px-3 py-3 text-slate-600">{r.unit}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-800">{r.quantityAvailable}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600">{money(r.averageCostDisplay)}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">
                  {money(r.stockValue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/80">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Group total
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                {money(group.stockValueTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const groups = useMemo(() => groupInventoryRows(rows), [rows]);
  const grandStockValue = useMemo(
    () => groups.reduce((sum, g) => sum + g.stockValueTotal, 0),
    [groups]
  );

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

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No purchase lines with remaining quantity yet. Add a purchase to seed inventory.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <InventoryGroupTable key={group.key} group={group} />
          ))}
          {groups.length > 1 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-slate-800">All groups</span>
                <span className="tabular-nums text-slate-700">
                  Total stock value: <span className="font-bold text-slate-900">{money(grandStockValue)}</span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
