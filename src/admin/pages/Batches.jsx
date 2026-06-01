import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import { FINISHED_PRODUCT_TYPES } from "../../lib/constants.js";
import { sumBatchRemainingKg } from "../../lib/productKg.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canDeleteBatch } from "../../lib/authz.js";
import Modal from "../components/Modal.jsx";
import ProductKgSummaryCards from "../components/ProductKgSummaryCards.jsx";

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function emptyInput() {
  return { inventoryItemId: "", quantityUsed: "" };
}

function formatQtyAvailable(itemId, stockByItemId, items) {
  if (!itemId) return "--";
  const stock = stockByItemId.get(itemId);
  const item = items.find((it) => it.id === itemId);
  const unit = stock?.unit ?? item?.unit ?? "";
  const qty = stock != null ? stock.quantityAvailable : 0;
  return unit ? `${qty} ${unit}` : String(qty);
}

export default function Batches() {
  const { user } = useAuth();
  const showDelete = canDeleteBatch(user);

  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [stockByItemId, setStockByItemId] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    productType: "chicken_rice",
    batchDate: new Date().toISOString().slice(0, 10),
    outputQuantityKg: "",
    expectedSellingPricePerKg: "",
    notes: "",
    inputs: [emptyInput()],
  });

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () =>
    Promise.all([api("/inventory/batches"), api("/inventory/items"), api("/inventory/stock")])
      .then(([b, it, stock]) => {
        setRows(b);
        setItems(it);
        setStockByItemId(new Map(stock.map((s) => [s.inventoryItemId, s])));
      })
      .catch((e) => setErr(e.message));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const batchAvailableKg = useMemo(() => sumBatchRemainingKg(rows), [rows]);

  const submitAdd = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/inventory/batches", {
        method: "POST",
        body: {
          productType: addForm.productType,
          batchDate: addForm.batchDate,
          outputQuantityKg: Number(addForm.outputQuantityKg),
          notes: addForm.notes,
          expectedSellingPricePerKg:
            addForm.expectedSellingPricePerKg === "" ? null : Number(addForm.expectedSellingPricePerKg),
          inputs: addForm.inputs.map((x) => ({
            inventoryItemId: x.inventoryItemId,
            quantityUsed: Number(x.quantityUsed),
          })),
        },
      });
      setAddOpen(false);
      setAddForm({
        productType: "chicken_rice",
        batchDate: new Date().toISOString().slice(0, 10),
        outputQuantityKg: "",
        expectedSellingPricePerKg: "",
        notes: "",
        inputs: [emptyInput()],
      });
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
      await api(`/inventory/batches/${deleteTarget.id}`, { method: "DELETE" });
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
          <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Production batches</h1>
          <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
            Cook batches consume ingredient inventory (FIFO) and add finished kg for orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full shrink-0 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90 sm:w-auto sm:py-2"
        >
          New batch
        </button>
      </div>

      {err && !addOpen && !deleteTarget ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <ProductKgSummaryCards
        title="Finished stock available"
        subtitle="Sum of remaining kg across all production batches (not output kg)."
        totals={batchAvailableKg}
        suffix="available"
      />

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Code</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Product</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Output kg</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Remain kg</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Sold kg</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Cost/kg</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Batch cost</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-700">Realized profit</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700">Status</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  No batches yet.
                </td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-800">{b.batchCode}</td>
                  <td className="px-3 py-3 text-slate-700">{b.productType.replace(/_/g, " ")}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{b.batchDate?.slice(0, 10)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{b.outputQuantityKg}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{b.remainingQuantityKg}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{b.soldQuantityKg}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(b.costPerKg)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">{money(b.totalBatchCost)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-800">{money(b.realizedProfit)}</td>
                  <td className="px-3 py-3 capitalize text-slate-600">{b.status?.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 text-right">
                    {showDelete ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(b)}
                        className="text-xs font-semibold text-rose-700 hover:underline"
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={addOpen}
        title="New production batch"
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
              form="batch-add-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Create batch
            </button>
          </div>
        }
      >
        {err && addOpen ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="batch-add-form" onSubmit={submitAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Product</label>
              <select
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.productType}
                onChange={(e) => setAddForm((f) => ({ ...f, productType: e.target.value }))}
              >
                {FINISHED_PRODUCT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Batch date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.batchDate}
                onChange={(e) => setAddForm((f) => ({ ...f, batchDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Output (kg)</label>
              <input
                type="number"
                required
                min={0}
                step="any"
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.outputQuantityKg}
                onChange={(e) => setAddForm((f) => ({ ...f, outputQuantityKg: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Expected price/kg ($, optional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                value={addForm.expectedSellingPricePerKg}
                onChange={(e) => setAddForm((f) => ({ ...f, expectedSellingPricePerKg: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <input
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={addForm.notes}
              onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold text-slate-700">Ingredients & packaging used</div>
            <p className="mt-1 text-xs text-slate-500">
              Select inventory items (same units as purchases). Add rice, protein, vegetables, boxes, stickers, etc.
            </p>
            {addForm.inputs.map((row, idx) => (
              <div
                key={idx}
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,6rem)_auto] sm:items-end"
              >
                <div className="min-w-0">
                  <label className="text-xs text-slate-600">Item</label>
                  <select
                    required
                    className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                    value={row.inventoryItemId}
                    onChange={(e) =>
                      setAddForm((f) => {
                        const inputs = [...f.inputs];
                        inputs[idx] = { ...inputs[idx], inventoryItemId: e.target.value };
                        return { ...f, inputs };
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.unit}) · {it.category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-slate-600">Qty available</label>
                  <input
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className="mt-1 block w-full cursor-default rounded-lg border-slate-200 bg-slate-100 text-sm text-slate-700"
                    value={
                      row.inventoryItemId
                        ? `Available: ${formatQtyAvailable(row.inventoryItemId, stockByItemId, items)}`
                        : "--"
                    }
                  />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-slate-600">Qty used</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
                    value={row.quantityUsed}
                    onChange={(e) =>
                      setAddForm((f) => {
                        const inputs = [...f.inputs];
                        inputs[idx] = { ...inputs[idx], quantityUsed: e.target.value };
                        return { ...f, inputs };
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="justify-self-start text-xs text-rose-700 sm:mb-1 sm:justify-self-auto"
                  onClick={() =>
                    setAddForm((f) => ({
                      ...f,
                      inputs: f.inputs.length > 1 ? f.inputs.filter((_, i) => i !== idx) : f.inputs,
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-forest"
              onClick={() => setAddForm((f) => ({ ...f, inputs: [...f.inputs, emptyInput()] }))}
            >
              + Add input
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Delete batch"
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
          Restores ingredient quantities from recorded FIFO lots. Only allowed if no orders have been allocated from this
          batch.
        </p>
      </Modal>
    </div>
  );
}
