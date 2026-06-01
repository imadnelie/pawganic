import { PRODUCT_KG_LABELS, formatKg } from "../../lib/productKg.js";

function KgStatCard({ label, kg, suffix }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
        {formatKg(kg)}{" "}
        <span className="text-sm font-medium text-slate-600">{suffix}</span>
      </div>
    </div>
  );
}

/** Four-card grid: Chicken / Beef / Fish / Total kg summary. */
export default function ProductKgSummaryCards({ title, subtitle, totals, suffix }) {
  if (!totals) return null;
  return (
    <section className="mt-6">
      {title ? <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${title || subtitle ? "mt-3" : ""}`}
      >
        {PRODUCT_KG_LABELS.map((p) => (
          <KgStatCard key={p.key} label={p.label} kg={totals[p.key]} suffix={suffix} />
        ))}
        <KgStatCard label="Total" kg={totals.totalKg} suffix={suffix} />
      </div>
    </section>
  );
}
