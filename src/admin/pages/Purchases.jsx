import { useEffect, useState } from "react";
import { api } from "../../api.js";
import {
  INVENTORY_CATEGORIES,
  PARTNERS,
  UNIT_TYPES,
} from "../../lib/constants.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canDeletePurchase, canEditPurchase } from "../../lib/authz.js";
import Modal from "../components/Modal.jsx";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function emptyLine() {
  return {
    inventoryItemId: "",
    itemName: "",
    category: "vegetable",
    unit: "kg",
    quantityPurchased: "",
    totalCost: "",
    notes: "",
  };
}

function defaultPaidBy(user) {
  const u = String(user?.username || "").toLowerCase();
  return u === "elie" || u === "jimmy" ? u : "elie";
}

function applySelectedInventoryItem(line, itemId, catalog) {
  if (!itemId) {
    return {
      ...emptyLine(),
      quantityPurchased: line.quantityPurchased,
      totalCost: line.totalCost,
      notes: line.notes,
    };
  }
  const it = catalog.find((i) => String(i.id) === String(itemId));
  return {
    ...line,
    inventoryItemId: itemId,
    itemName: it?.name ?? line.itemName,
    category: it?.category ?? line.category,
    unit: it?.unit ?? line.unit,
  };
}

export default function Purchases() {
  const { user } = useAuth();
  const showDelete = canDeletePurchase(user);
  const showEdit = canEditPurchase(user);

  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    vendorName: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceTotal: "",
    paidBy: defaultPaidBy(user),
    notes: "",
    lines: [emptyLine()],
  });

  const [editOpen, setEditOpen] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () =>
    Promise.all([api("/inventory/purchases"), api("/inventory/items")])
      .then(([p, it]) => {
        setRows(p);
        setItems(it);
      })
      .catch((e) => setErr(e.message));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const submitAdd = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const lines = addForm.lines.map((ln) => {
        const base = {
          category: ln.category,
          unit: ln.unit,
          quantityPurchased: Number(ln.quantityPurchased),
          totalCost: Number(ln.totalCost),
          notes: ln.notes || "",
        };
        return ln.inventoryItemId
          ? { ...base, inventoryItemId: ln.inventoryItemId }
          : { ...base, itemName: ln.itemName };
      });
      await api("/inventory/purchases", {
        method: "POST",
        body: {
          vendorName: addForm.vendorName,
          invoiceDate: addForm.invoiceDate,
          invoiceTotal: Number(addForm.invoiceTotal),
          paidBy: addForm.paidBy,
          notes: addForm.notes,
          lines,
        },
      });
      setAddOpen(false);
      setAddForm({
        vendorName: "",
        invoiceDate: new Date().toISOString().slice(0, 10),
        invoiceTotal: "",
        paidBy: defaultPaidBy(user),
        notes: "",
        lines: [emptyLine()],
      });
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (p) => {
    setErr("");
    setEditOpen(p);
    setEditForm({
      vendorName: p.vendorName,
      invoiceDate: p.invoiceDate.slice(0, 10),
      invoiceTotal: String(p.invoiceTotal),
      paidBy: p.paidBy || defaultPaidBy(user),
      notes: p.notes || "",
      lines: (p.lines || []).map((ln) => ({
        inventoryItemId: ln.inventoryItemId,
        itemName: ln.itemNameSnapshot,
        category: ln.categorySnapshot,
        unit: ln.unit,
        quantityPurchased: String(ln.quantityPurchased),
        totalCost: String(ln.totalCost),
        notes: ln.notes || "",
      })),
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editOpen || !editForm) return;
    setErr("");
    try {
      const lines = editForm.lines.map((ln) => {
        const row = {
          inventoryItemId: ln.inventoryItemId || undefined,
          itemName: ln.itemName,
          category: ln.category,
          unit: ln.unit,
          quantityPurchased: Number(ln.quantityPurchased),
          totalCost: Number(ln.totalCost),
          notes: ln.notes || "",
        };
        return row;
      });
      await api(`/inventory/purchases/${editOpen.id}`, {
        method: "PUT",
        body: {
          vendorName: editForm.vendorName,
          invoiceDate: editForm.invoiceDate,
          invoiceTotal: Number(editForm.invoiceTotal),
          paidBy: editForm.paidBy,
          notes: editForm.notes,
          lines,
        },
      });
      setEditOpen(null);
      setEditForm(null);
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setErr("");
    try {
      await api(`/inventory/purchases/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Purchases</h1>
          <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
            Supplier invoices add FIFO purchase lots and inventory items.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full shrink-0 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2"
        >
          New purchase
        </button>
      </div>

      {err && !addOpen && !editOpen && !deleteTarget ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No purchases yet.</p>
        ) : (
          rows.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{p.vendorName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {p.invoiceDate?.slice(0, 10)} · Total {money(p.invoiceTotal)} · {p.lines?.length || 0} line(s)
                </div>
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">Remain</th>
                        <th className="px-2 py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.lines || []).map((ln) => (
                        <tr key={ln.id} className="border-b border-slate-50">
                          <td className="px-2 py-1.5">{ln.itemNameSnapshot}</td>
                          <td className="px-2 py-1.5">
                            {ln.quantityPurchased} {ln.unit}
                          </td>
                          <td className="px-2 py-1.5">
                            {ln.quantityRemaining} {ln.unit}
                          </td>
                          <td className="px-2 py-1.5 text-right">{money(ln.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 gap-3 sm:mt-0 sm:flex-col sm:items-end">
                {showEdit ? (
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="text-sm font-semibold text-forest hover:underline"
                  >
                    Edit
                  </button>
                ) : null}
                {showDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    className="text-sm font-semibold text-rose-700 hover:underline"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={addOpen}
        title="New purchase"
        onClose={() => setAddOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="purchase-add-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        {err && addOpen ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="purchase-add-form" onSubmit={submitAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Vendor</label>
              <input
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.vendorName}
                onChange={(e) => setAddForm((f) => ({ ...f, vendorName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Invoice date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.invoiceDate}
                onChange={(e) => setAddForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Invoice total</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.invoiceTotal}
                onChange={(e) => setAddForm((f) => ({ ...f, invoiceTotal: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Paid by</label>
              <select
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.paidBy}
                onChange={(e) => setAddForm((f) => ({ ...f, paidBy: e.target.value }))}
              >
                {PARTNERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Invoice total is also recorded as a business expense for balance totals.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <input
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={addForm.notes}
              onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold text-slate-700">Lines</div>
            {addForm.lines.map((ln, idx) => (
              <div key={idx} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                <div>
                  <label className="text-xs text-slate-600">Existing item (optional)</label>
                  <select
                    className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                    value={ln.inventoryItemId}
                    onChange={(e) =>
                      setAddForm((f) => {
                        const lines = [...f.lines];
                        lines[idx] = applySelectedInventoryItem(lines[idx], e.target.value, items);
                        return { ...f, lines };
                      })
                    }
                  >
                    <option value="">— New item below —</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </select>
                </div>
                {ln.inventoryItemId ? (
                  <p className="text-xs text-slate-600">
                    Unit: <span className="font-semibold text-slate-800">{ln.unit}</span> · Category:{" "}
                    <span className="font-semibold capitalize text-slate-800">{ln.category?.replace(/_/g, " ")}</span>
                  </p>
                ) : null}
                {!ln.inventoryItemId ? (
                  <>
                    <input
                      placeholder="Item name"
                      required
                      className="block w-full rounded-lg border-slate-300 text-sm"
                      value={ln.itemName}
                      onChange={(e) =>
                        setAddForm((f) => {
                          const lines = [...f.lines];
                          lines[idx] = { ...lines[idx], itemName: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="rounded-lg border-slate-300 text-sm"
                        value={ln.category}
                        onChange={(e) =>
                          setAddForm((f) => {
                            const lines = [...f.lines];
                            lines[idx] = { ...lines[idx], category: e.target.value };
                            return { ...f, lines };
                          })
                        }
                      >
                        {INVENTORY_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-lg border-slate-300 text-sm"
                        value={ln.unit}
                        onChange={(e) =>
                          setAddForm((f) => {
                            const lines = [...f.lines];
                            lines[idx] = { ...lines[idx], unit: e.target.value };
                            return { ...f, lines };
                          })
                        }
                      >
                        {UNIT_TYPES.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Qty purchased</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                      value={ln.quantityPurchased}
                      onChange={(e) =>
                        setAddForm((f) => {
                          const lines = [...f.lines];
                          lines[idx] = { ...lines[idx], quantityPurchased: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Line total ($)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                      value={ln.totalCost}
                      onChange={(e) =>
                        setAddForm((f) => {
                          const lines = [...f.lines];
                          lines[idx] = { ...lines[idx], totalCost: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-rose-700"
                    onClick={() =>
                      setAddForm((f) => ({
                        ...f,
                        lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines,
                      }))
                    }
                  >
                    Remove line
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-forest"
              onClick={() => setAddForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
            >
              + Add line
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editOpen && !!editForm}
        title="Edit purchase"
        onClose={() => {
          setEditOpen(null);
          setEditForm(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditOpen(null);
                setEditForm(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="purchase-edit-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        {err && editOpen ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        {editForm ? (
          <form id="purchase-edit-form" onSubmit={submitEdit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Vendor</label>
                <input
                  required
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.vendorName}
                  onChange={(e) => setEditForm((f) => ({ ...f, vendorName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Invoice date</label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.invoiceDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Invoice total</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.invoiceTotal}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoiceTotal: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Paid by</label>
                <select
                  required
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                  value={editForm.paidBy}
                  onChange={(e) => setEditForm((f) => ({ ...f, paidBy: e.target.value }))}
                >
                  {PARTNERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editOpen?.expenseId ? (
              <p className="text-xs text-slate-500">Linked expense updates when you save.</p>
            ) : (
              <p className="text-xs text-slate-500">
                This purchase has no linked expense (created before auto-expense). Totals are unchanged unless you add a manual expense.
              </p>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600">Notes</label>
              <input
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-700">Lines</div>
              {editForm.lines.map((ln, idx) => (
                <div key={idx} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-800">{ln.itemName || "Item"}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="rounded-lg border-slate-300 text-sm"
                      value={ln.category}
                      onChange={(e) =>
                        setEditForm((f) => {
                          const lines = [...f.lines];
                          lines[idx] = { ...lines[idx], category: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    >
                      {INVENTORY_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border-slate-300 text-sm"
                      value={ln.unit}
                      onChange={(e) =>
                        setEditForm((f) => {
                          const lines = [...f.lines];
                          lines[idx] = { ...lines[idx], unit: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    >
                      {UNIT_TYPES.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-600">Qty purchased</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step="any"
                        className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                        value={ln.quantityPurchased}
                        onChange={(e) =>
                          setEditForm((f) => {
                            const lines = [...f.lines];
                            lines[idx] = { ...lines[idx], quantityPurchased: e.target.value };
                            return { ...f, lines };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Line total ($)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                        value={ln.totalCost}
                        onChange={(e) =>
                          setEditForm((f) => {
                            const lines = [...f.lines];
                            lines[idx] = { ...lines[idx], totalCost: e.target.value };
                            return { ...f, lines };
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Delete purchase"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Only allowed when no quantity has been consumed from these lines.
        </p>
      </Modal>
    </div>
  );
}
