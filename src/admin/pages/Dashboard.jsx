import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { mealLabel } from "../../lib/constants.js";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(0);
  }
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(x);
}

function BreakdownRow({ label, amount, tone }) {
  const isTotal = tone === "total";
  return (
    <div
      className={`flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 ${
        isTotal ? "pt-1 font-bold" : "text-sm"
      }`}
    >
      <span className={isTotal ? "text-slate-900" : "text-slate-600"}>{label}</span>
      <span
        className={`tabular-nums ${
          tone === "revenue"
            ? "font-semibold text-emerald-800"
            : tone === "expense"
              ? "font-semibold text-rose-800"
              : "text-slate-900"
        }`}
      >
        {money(amount)}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/dashboard/summary")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  const maxRev = Math.max(1, ...data.revenueByMeal.map((m) => m.revenue));

  return (
    <div>
      <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Dashboard</h1>
      <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
        Overview of your Pawganic operations
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4">
        {[
          { label: "Customers", value: data.customers },
          { label: "Pending orders", value: data.ordersPending },
          { label: "Delivered orders", value: data.ordersDelivered },
          { label: "Net profit", value: money(data.netProfit), emphasize: true },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${c.emphasize ? "text-forest" : "text-slate-900"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Financial summary (partners)
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Revenue uses delivered orders only (by who received payment). Expenses split by who paid.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-900">Revenue</h3>
          <p className="mt-0.5 text-xs text-emerald-800/80">Delivered orders · paid_to partner</p>
          <div className="mt-4">
            <BreakdownRow label="Total revenue" amount={data.totalRevenue} tone="revenue" />
            <BreakdownRow label="Elie received" amount={data.revenueToElie} tone="revenue" />
            <BreakdownRow label="Jimmy received" amount={data.revenueToJimmy} tone="revenue" />
          </div>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-rose-900">Expenses</h3>
          <p className="mt-0.5 text-xs text-rose-800/80">All recorded expenses · paid_by partner</p>
          <div className="mt-4">
            <BreakdownRow label="Total expenses" amount={data.totalExpenses} tone="expense" />
            <BreakdownRow label="Elie paid" amount={data.expensesPaidByElie} tone="expense" />
            <BreakdownRow label="Jimmy paid" amount={data.expensesPaidByJimmy} tone="expense" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Net per person</h3>
          <p className="mt-0.5 text-xs text-slate-500">Revenue received − expenses paid (cash flow view)</p>
          <div className="mt-4">
            <BreakdownRow label="Elie net position" amount={data.elieNetPosition} tone="total" />
            <BreakdownRow label="Jimmy net position" amount={data.jimmyNetPosition} tone="total" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            For partnership settlement (50% profit share), see the{" "}
            <Link to="/admin/balance" className="font-medium text-forest underline decoration-forest/30 hover:decoration-forest">
              Balance
            </Link>{" "}
            page.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">P&amp;L snapshot</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-800">Total revenue</span>
              <span className="font-bold tabular-nums text-emerald-900">{money(data.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-800">Total expenses</span>
              <span className="font-bold tabular-nums text-rose-900">{money(data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="font-medium text-slate-800">Net profit</span>
              <span className="font-bold tabular-nums text-forest">{money(data.netProfit)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Revenue by meal (delivered)</h2>
          <div className="mt-4 space-y-3">
            {data.revenueByMeal.length === 0 ? (
              <p className="text-sm text-slate-500">No delivered orders yet.</p>
            ) : (
              data.revenueByMeal.map((m) => (
                <div key={m.mealType}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{mealLabel(m.mealType)}</span>
                    <span>
                      {money(m.revenue)} · {m.count} orders
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600/70"
                      style={{ width: `${(m.revenue / maxRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
