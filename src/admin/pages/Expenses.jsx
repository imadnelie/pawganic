import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { PARTNERS } from "../../lib/constants.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function emptyAddForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    paidBy: "elie",
  };
}

export default function Expenses() {
  const { user } = useAuth();
  const canEditExpenses = user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState(emptyAddForm);

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({
    date: "",
    description: "",
    amount: "",
    paidBy: "elie",
  });

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () =>
    api("/expenses")
      .then(setRows)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const submitAdd = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/expenses", {
        method: "POST",
        body: {
          date: form.date,
          description: form.description,
          amount: Number(form.amount),
          paidBy: form.paidBy,
        },
      });
      setAddModal(false);
      setForm(emptyAddForm());
      setLoading(true);
      await load();
      setSuccess("Expense added.");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const openEdit = (e) => {
    setErr("");
    setEditRow(e);
    setEditForm({
      date: e.date,
      description: e.description,
      amount: String(e.amount),
      paidBy: e.paidBy,
    });
  };

  const submitEdit = async (ev) => {
    ev.preventDefault();
    if (!editRow) return;
    setErr("");
    try {
      await api(`/expenses/${editRow.id}`, {
        method: "PUT",
        body: {
          date: editForm.date,
          description: editForm.description,
          amount: Number(editForm.amount),
          paidBy: editForm.paidBy,
        },
      });
      setEditRow(null);
      setLoading(true);
      await load();
      setSuccess("Expense updated.");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setErr("");
    try {
      await api(`/expenses/${deleteTarget.id}`, { method: "DELETE" });
      if (editRow?.id === deleteTarget.id) setEditRow(null);
      setDeleteTarget(null);
      setLoading(true);
      await load();
      setSuccess("Expense deleted.");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Business costs paid by each partner</p>
        </div>
        <button
          type="button"
          onClick={() => setAddModal(true)}
          className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest/90"
        >
          Add expense
        </button>
      </div>

      {success ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {err && !addModal && !editRow && !deleteTarget ? (
        <p className="mt-4 text-sm text-red-600">{err}</p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Paid by</th>
              {canEditExpenses ? (
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={canEditExpenses ? 5 : 4}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEditExpenses ? 5 : 4}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No expenses recorded.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{e.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{e.description}</td>
                  <td className="px-4 py-3 text-slate-600">{money(e.amount)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{e.paidBy}</td>
                  {canEditExpenses ? (
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="text-sm font-semibold text-forest hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErr("");
                            setDeleteTarget(e);
                          }}
                          className="text-sm font-semibold text-rose-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={addModal}
        title="Add expense"
        onClose={() => setAddModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="expense-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        {err && addModal ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="expense-form" onSubmit={submitAdd} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <input
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Paid by</label>
            <select
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.paidBy}
              onChange={(e) => setForm((f) => ({ ...f, paidBy: e.target.value }))}
            >
              {PARTNERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editRow}
        title="Edit expense"
        onClose={() => {
          setEditRow(null);
          setErr("");
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditRow(null);
                setErr("");
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="expense-edit-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Update
            </button>
          </div>
        }
      >
        {err && editRow ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="expense-edit-form" onSubmit={submitEdit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={editForm.date}
              onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <input
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={editForm.amount}
              onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Paid by</label>
            <select
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
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Delete expense"
        onClose={() => {
          setDeleteTarget(null);
          setErr("");
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteTarget(null);
                setErr("");
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
            >
              Delete
            </button>
          </div>
        }
      >
        {err && deleteTarget ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        {deleteTarget ? (
          <p className="text-sm text-slate-700">
            Remove this expense permanently?{" "}
            <span className="font-medium text-slate-900">{deleteTarget.description}</span> —{" "}
            {money(deleteTarget.amount)} ({deleteTarget.date}, paid by {deleteTarget.paidBy})
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
