import { useEffect, useState } from "react";
import { api } from "../../api.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export default function Balance() {
  const [b, setB] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/balance")
      .then(setB)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!b) return <p className="text-sm text-slate-500">Loading…</p>;

  const { settlement } = b;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Balance</h1>
      <p className="mt-1 text-sm text-slate-500">
        Partnership split: 50% of net profit each, adjusted for who collected revenue and who paid
        expenses.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">Total revenue</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(b.totalRevenue)}</div>
          <div className="mt-3 text-xs text-slate-500">
            Collected by Elie: {money(b.revenueToElie)}
            <br />
            Collected by Jimmy: {money(b.revenueToJimmy)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">Total expenses</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(b.totalExpenses)}</div>
          <div className="mt-3 text-xs text-slate-500">
            Paid by Elie: {money(b.expensesPaidByElie)}
            <br />
            Paid by Jimmy: {money(b.expensesPaidByJimmy)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">Net profit</div>
          <div className="mt-1 text-2xl font-semibold text-forest">{money(b.netProfit)}</div>
          <div className="mt-3 text-xs text-slate-500">
            Elie’s share (50%): {money(b.elieShare)}
            <br />
            Jimmy’s share (50%): {money(b.jimmyShare)}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Net positions (after expenses)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-800">Elie:</span> orders collected − expenses paid
              = {money(b.elieNetAfterExpenses)}
            </li>
            <li>
              <span className="font-medium text-slate-800">Jimmy:</span> {money(b.jimmyNetAfterExpenses)}
            </li>
          </ul>
        </div>

        <div
          className={`rounded-xl border p-5 shadow-sm ${
            settlement?.balanced
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <h2 className="text-sm font-semibold text-slate-900">Settlement</h2>
          <p className="mt-3 text-sm text-slate-800">{settlement?.message}</p>
          {!settlement?.balanced && settlement?.amount != null ? (
            <p className="mt-2 text-lg font-semibold text-slate-900 capitalize">
              {settlement.owesFrom} → pay {settlement.owesTo}: {money(settlement.amount)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
