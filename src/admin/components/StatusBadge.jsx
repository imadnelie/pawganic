export default function StatusBadge({ status }) {
  const s = String(status || "pending");
  const styles = {
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-100 text-slate-600",
    pending: "bg-amber-100 text-amber-800",
  };
  const labels = {
    delivered: "Delivered",
    cancelled: "Cancelled",
    pending: "Pending",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        styles[s] || styles.pending
      }`}
    >
      {labels[s] || s.replace(/_/g, " ")}
    </span>
  );
}
