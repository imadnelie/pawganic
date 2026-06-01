import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { MEAL_TYPES, PARTNERS } from "../../lib/constants.js";
import { formatKg, orderItemBreakdownTotalKg, sumPendingOrderKg } from "../../lib/productKg.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canMarkOrderDelivered, canMutateOrder, isAdmin } from "../../lib/authz.js";
import CustomerSearchSelect from "../components/CustomerSearchSelect.jsx";
import Modal from "../components/Modal.jsx";
import OrderItemsBreakdown from "../components/OrderItemsBreakdown.jsx";
import OrderShareModal from "../components/OrderShareModal.jsx";
import ProductKgSummaryCards from "../components/ProductKgSummaryCards.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { enrichShareOrder, normalizeShareOrder } from "../utils/orderShare.js";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function OrderDetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{children}</span>
    </div>
  );
}

function OrderActions({
  order,
  user,
  canDeliverOrders,
  onShare,
  onDeliver,
  onEdit,
  onDelete,
  variant = "desktop",
}) {
  const linkClass =
    variant === "mobile"
      ? "min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold active:bg-slate-50"
      : "text-xs font-semibold hover:underline";
  const shareClass =
    variant === "mobile" ? `${linkClass} border-emerald-200 text-emerald-800` : `${linkClass} text-emerald-700`;
  const deliverClass =
    variant === "mobile" ? `${linkClass} border-forest/30 text-forest` : `${linkClass} text-forest`;
  const editClass = variant === "mobile" ? `${linkClass} text-forest` : `${linkClass} text-forest`;
  const deleteClass =
    variant === "mobile" ? `${linkClass} border-rose-200 text-rose-700` : `${linkClass} text-rose-700`;

  return (
    <div className={`flex flex-wrap gap-2 ${variant === "desktop" ? "justify-end" : ""}`}>
      <button type="button" onClick={() => onShare(order)} className={shareClass}>
        Share
      </button>
      {order.status === "pending" && canDeliverOrders ? (
        <button type="button" onClick={() => onDeliver(order)} className={deliverClass}>
          Mark delivered
        </button>
      ) : null}
      {canMutateOrder(user, order) ? (
        <button type="button" onClick={() => onEdit(order)} className={editClass}>
          Edit
        </button>
      ) : null}
      {canMutateOrder(user, order) ? (
        <button type="button" onClick={() => onDelete(order)} className={deleteClass}>
          Delete
        </button>
      ) : null}
    </div>
  );
}

