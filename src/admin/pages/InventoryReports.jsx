import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { finishedProductLabel, inventoryCategoryLabel } from "../../lib/constants.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function formatKg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x % 1 === 0 ? String(x) : x.toFixed(3).replace(/\.?0+$/, "");
}

function MealSalesQuantityBlock({ title, data }) {
  if (!data) return null;
  const rows = [
    { label: "Chicken Rice", value: data.chickenRiceKg },
    { label: "Beef Rice", value: data.beefRiceKg },
    { label: "Fish Rice", value: data.fishRiceKg },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-600">{r.label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{formatKg(r.value)} kg</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-sm">
          <dt className="font-semibold text-slate-900">Total</dt>
          <dd className="font-bold tabular-nums text-forest">{formatKg(data.totalKg)} kg</dd>
        </div>
      </dl>
    </div>
  );
}

export default function InventoryReports() {
  const [summary, setSummary] = useState(null);
  const [mealSales, setMealSales] = useState(null);
  const [finished, setFinished] = useState(null);
  const [batches, setBatches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/dashboard/meal-sales-quantity"),
      api("/inventory/reports/summary"),
      api("/inventory/finished-stock"),
      api("/inventory/batches"),
      api("/inventory/reports/order-profit?limit=150"),
    ])
      .then(([sales, s, f, b, o]) => {
        setMealSales(sales);
        setSummary(s);
        setFinished(f);
        setBatches(b);
        setOrders(o);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !summary) {
    return <p className="text-sm text-slate-500">Loading reports…</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Inventory & batch profit</h1>
        <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
          Ingredient stock, finished meals, batch profitability, and per-order COGS where allocations exist.
        </p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Sales quantity summary</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kilograms sold by meal type from <strong>delivered</strong> orders only (pending and cancelled excluded).
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <MealSalesQuantityBlock title="This month" data={mealSales?.thisMonth} />
          <MealSalesQuantityBlock title="All time" data={mealSales?.allTime} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">A. Ingredient & supply inventory</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Category</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Available</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Unit</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Stock value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(summary?.ingredientStock || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No rows yet.
                  </td>
                </tr>
              ) : (
                summary.ingredientStock.map((r) => (
                  <tr key={r.inventoryItemId}>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.item}</td>
                    <td className="px-3 py-2 text-slate-600">{inventoryCategoryLabel(r.category)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.availableQuantity}</td>
                    <td className="px-3 py-2 text-slate-600">{r.unit}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(r.stockValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">B. Finished meal inventory</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Product</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Available kg</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Batches (lots)</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Value at cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(finished?.byProduct || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No finished stock yet.
                  </td>
                </tr>
              ) : (
                finished.byProduct.map((r) => (
                  <tr key={r.productType}>
                    <td className="px-3 py-2 font-medium text-slate-900">{finishedProductLabel(r.productType)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.availableKg}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.batchesAvailable}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(r.valueAtCost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">C. Batch profitability</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs lg:text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Code</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Product</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Date</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Out kg</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Cost/kg</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Batch $</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Sold kg</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Remain kg</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Expect profit</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Real $</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">Real profit</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-700">$/kg sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                    No batches.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-2 py-2 font-mono">{b.batchCode}</td>
                    <td className="px-2 py-2">{finishedProductLabel(b.productType)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{b.batchDate?.slice(0, 10)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.outputQuantityKg}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(b.costPerKg)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(b.totalBatchCost)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.soldQuantityKg}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.remainingQuantityKg}</td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {b.expectedProfit != null ? money(b.expectedProfit) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(b.realizedRevenue)}</td>
                    <td className="px-2 py-2 text-right font-medium text-emerald-800 tabular-nums">
                      {money(b.realizedProfit)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.profitPerKgSold != null ? money(b.profitPerKgSold) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">D. Order profitability (with allocation)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Orders created before inventory linking have no allocation; revenue excludes delivery as elsewhere.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Order</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Revenue (no delivery)</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Delivery</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">COGS</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No orders.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{o.orderId.slice(-8)}</td>
                    <td className="px-3 py-2 capitalize">{o.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(o.revenueExcludingDelivery)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{money(o.deliveryAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {o.inventoryCogs != null ? money(o.inventoryCogs) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {o.inventoryProfit != null ? money(o.inventoryProfit) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
