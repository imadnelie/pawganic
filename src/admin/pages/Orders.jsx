import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { MEAL_TYPES, PARTNERS, mealLabel } from "../../lib/constants.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { isAdmin } from "../../lib/authz.js";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export default function Orders() {
  const { user } = useAuth();
  const canAdminOrders = isAdmin(user);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCreator, setFilterCreator] = useState("");

  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    customerId: "",
    items: [{ mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
    deliveryAmount: 0,
  });

  const [deliverModal, setDeliverModal] = useState(null);
  const [deliverForm, setDeliverForm] = useState({
    paidTo: "elie",
    deliveredDate: new Date().toISOString().slice(0, 10),
  });
  const [editModal, setEditModal] = useState(null);
  const [deleteOrder, setDeleteOrder] = useState(null);
  const [editForm, setEditForm] = useState({
    customerId: "",
    items: [{ mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
    deliveryAmount: 0,
    status: "pending",
    paidTo: "elie",
    deliveredDate: new Date().toISOString().slice(0, 10),
  });

  const calcSubtotal = (items) =>
    items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.pricePerUnit || 0), 0);
  const calcGrandTotal = (items, deliveryAmount) => calcSubtotal(items) + Number(deliveryAmount || 0);

  const loadOrders = () => {
    const q = new URLSearchParams();
    if (filterStatus) q.set("status", filterStatus);
    if (filterCreator) q.set("createdBy", filterCreator);
    const suffix = q.toString() ? `?${q}` : "";
    return api(`/orders${suffix}`).then(setOrders);
  };

  useEffect(() => {
    Promise.all([api("/customers"), loadOrders()])
      .then(([c]) => setCustomers(c))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterCreator]);

  const submitNew = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/orders", {
        method: "POST",
        body: {
          customerId: newForm.customerId,
          items: newForm.items.map((it) => ({
            mealType: it.mealType,
            quantity: Number(it.quantity),
            pricePerUnit: Number(it.pricePerUnit),
          })),
          deliveryAmount: Number(newForm.deliveryAmount || 0),
        },
      });
      setNewModal(false);
      setNewForm({
        customerId: "",
        items: [{ mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
        deliveryAmount: 0,
      });
      await loadOrders();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const sortedCustomers = [...customers].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  );

  const submitDeliver = async (e) => {
    e.preventDefault();
    if (!deliverModal) return;
    setErr("");
    try {
      await api(`/orders/${deliverModal.id}/deliver`, {
        method: "POST",
        body: {
          paidTo: deliverForm.paidTo,
          deliveredDate: deliverForm.deliveredDate,
        },
      });
      setDeliverModal(null);
      await loadOrders();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const openEdit = (o) => {
    setErr("");
    setEditModal(o);
    setEditForm({
      customerId: String(o.customerId),
      items: (o.items || []).map((it) => ({
        mealType: it.mealType,
        quantity: it.quantity,
        pricePerUnit: it.pricePerUnit,
      })),
      deliveryAmount: Number(o.deliveryAmount || 0),
      status: o.status,
      paidTo: o.paidTo || "elie",
      deliveredDate: o.deliveredAt
        ? new Date(o.deliveredAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    setErr("");
    try {
      await api(`/orders/${editModal.id}`, {
        method: "PUT",
        body: {
          customerId: editForm.customerId,
          items: editForm.items.map((it) => ({
            mealType: it.mealType,
            quantity: Number(it.quantity),
            pricePerUnit: Number(it.pricePerUnit),
          })),
          deliveryAmount: Number(editForm.deliveryAmount || 0),
          status: editForm.status,
          paidTo: editForm.status === "delivered" ? editForm.paidTo : null,
          deliveredDate: editForm.status === "delivered" ? editForm.deliveredDate : null,
        },
      });
      setEditModal(null);
      await loadOrders();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteOrder) return;
    setErr("");
    try {
      await api(`/orders/${deleteOrder.id}`, { method: "DELETE" });
      setDeleteOrder(null);
      await loadOrders();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Orders</h1>
          <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">Track deliveries and payments</p>
        </div>
        <button
          type="button"
          onClick={() => setNewModal(true)}
          className="w-full shrink-0 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2"
        >
          New order
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div>
          <label className="text-xs text-slate-500">Status</label>
          <select
            className="mt-1 block rounded-lg border-slate-300 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Created by</label>
          <select
            className="mt-1 block rounded-lg border-slate-300 text-sm"
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
          >
            <option value="">All</option>
            {PARTNERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && !newModal && !deliverModal && !editModal && !deleteOrder ? (
        <p className="mt-4 text-sm text-red-600">{err}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Customer</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Meal</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Items</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Total</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Created by</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Paid to</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Created</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  No orders match filters.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">
                    {o.customerFirstName} {o.customerLastName}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {(o.items || []).map((it) => mealLabel(it.mealType)).join(", ")}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {(o.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <div className="text-xs">Subtotal: {money(o.businessSubtotal ?? o.totalPrice ?? 0)}</div>
                    <div className="text-xs">Delivery: {money(o.deliveryAmount || 0)}</div>
                    <div className="font-semibold">Total: {money(o.totalPrice)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-3 capitalize text-slate-600">{o.createdBy}</td>
                  <td className="px-3 py-3 capitalize text-slate-600">{o.paidTo || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {o.status === "pending" && canAdminOrders ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliverModal(o);
                            setDeliverForm({
                              paidTo: "elie",
                              deliveredDate: new Date().toISOString().slice(0, 10),
                            });
                          }}
                          className="text-xs font-semibold text-forest hover:underline"
                        >
                          Mark delivered
                        </button>
                      ) : null}
                      {canAdminOrders ? (
                        <button
                          type="button"
                          onClick={() => openEdit(o)}
                          className="text-xs font-semibold text-forest hover:underline"
                        >
                          Edit
                        </button>
                      ) : null}
                      {canAdminOrders ? (
                        <button
                          type="button"
                          onClick={() => setDeleteOrder(o)}
                          className="text-xs font-semibold text-rose-700 hover:underline"
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
        open={newModal}
        title="New order"
        onClose={() => setNewModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="new-order-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </div>
        }
      >
        {err && newModal ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="new-order-form" onSubmit={submitNew} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Customer</label>
            <select
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={newForm.customerId}
              onChange={(e) => setNewForm((f) => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Select…</option>
              {sortedCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.mobile}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Order items</label>
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
              {newForm.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1.4fr_.8fr_.9fr_auto] gap-2">
                  <select
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.mealType}
                    onChange={(e) =>
                      setNewForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], mealType: e.target.value };
                        return { ...f, items };
                      })
                    }
                  >
                    {MEAL_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.quantity}
                    onChange={(e) =>
                      setNewForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], quantity: e.target.value };
                        return { ...f, items };
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Price/unit"
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.pricePerUnit}
                    onChange={(e) =>
                      setNewForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], pricePerUnit: e.target.value };
                        return { ...f, items };
                      })
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-rose-700"
                    onClick={() =>
                      setNewForm((f) => ({
                        ...f,
                        items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items,
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-forest"
                onClick={() =>
                  setNewForm((f) => ({
                    ...f,
                    items: [...f.items, { mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
                  }))
                }
              >
                + Add item
              </button>
              <div className="text-right text-sm font-semibold text-slate-700">
                <div>Items subtotal: {money(calcSubtotal(newForm.items))}</div>
                <div>Delivery: {money(newForm.deliveryAmount)}</div>
                <div>Grand total: {money(calcGrandTotal(newForm.items, newForm.deliveryAmount))}</div>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Delivery</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={newForm.deliveryAmount}
              onChange={(e) => setNewForm((f) => ({ ...f, deliveryAmount: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deliverModal}
        title="Mark as delivered"
        onClose={() => setDeliverModal(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeliverModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="deliver-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm
            </button>
          </div>
        }
      >
        {deliverModal ? (
          <p className="mb-3 text-sm text-slate-600">
            Order #{deliverModal.id} · Subtotal {money(deliverModal.businessSubtotal ?? deliverModal.totalPrice ?? 0)} · Delivery{" "}
            {money(deliverModal.deliveryAmount || 0)} · Total {money(deliverModal.totalPrice)}
          </p>
        ) : null}
        {err && deliverModal ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="deliver-form" onSubmit={submitDeliver} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Payment received by</label>
            <select
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={deliverForm.paidTo}
              onChange={(e) => setDeliverForm((f) => ({ ...f, paidTo: e.target.value }))}
            >
              {PARTNERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Delivery date</label>
            <input
              type="date"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={deliverForm.deliveredDate}
              onChange={(e) => setDeliverForm((f) => ({ ...f, deliveredDate: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleteOrder}
        title="Delete order"
        onClose={() => setDeleteOrder(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOrder(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteOrder}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        }
      >
        {err && deleteOrder ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        {deleteOrder ? (
          <p className="text-sm text-slate-700">
            Delete order #{deleteOrder.id} for {deleteOrder.customerFirstName}{" "}
            {deleteOrder.customerLastName}? This cannot be undone.
          </p>
        ) : null}
      </Modal>
      <Modal
        open={!!editModal}
        title="Edit order"
        onClose={() => setEditModal(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="edit-order-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Update
            </button>
          </div>
        }
      >
        {err && editModal ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="edit-order-form" onSubmit={submitEdit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Customer</label>
            <select
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={editForm.customerId}
              onChange={(e) => setEditForm((f) => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Order items</label>
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
              {editForm.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1.4fr_.8fr_.9fr_auto] gap-2">
                  <select
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.mealType}
                    onChange={(e) =>
                      setEditForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], mealType: e.target.value };
                        return { ...f, items };
                      })
                    }
                  >
                    {MEAL_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.quantity}
                    onChange={(e) =>
                      setEditForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], quantity: e.target.value };
                        return { ...f, items };
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="block w-full rounded-lg border-slate-300 text-sm"
                    value={it.pricePerUnit}
                    onChange={(e) =>
                      setEditForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], pricePerUnit: e.target.value };
                        return { ...f, items };
                      })
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-rose-700"
                    onClick={() =>
                      setEditForm((f) => ({
                        ...f,
                        items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items,
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-forest"
                onClick={() =>
                  setEditForm((f) => ({
                    ...f,
                    items: [...f.items, { mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
                  }))
                }
              >
                + Add item
              </button>
              <div className="text-right text-sm font-semibold text-slate-700">
                <div>Items subtotal: {money(calcSubtotal(editForm.items))}</div>
                <div>Delivery: {money(editForm.deliveryAmount)}</div>
                <div>Grand total: {money(calcGrandTotal(editForm.items, editForm.deliveryAmount))}</div>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Delivery</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={editForm.deliveryAmount}
              onChange={(e) => setEditForm((f) => ({ ...f, deliveryAmount: e.target.value }))}
            />
          </div>
          {editForm.status === "delivered" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Paid to</label>
                <select
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.paidTo}
                  onChange={(e) => setEditForm((f) => ({ ...f, paidTo: e.target.value }))}
                >
                  {PARTNERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Delivery date</label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.deliveredDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, deliveredDate: e.target.value }))}
                />
              </div>
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