function OrderMobileCard({
  order,
  user,
  canDeliverOrders,
  onShare,
  onDeliver,
  onEdit,
  onDelete,
}) {
  const foodSubtotal = Number(order.businessSubtotal ?? order.totalPrice ?? 0);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer</p>
          <p className="text-base font-semibold text-slate-900">
            {order.customerFirstName} {order.customerLastName}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        <div className="text-sm">
          <div className="text-slate-500">Items</div>
          <div className="mt-1">
            <OrderItemsBreakdown order={order} compact />
          </div>
        </div>
        <OrderDetailRow label="Total items">{formatKg(orderItemBreakdownTotalKg(order))} kg</OrderDetailRow>
        <OrderDetailRow label="Food subtotal">{money(foodSubtotal)}</OrderDetailRow>
        <OrderDetailRow label="Delivery">{money(order.deliveryAmount || 0)}</OrderDetailRow>
        <OrderDetailRow label="Grand total">
          <span className="font-bold text-forest">{money(order.totalPrice)}</span>
        </OrderDetailRow>
        <OrderDetailRow label="Created by">
          <span className="capitalize">{order.createdBy || "—"}</span>
        </OrderDetailRow>
        <OrderDetailRow label="Paid to">
          <span className="capitalize">{order.paidTo || "—"}</span>
        </OrderDetailRow>
        <OrderDetailRow label="Created">
          {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}
        </OrderDetailRow>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <OrderActions
          order={order}
          user={user}
          canDeliverOrders={canDeliverOrders}
          onShare={onShare}
          onDeliver={onDeliver}
          onEdit={onEdit}
          onDelete={onDelete}
          variant="mobile"
        />
      </div>
    </article>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canAdminOrders = isAdmin(user);
  const canDeliverOrders = canMarkOrderDelivered(user);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterCreator, setFilterCreator] = useState("");

  const [newModal, setNewModal] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");
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
  const [shareModal, setShareModal] = useState(null);
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
    return api(`/orders${suffix}`).then((data) => {
      setOrders(data);
      return data;
    });
  };

  useEffect(() => {
    Promise.all([api("/customers"), loadOrders()])
      .then(([c]) => setCustomers(c))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterCreator]);

  useEffect(() => {
    const state = location.state;
    if (!state || loading) return;
    const { editOrderId, deleteOrderId, deliverOrderId } = state;
    let handled = false;
    if (editOrderId) {
      const target = orders.find((o) => String(o.id) === String(editOrderId));
      if (target && canMutateOrder(user, target)) {
        openEdit(target);
        handled = true;
      }
    }
    if (deleteOrderId) {
      const target = orders.find((o) => String(o.id) === String(deleteOrderId));
      if (target && canMutateOrder(user, target)) {
        setDeleteOrder(target);
        handled = true;
      }
    }
    if (deliverOrderId) {
      const target = orders.find((o) => String(o.id) === String(deliverOrderId));
      if (target?.status === "pending" && canDeliverOrders) {
        setDeliverModal(target);
        setDeliverForm({
          paidTo: "elie",
          deliveredDate: new Date().toISOString().slice(0, 10),
        });
        handled = true;
      }
    }
    if (handled) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state, orders, loading, user, navigate, location.pathname, location.search]);

  const submitNew = async (e) => {
    e.preventDefault();
    setErr("");
    setNewCustomerError("");
    if (!newForm.customerId) {
      setNewCustomerError(
        "Please select a customer from the list. Typing a name or number is not enough — tap a result to select."
      );
      return;
    }
    const customerExists = customers.some((c) => String(c.id) === String(newForm.customerId));
    if (!customerExists) {
      setNewCustomerError("Please select a valid customer from the list.");
      return;
    }
    try {
      const created = await api("/orders", {
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
      setNewCustomerError("");
      setNewForm({
        customerId: "",
        items: [{ mealType: "chicken_with_rice", quantity: 1, pricePerUnit: "" }],
        deliveryAmount: 0,
      });
      const refreshedOrders = await loadOrders();
      const freshestCreated = refreshedOrders.find((o) => o.id === created.id) || created;
      setShareModal(enrichOrderForShare(freshestCreated));
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const sortedCustomers = [...customers].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  );

  const pendingDemandKg = useMemo(() => sumPendingOrderKg(orders), [orders]);
  const showPendingSummary = filterStatus === "pending";

  const enrichOrderForShare = (order) =>
    normalizeShareOrder(enrichShareOrder(order, customers));

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
      const status = canAdminOrders ? editForm.status : "pending";
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
          status,
          paidTo: canAdminOrders && status === "delivered" ? editForm.paidTo : null,
          deliveredDate: canAdminOrders && status === "delivered" ? editForm.deliveredDate : null,
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
          onClick={() => {
            setNewCustomerError("");
            setNewModal(true);
          }}
          className="w-full shrink-0 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2"
        >
          New order
        </button>
      </div>

      <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Order quantities are <strong>kg</strong> of finished product. New orders require enough finished inventory from
        production batches (FIFO).
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="w-full min-w-0 sm:w-auto">
          <label className="text-xs text-slate-500">Status</label>
          <select
            className="mt-1 block w-full rounded-lg border-slate-300 text-sm sm:w-auto"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="w-full min-w-0 sm:w-auto">
          <label className="text-xs text-slate-500">Created by</label>
          <select
            className="mt-1 block w-full rounded-lg border-slate-300 text-sm sm:w-auto"
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

      {showPendingSummary ? (
        <ProductKgSummaryCards
          title="Pending order demand"
          subtitle="Kg needed from pending orders in this list (delivered and cancelled excluded)."
          totals={pendingDemandKg}
          suffix="pending"
        />
      ) : null}

      <div className="mt-6 space-y-3 lg:hidden">
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Loading…
          </p>
        ) : orders.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            No orders match filters.
          </p>
        ) : (
          orders.map((o) => (
            <OrderMobileCard
              key={o.id}
              order={o}
              user={user}
              canDeliverOrders={canDeliverOrders}
              onShare={(order) => setShareModal(enrichOrderForShare(order))}
              onDeliver={(order) => {
                setDeliverModal(order);
                setDeliverForm({
                  paidTo: "elie",
                  deliveredDate: new Date().toISOString().slice(0, 10),
                });
              }}
              onEdit={openEdit}
              onDelete={setDeleteOrder}
            />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Customer</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Meal</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Items (kg)</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Total</th>
              <th className="hidden xl:table-cell whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">
                COGS
              </th>
              <th className="hidden xl:table-cell whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">
                Profit
              </th>
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
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  No orders match filters.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">
                    {o.customerFirstName} {o.customerLastName}
                  </td>
                  <td className="max-w-[200px] px-3 py-3 text-slate-600">
                    <OrderItemsBreakdown order={o} showTotal={false} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                    {formatKg(orderItemBreakdownTotalKg(o))} kg
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <div className="text-xs">Subtotal: {money(o.businessSubtotal ?? o.totalPrice ?? 0)}</div>
                    <div className="text-xs">Delivery: {money(o.deliveryAmount || 0)}</div>
                    <div className="font-semibold">Total: {money(o.totalPrice)}</div>
                  </td>
                  <td className="hidden xl:table-cell px-3 py-3 text-xs tabular-nums text-slate-600">
                    {o.inventory?.hasAllocation ? money(o.inventory.cogs) : "—"}
                  </td>
                  <td className="hidden xl:table-cell px-3 py-3 text-xs font-medium tabular-nums text-emerald-800">
                    {o.inventory?.hasAllocation ? money(o.inventory.profit) : "—"}
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
                    <OrderActions
                      order={o}
                      user={user}
                      canDeliverOrders={canDeliverOrders}
                      onShare={(order) => setShareModal(enrichOrderForShare(order))}
                      onDeliver={(order) => {
                        setDeliverModal(order);
                        setDeliverForm({
                          paidTo: "elie",
                          deliveredDate: new Date().toISOString().slice(0, 10),
                        });
                      }}
                      onEdit={openEdit}
                      onDelete={setDeleteOrder}
                      variant="desktop"
                    />
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
        onClose={() => {
          setNewCustomerError("");
          setNewModal(false);
        }}
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
            <label className="text-xs font-medium text-slate-600" htmlFor="new-order-customer">
              Customer
            </label>
            <CustomerSearchSelect
              key={newModal ? "new-order-open" : "new-order-closed"}
              inputId="new-order-customer"
              customers={sortedCustomers}
              value={newForm.customerId}
              error={newCustomerError}
              onChange={(customerId) => {
                setNewCustomerError("");
                setNewForm((f) => ({ ...f, customerId }));
              }}
              onBlurValidate={(query, customerId) => {
                if (query.trim() && !customerId) {
                  setNewCustomerError(
                    "Please select a customer from the list. Typing a name or number is not enough — tap a result to select."
                  );
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Order items (qty = kg)</label>
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
                    min={0}
                    step="any"
                    title="kg"
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
      <OrderShareModal
        open={!!shareModal}
        order={shareModal}
        customers={customers}
        onClose={() => setShareModal(null)}
      />

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
          {canAdminOrders ? (
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
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Status stays pending. Use Mark Delivered on the orders list when the order is ready.
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600">Order items (qty = kg)</label>
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
                    min={0}
                    step="any"
                    title="kg"
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
          {canAdminOrders && editForm.status === "delivered" ? (
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
