import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageCustomers } from "../../lib/authz.js";
import StatusBadge from "../components/StatusBadge.jsx";
import { mealLabel } from "../../lib/constants.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export default function CustomerDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageTitle } = useOutletContext() || {};
  const canEdit = canManageCustomers(user);
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      try {
        const [c, o] = await Promise.all([
          api(`/customers/${id}`),
          api(`/orders/customer/${id}`),
        ]);
        if (cancelled) return;
        setCustomer(c);
        setForm({
          firstName: c.first_name,
          lastName: c.last_name,
          mobile: c.mobile,
          lat: c.lat != null ? String(c.lat) : "",
          lng: c.lng != null ? String(c.lng) : "",
        });
        setOrders(o);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!customer) return undefined;
    const label = `${customer.first_name} ${customer.last_name}`;
    setPageTitle?.(label);
    return () => setPageTitle?.(null);
  }, [customer, setPageTitle]);

  const saveCustomer = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api(`/customers/${id}`, {
        method: "PATCH",
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          lat: form.lat || null,
          lng: form.lng || null,
        },
      });
      navigate("/admin/customers");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  if (err && !customer) {
    return (
      <div>
        <p className="text-sm text-red-600">{err}</p>
        <Link to="/admin/customers" className="mt-4 inline-block text-forest hover:underline">
          ← Customers
        </Link>
      </div>
    );
  }

  if (!customer || !form) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <Link
        to="/admin/customers"
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-forest hover:underline lg:min-h-0"
      >
        ← Customers
      </Link>

      <h1 className="mt-2 hidden text-2xl font-semibold text-slate-900 lg:mt-4 lg:block">
        {customer.first_name} {customer.last_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500 lg:mt-1">{customer.mobile}</p>
      {customer.lat != null && customer.lng != null ? (
        <a
          href={`https://www.google.com/maps?q=${customer.lat},${customer.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-forest underline"
        >
          Open in Google Maps
        </a>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 lg:text-sm">
            {canEdit ? "Edit customer" : "Customer details"}
          </h2>
          {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
          <form onSubmit={saveCustomer} className="mt-4 space-y-4 lg:mt-3 lg:space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">First name</label>
                <input
                  required
                  disabled={!canEdit}
                  className="mt-1 block min-h-[44px] w-full rounded-lg border-slate-300 text-base sm:min-h-0 sm:text-sm"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Last name</label>
                <input
                  required
                  disabled={!canEdit}
                  className="mt-1 block min-h-[44px] w-full rounded-lg border-slate-300 text-base sm:min-h-0 sm:text-sm"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Mobile</label>
              <input
                required
                disabled={!canEdit}
                className="mt-1 block min-h-[44px] w-full rounded-lg border-slate-300 text-base sm:min-h-0 sm:text-sm"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Latitude</label>
                <input
                  disabled={!canEdit}
                  className="mt-1 block min-h-[44px] w-full rounded-lg border-slate-300 text-base sm:min-h-0 sm:text-sm"
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Longitude</label>
                <input
                  disabled={!canEdit}
                  className="mt-1 block min-h-[44px] w-full rounded-lg border-slate-300 text-base sm:min-h-0 sm:text-sm"
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                />
              </div>
            </div>
            {canEdit ? (
              <button
                type="submit"
                className="w-full rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2.5"
              >
                Save changes
              </button>
            ) : null}
          </form>
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 lg:text-sm">Order history</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[560px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Items</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Paid to</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No orders yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-3 py-2 text-slate-900">
                        <div className="space-y-1">
                          {(o.items || []).map((it, idx) => (
                            <div key={idx} className="text-xs text-slate-700">
                              {mealLabel(it.mealType)} × {it.quantity} ({money(it.subtotal)})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{money(o.totalPrice)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2 capitalize text-slate-600">
                        {o.paidTo || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        <div>Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}</div>
                        {o.deliveredAt ? (
                          <div className="mt-1">
                            Delivered: {new Date(o.deliveredAt).toLocaleString()}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
