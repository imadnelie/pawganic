import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageCustomers, isAdmin } from "../../lib/authz.js";
import Modal from "../components/Modal.jsx";

export default function Customers() {
  const { user } = useAuth();
  const canEdit = canManageCustomers(user);
  const canDelete = isAdmin(user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    lat: "",
    lng: "",
  });
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const sortedRows = [...rows].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  );

  const load = () =>
    api("/customers")
      .then(setRows)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/customers", {
        method: "POST",
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          lat: form.lat || null,
          lng: form.lng || null,
        },
      });
      setModal(false);
      setForm({ firstName: "", lastName: "", mobile: "", lat: "", lng: "" });
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        }));
      },
      () => setErr("Could not read location")
    );
  };

  const deleteCustomer = async (customer) => {
    if (!confirm(`Delete ${customer.first_name} ${customer.last_name}?`)) return;
    setErr("");
    try {
      await api(`/customers/${customer.id}`, { method: "DELETE" });
      setSuccess("Customer deleted.");
      setLoading(true);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Customers</h1>
          <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
            Manage customer profiles and locations
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setModal(true)}
            className="w-full shrink-0 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2"
          >
            Add customer
          </button>
        ) : null}
      </div>

      {err && !modal ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch] sm:mt-6">
        <table className="min-w-[600px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-slate-700 sm:px-4">Name</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700 sm:px-4">Mobile</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700 sm:px-4">Location</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700 sm:px-4">Orders</th>
              <th className="px-3 py-3 sm:px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500 sm:px-4">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500 sm:px-4">
                  No customers yet.
                </td>
              </tr>
            ) : (
              sortedRows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 sm:px-4 sm:py-3">{c.mobile}</td>
                  <td className="px-3 py-3.5 text-slate-600 sm:px-4 sm:py-3">
                    {c.lat != null && c.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest underline decoration-forest/30"
                      >
                        Open map
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 sm:px-4 sm:py-3">{c.order_count}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right sm:px-4 sm:py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/admin/customers/${c.id}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2 text-sm font-medium text-forest hover:bg-forest/5 hover:underline sm:min-h-0 sm:min-w-0 sm:px-0 sm:hover:bg-transparent"
                      >
                        View
                      </Link>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => deleteCustomer(c)}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2 text-sm font-medium text-rose-700 hover:bg-rose-50 hover:underline sm:min-h-0 sm:min-w-0 sm:px-0 sm:hover:bg-transparent"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal}
        title="New customer"
        onClose={() => setModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              form="new-customer-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest/90"
            >
              Save
            </button>
          </div>
        }
      >
        {err && modal ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="new-customer-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">First name</label>
              <input
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Last name</label>
              <input
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Mobile number</label>
            <input
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-700">Google Maps (optional)</div>
            <p className="mt-1 text-xs text-slate-500">Paste coordinates or use your current location.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Latitude"
                className="block w-full rounded-lg border-slate-300 text-sm"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
              />
              <input
                placeholder="Longitude"
                className="block w-full rounded-lg border-slate-300 text-sm"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="mt-2 text-xs font-medium text-forest hover:underline"
            >
              Use my location
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
