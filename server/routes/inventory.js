import { Router } from "express";
import mongoose from "mongoose";
import {
  InventoryItem,
  Purchase,
  PurchaseLine,
  ProductionBatch,
  BatchInput,
  FinishedInventoryLot,
  OrderBatchAllocation,
  INVENTORY_MODEL_CONSTANTS,
} from "../inventoryModels.js";
import { requireAuth, requireAdmin, requireAdminOrUser } from "../middleware/auth.js";
import { isPartner } from "../constants.js";
import {
  consumeIngredientFifo,
  restoreIngredientLots,
  roundMoney,
  generateBatchCode,
  validateBatchProductType,
} from "../services/inventoryFifo.js";
import { Order } from "../db.js";
import {
  createLinkedExpenseForPurchase,
  deleteLinkedExpenseForPurchase,
  resolvePurchasePaidBy,
  updateLinkedExpenseForPurchase,
} from "../services/purchaseExpense.js";

const r = Router();
r.use(requireAuth);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseIsoDate(d) {
  if (d == null || d === "") return { error: "Date is required" };
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return { error: "Invalid date" };
  return { value: dt };
}

/** Staff + admin: view & create. Admin: mutate destructive. */
r.get("/items", requireAdminOrUser, async (req, res) => {
  try {
    const items = await InventoryItem.find({ active: true }).sort({ name: 1 }).lean();
    res.json(
      items.map((it) => ({
        id: String(it._id),
        name: it.name,
        category: it.category,
        unit: it.unit,
        active: it.active,
        createdAt: it.createdAt,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

/** Aggregated ingredient/supply stock from purchase lines (FIFO lots). */
r.get("/stock", requireAdminOrUser, async (req, res) => {
  try {
    const rows = await PurchaseLine.aggregate([
      { $match: { quantityRemaining: { $gt: 1e-6 } } },
      {
        $group: {
          _id: "$inventoryItemId",
          quantity: { $sum: "$quantityRemaining" },
          stockValue: {
            $sum: { $multiply: [{ $toDouble: "$quantityRemaining" }, { $toDouble: "$unitCost" }] },
          },
        },
      },
    ]);
    const ids = rows.map((r) => r._id).filter(Boolean);
    const items = await InventoryItem.find({ _id: { $in: ids } }).lean();
    const byId = new Map(items.map((it) => [String(it._id), it]));

    const out = rows.map((row) => {
      const it = byId.get(String(row._id));
      const qty = num(row.quantity);
      const sv = num(row.stockValue);
      const avg = qty > 0 ? sv / qty : 0;
      return {
        inventoryItemId: String(row._id),
        itemName: it?.name ?? "",
        category: it?.category ?? "",
        unit: it?.unit ?? "",
        quantityAvailable: roundMoney(qty),
        averageCostDisplay: roundMoney(avg),
        stockValue: roundMoney(sv),
      };
    });

    out.sort((a, b) => a.itemName.localeCompare(b.itemName));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

async function resolveInventoryItemForLine(bodyLine, session) {
  const payloadUnit = String(bodyLine?.unit || "").trim();
  const category = String(bodyLine?.category || "").trim();
  const itemName = String(bodyLine?.itemName || "").trim();
  const inventoryItemId = bodyLine?.inventoryItemId != null ? String(bodyLine.inventoryItemId) : "";

  if (inventoryItemId) {
    if (!mongoose.isValidObjectId(inventoryItemId)) throw new Error("Invalid inventory item id");
    let iq = InventoryItem.findById(inventoryItemId);
    if (session) iq = iq.session(session);
    const existing = await iq;
    if (!existing) throw new Error("Inventory item not found");
    const storedUnit = String(existing.unit);
    if (payloadUnit !== storedUnit) {
      console.warn("[purchase] unit mismatch (using stored inventory item unit)", {
        inventoryItemId,
        itemName: existing.name,
        storedUnit,
        payloadUnit: payloadUnit || "(empty)",
        comparison: `String(existing.unit) !== String(bodyLine.unit) → ${JSON.stringify(storedUnit)} !== ${JSON.stringify(payloadUnit)}`,
      });
    }
    return existing;
  }

  const unit = payloadUnit;
  if (!INVENTORY_MODEL_CONSTANTS.UNIT_TYPES.includes(unit)) {
    throw new Error("Invalid unit type on purchase line");
  }
  if (!INVENTORY_MODEL_CONSTANTS.INVENTORY_CATEGORIES.includes(category)) {
    throw new Error("Invalid category on purchase line");
  }

  if (!itemName) throw new Error("Item name is required when inventoryItemId is omitted");

  let q = InventoryItem.findOne({ name: itemName, unit });
  if (session) q = q.session(session);
  let item = await q;
  if (!item) {
    const created = await InventoryItem.create(
      [{ name: itemName, category, unit, active: true, updatedAt: new Date() }],
      session ? { session } : {}
    );
    item = created[0];
  } else if (String(item.category) !== category) {
    item.category = category;
    item.updatedAt = new Date();
    await item.save(session ? { session } : {});
  }
  return item;
}

r.post("/purchases", requireAdminOrUser, async (req, res) => {
  const username = String(req.user?.username || "").toLowerCase().trim();
  if (!isPartner(username)) return res.status(400).json({ error: "Invalid session user" });

  const session = await mongoose.startSession();
  try {
    let created = null;
    await session.withTransaction(async () => {
      const { vendorName, invoiceDate, invoiceTotal, notes, paidBy: paidByInput, lines: linesInput } =
        req.body || {};
      const paidBy = resolvePurchasePaidBy(paidByInput, username);
      const vendor = String(vendorName || "").trim();
      const parsedDate = parseIsoDate(invoiceDate);
      if (parsedDate.error) throw new Error(parsedDate.error);
      const total = num(invoiceTotal);
      if (total < 0) throw new Error("Invoice total must be >= 0");
      if (!Array.isArray(linesInput) || linesInput.length < 1) {
        throw new Error("At least one purchase line is required");
      }

      const lines = [];
      let sumLines = 0;
      for (const ln of linesInput) {
        const qty = num(ln?.quantityPurchased);
        const lineTotal = num(ln?.totalCost);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Each line needs quantityPurchased > 0");
        if (!Number.isFinite(lineTotal) || lineTotal < 0) throw new Error("Each line needs totalCost >= 0");
        const unitCost = qty > 0 ? roundMoney(lineTotal / qty) : 0;
        const item = await resolveInventoryItemForLine(ln, session);
        let expiryDate = null;
        if (ln?.expiryDate) {
          const ex = new Date(ln.expiryDate);
          if (!Number.isNaN(ex.getTime())) expiryDate = ex;
        }
        lines.push({
          inventoryItem: item,
          itemNameSnapshot: item.name,
          categorySnapshot: item.category,
          unit: item.unit,
          quantityPurchased: qty,
          totalCost: roundMoney(lineTotal),
          unitCost,
          expiryDate,
          notes: String(ln?.notes || ""),
        });
        sumLines = roundMoney(sumLines + lineTotal);
      }

      if (Math.abs(sumLines - total) > 0.05) {
        throw new Error(`Invoice total ($${total}) does not match sum of line totals ($${sumLines})`);
      }

      const purchase = (
        await Purchase.create(
          [
            {
              vendorName: vendor,
              invoiceDate: parsedDate.value,
              invoiceTotal: total,
              notes: String(notes || ""),
              createdBy: username,
              paidBy,
            },
          ],
          { session }
        )
      )[0];

      for (const ln of lines) {
        await PurchaseLine.create(
          [
            {
              purchaseId: purchase._id,
              inventoryItemId: ln.inventoryItem._id,
              itemNameSnapshot: ln.itemNameSnapshot,
              categorySnapshot: ln.categorySnapshot,
              unit: ln.unit,
              quantityPurchased: ln.quantityPurchased,
              quantityRemaining: ln.quantityPurchased,
              totalCost: ln.totalCost,
              unitCost: ln.unitCost,
              expiryDate: ln.expiryDate,
              notes: ln.notes,
            },
          ],
          { session }
        );
      }

      await createLinkedExpenseForPurchase(purchase, paidBy, session);
      created = await Purchase.findById(purchase._id).session(session).lean();
    });

    const populated = await Purchase.findById(created._id).lean();
    const purchaseLines = await PurchaseLine.find({ purchaseId: populated._id }).sort({ createdAt: 1 }).lean();
    res.status(201).json(formatPurchaseResponse(populated, purchaseLines));
  } catch (e) {
    const msg = e?.message || "Server error";
    if (String(msg).includes("Transaction")) {
      console.warn("[inventory] purchase transaction failed:", msg);
    }
    res.status(400).json({ error: msg });
  } finally {
    session.endSession();
  }
});

function formatPurchaseResponse(purchaseDoc, lineDocs) {
  return {
    id: String(purchaseDoc._id),
    vendorName: purchaseDoc.vendorName,
    invoiceDate:
      purchaseDoc.invoiceDate instanceof Date
        ? purchaseDoc.invoiceDate.toISOString()
        : purchaseDoc.invoiceDate,
    invoiceTotal: num(purchaseDoc.invoiceTotal),
    notes: purchaseDoc.notes || "",
    createdBy: purchaseDoc.createdBy,
    paidBy: purchaseDoc.paidBy || null,
    expenseId: purchaseDoc.expenseId != null ? String(purchaseDoc.expenseId) : null,
    createdAt:
      purchaseDoc.createdAt instanceof Date
        ? purchaseDoc.createdAt.toISOString()
        : purchaseDoc.createdAt,
    lines: (lineDocs || []).map((ln) => ({
      id: String(ln._id),
      inventoryItemId: String(ln.inventoryItemId),
      itemNameSnapshot: ln.itemNameSnapshot,
      categorySnapshot: ln.categorySnapshot,
      unit: ln.unit,
      quantityPurchased: num(ln.quantityPurchased),
      quantityRemaining: num(ln.quantityRemaining),
      totalCost: num(ln.totalCost),
      unitCost: num(ln.unitCost),
      expiryDate: ln.expiryDate instanceof Date ? ln.expiryDate.toISOString() : ln.expiryDate || null,
      notes: ln.notes || "",
      createdAt: ln.createdAt instanceof Date ? ln.createdAt.toISOString() : ln.createdAt,
    })),
  };
}

r.get("/purchases", requireAdminOrUser, async (req, res) => {
  try {
    const purchases = await Purchase.find({}).sort({ invoiceDate: -1 }).limit(200).lean();
    const ids = purchases.map((p) => p._id);
    const allLines = await PurchaseLine.find({ purchaseId: { $in: ids } }).sort({ createdAt: 1 }).lean();
    const byP = new Map();
    for (const ln of allLines) {
      const k = String(ln.purchaseId);
      if (!byP.has(k)) byP.set(k, []);
      byP.get(k).push(ln);
    }
    res.json(purchases.map((p) => formatPurchaseResponse(p, byP.get(String(p._id)) || [])));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/purchases/:id", requireAdminOrUser, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
    const purchase = await Purchase.findById(id).lean();
    if (!purchase) return res.status(404).json({ error: "Not found" });
    const lines = await PurchaseLine.find({ purchaseId: purchase._id }).sort({ createdAt: 1 }).lean();
    res.json(formatPurchaseResponse(purchase, lines));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

function purchaseLinesFullyUnused(lines) {
  return lines.every((ln) => Math.abs(num(ln.quantityRemaining) - num(ln.quantityPurchased)) < 1e-6);
}

r.put("/purchases/:id", requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let out = null;
    await session.withTransaction(async () => {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) throw new Error("Not found");
      const purchase = await Purchase.findById(id).session(session);
      if (!purchase) throw new Error("Not found");
      const existingLines = await PurchaseLine.find({ purchaseId: purchase._id }).session(session);
      if (!purchaseLinesFullyUnused(existingLines)) {
        throw new Error("Cannot edit purchase after inventory has been consumed from its lines");
      }
      const { vendorName, invoiceDate, invoiceTotal, notes, paidBy: paidByInput, lines: linesInput } =
        req.body || {};
      const vendor = String(vendorName || "").trim();
      const parsedDate = parseIsoDate(invoiceDate);
      if (parsedDate.error) throw new Error(parsedDate.error);
      const total = num(invoiceTotal);
      if (total < 0) throw new Error("Invoice total must be >= 0");
      if (!Array.isArray(linesInput) || linesInput.length < 1) {
        throw new Error("At least one purchase line is required");
      }
      const paidBy = resolvePurchasePaidBy(paidByInput, purchase.paidBy || req.user?.username);

      await PurchaseLine.deleteMany({ purchaseId: purchase._id }).session(session);

      purchase.vendorName = vendor;
      purchase.invoiceDate = parsedDate.value;
      purchase.invoiceTotal = total;
      purchase.notes = String(notes || "");
      purchase.paidBy = paidBy;
      await purchase.save({ session });

      let sumLines = 0;
      for (const ln of linesInput) {
        const qty = num(ln?.quantityPurchased);
        const lineTotal = num(ln?.totalCost);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Each line needs quantityPurchased > 0");
        if (!Number.isFinite(lineTotal) || lineTotal < 0) throw new Error("Each line needs totalCost >= 0");
        const unitCost = qty > 0 ? roundMoney(lineTotal / qty) : 0;
        const item = await resolveInventoryItemForLine(ln, session);
        let expiryDate = null;
        if (ln?.expiryDate) {
          const ex = new Date(ln.expiryDate);
          if (!Number.isNaN(ex.getTime())) expiryDate = ex;
        }
        await PurchaseLine.create(
          [
            {
              purchaseId: purchase._id,
              inventoryItemId: item._id,
              itemNameSnapshot: item.name,
              categorySnapshot: item.category,
              unit: item.unit,
              quantityPurchased: qty,
              quantityRemaining: qty,
              totalCost: roundMoney(lineTotal),
              unitCost,
              expiryDate,
              notes: String(ln?.notes || ""),
            },
          ],
          { session }
        );
        sumLines = roundMoney(sumLines + lineTotal);
      }
      if (Math.abs(sumLines - total) > 0.05) {
        throw new Error(`Invoice total ($${total}) does not match sum of line totals ($${sumLines})`);
      }

      await updateLinkedExpenseForPurchase(purchase, paidBy, session);

      const lineDocs = await PurchaseLine.find({ purchaseId: purchase._id }).sort({ createdAt: 1 }).session(session).lean();
      out = formatPurchaseResponse(purchase.toObject(), lineDocs);
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || "Server error" });
  } finally {
    session.endSession();
  }
});

r.delete("/purchases/:id", requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let done = false;
    await session.withTransaction(async () => {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) throw new Error("Invalid id");
      const purchase = await Purchase.findById(id).session(session);
      if (!purchase) throw new Error("Not found");
      const lines = await PurchaseLine.find({ purchaseId: purchase._id }).session(session);
      if (!purchaseLinesFullyUnused(lines)) {
        throw new Error("Cannot delete purchase after inventory has been consumed");
      }
      await deleteLinkedExpenseForPurchase(purchase, session);
      await PurchaseLine.deleteMany({ purchaseId: purchase._id }).session(session);
      await Purchase.deleteOne({ _id: purchase._id }).session(session);
      done = true;
    });
    if (!done) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (e) {
    const msg = e?.message || "Server error";
    const status = msg === "Not found" ? 404 : msg.includes("Cannot delete") ? 400 : 500;
    res.status(status).json({ error: msg });
  } finally {
    session.endSession();
  }
});

r.post("/batches", requireAdminOrUser, async (req, res) => {
  const username = String(req.user?.username || "").toLowerCase().trim();
  if (!isPartner(username)) return res.status(400).json({ error: "Invalid session user" });

  const session = await mongoose.startSession();
  try {
    let batchOut = null;
    await session.withTransaction(async () => {
      const {
        productType,
        batchDate,
        outputQuantityKg,
        notes,
        expectedSellingPricePerKg,
        inputs: inputsInput,
      } = req.body || {};

      if (!validateBatchProductType(productType)) {
        throw new Error("Invalid product type");
      }
      const parsedDate = parseIsoDate(batchDate);
      if (parsedDate.error) throw new Error(parsedDate.error);
      const outputKg = num(outputQuantityKg);
      if (!Number.isFinite(outputKg) || outputKg <= 0) throw new Error("Output quantity (kg) must be > 0");
      if (!Array.isArray(inputsInput) || inputsInput.length < 1) {
        throw new Error("At least one ingredient input is required");
      }

      const batchCode = await generateBatchCode(session);
      let totalBatchCost = 0;
      const batchInputsPayload = [];

      for (const row of inputsInput) {
        const iid = row?.inventoryItemId;
        const qty = num(row?.quantityUsed);
        if (!mongoose.isValidObjectId(String(iid || ""))) throw new Error("Invalid inventory item on batch input");
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Each batch input needs quantityUsed > 0");
        const item = await InventoryItem.findById(iid).session(session);
        if (!item) throw new Error("Inventory item not found");

        const { allocatedCost, lots } = await consumeIngredientFifo(session, item._id, qty);
        totalBatchCost = roundMoney(totalBatchCost + allocatedCost);
        batchInputsPayload.push({
          inventoryItem: item,
          quantityUsed: qty,
          allocatedCost,
          lots,
        });
      }

      const costPerKg = outputKg > 0 ? roundMoney(totalBatchCost / outputKg) : 0;
      const esp = expectedSellingPricePerKg != null ? num(expectedSellingPricePerKg) : null;
      if (esp != null && (!Number.isFinite(esp) || esp < 0)) throw new Error("expectedSellingPricePerKg must be >= 0");

      const batch = (
        await ProductionBatch.create(
          [
            {
              batchCode,
              productType,
              batchDate: parsedDate.value,
              outputQuantityKg: outputKg,
              remainingQuantityKg: outputKg,
              soldQuantityKg: 0,
              totalBatchCost,
              costPerKg,
              expectedSellingPricePerKg: esp,
              notes: String(notes || ""),
              status: "available",
              createdBy: username,
            },
          ],
          { session }
        )
      )[0];

      for (const bi of batchInputsPayload) {
        await BatchInput.create(
          [
            {
              batchId: batch._id,
              inventoryItemId: bi.inventoryItem._id,
              itemNameSnapshot: bi.inventoryItem.name,
              unit: bi.inventoryItem.unit,
              quantityUsed: bi.quantityUsed,
              allocatedCost: bi.allocatedCost,
              sourcePurchaseLots: bi.lots.map((x) => ({
                purchaseLineId: x.purchaseLineId,
                quantity: x.quantity,
                unitCost: x.unitCost,
                cost: x.cost,
              })),
            },
          ],
          { session }
        );
      }

      await FinishedInventoryLot.create(
        [
          {
            batchId: batch._id,
            productType,
            originalQuantityKg: outputKg,
            remainingQuantityKg: outputKg,
            costPerKg,
          },
        ],
        { session }
      );

      batchOut = await ProductionBatch.findById(batch._id).session(session).lean();
    });

    const inputs = await BatchInput.find({ batchId: batchOut._id }).lean();
    res.status(201).json(formatBatchResponse(batchOut, inputs));
  } catch (e) {
    res.status(400).json({ error: e.message || "Server error" });
  } finally {
    session.endSession();
  }
});

function formatBatchResponse(batchDoc, inputDocs) {
  const rem = num(batchDoc.remainingQuantityKg);
  const sold = num(batchDoc.soldQuantityKg);
  let status = batchDoc.status;
  if (rem <= 1e-6) status = "sold_out";
  else if (sold > 1e-6) status = "partially_sold";
  else status = "available";

  const esp = batchDoc.expectedSellingPricePerKg != null ? num(batchDoc.expectedSellingPricePerKg) : null;
  const expectedRevenue = esp != null ? roundMoney(esp * num(batchDoc.outputQuantityKg)) : null;
  const expectedProfit =
    expectedRevenue != null ? roundMoney(expectedRevenue - num(batchDoc.totalBatchCost)) : null;

  return {
    id: String(batchDoc._id),
    batchCode: batchDoc.batchCode,
    productType: batchDoc.productType,
    batchDate: batchDoc.batchDate instanceof Date ? batchDoc.batchDate.toISOString() : batchDoc.batchDate,
    outputQuantityKg: num(batchDoc.outputQuantityKg),
    remainingQuantityKg: rem,
    soldQuantityKg: sold,
    totalBatchCost: num(batchDoc.totalBatchCost),
    costPerKg: num(batchDoc.costPerKg),
    expectedSellingPricePerKg: esp,
    expectedRevenue,
    expectedProfit,
    notes: batchDoc.notes || "",
    status,
    createdBy: batchDoc.createdBy,
    createdAt: batchDoc.createdAt instanceof Date ? batchDoc.createdAt.toISOString() : batchDoc.createdAt,
    inputs: (inputDocs || []).map((inp) => ({
      id: String(inp._id),
      inventoryItemId: String(inp.inventoryItemId),
      itemNameSnapshot: inp.itemNameSnapshot,
      unit: inp.unit,
      quantityUsed: num(inp.quantityUsed),
      allocatedCost: num(inp.allocatedCost),
      sourcePurchaseLots: (inp.sourcePurchaseLots || []).map((s) => ({
        purchaseLineId: String(s.purchaseLineId),
        quantity: num(s.quantity),
        unitCost: num(s.unitCost),
        cost: num(s.cost),
      })),
    })),
  };
}

r.get("/batches", requireAdminOrUser, async (req, res) => {
  try {
    const batches = await ProductionBatch.find({}).sort({ batchDate: -1 }).limit(300).lean();
    const ids = batches.map((b) => b._id);
    const inputs = await BatchInput.find({ batchId: { $in: ids } }).lean();
    const byB = new Map();
    for (const inp of inputs) {
      const k = String(inp.batchId);
      if (!byB.has(k)) byB.set(k, []);
      byB.get(k).push(inp);
    }

    const allocationAgg = await OrderBatchAllocation.aggregate([
      { $match: { batchId: { $in: ids } } },
      {
        $group: {
          _id: "$batchId",
          realizedRevenue: { $sum: "$revenueAllocated" },
          realizedCogs: { $sum: "$allocatedCost" },
        },
      },
    ]);
    const byBatchProfit = new Map(allocationAgg.map((a) => [String(a._id), a]));

    const out = batches.map((b) => {
      const base = formatBatchResponse(b, byB.get(String(b._id)) || []);
      const prof = byBatchProfit.get(String(b._id));
      const realizedRevenue = prof ? num(prof.realizedRevenue) : 0;
      const realizedCogs = prof ? num(prof.realizedCogs) : 0;
      const realizedProfit = roundMoney(realizedRevenue - realizedCogs);
      const soldKg = num(b.soldQuantityKg);
      const profitPerKgSold = soldKg > 0 ? roundMoney(realizedProfit / soldKg) : null;
      return {
        ...base,
        realizedRevenue,
        realizedProfit,
        profitPerKgSold,
      };
    });

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/batches/:id", requireAdminOrUser, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
    const batch = await ProductionBatch.findById(id).lean();
    if (!batch) return res.status(404).json({ error: "Not found" });
    const inputs = await BatchInput.find({ batchId: batch._id }).lean();

    const [prof] = await OrderBatchAllocation.aggregate([
      { $match: { batchId: batch._id } },
      {
        $group: {
          _id: "$batchId",
          realizedRevenue: { $sum: "$revenueAllocated" },
          realizedCogs: { $sum: "$allocatedCost" },
        },
      },
    ]);
    const realizedRevenue = prof ? num(prof.realizedRevenue) : 0;
    const realizedCogs = prof ? num(prof.realizedCogs) : 0;
    const realizedProfit = roundMoney(realizedRevenue - realizedCogs);
    const soldKg = num(batch.soldQuantityKg);
    const profitPerKgSold = soldKg > 0 ? roundMoney(realizedProfit / soldKg) : null;

    res.json({
      ...formatBatchResponse(batch, inputs),
      realizedRevenue,
      realizedProfit,
      profitPerKgSold,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.delete("/batches/:id", requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) throw new Error("Invalid id");
      const batch = await ProductionBatch.findById(id).session(session);
      if (!batch) throw new Error("Not found");
      const allocCount = await OrderBatchAllocation.countDocuments({ batchId: batch._id }).session(session);
      if (allocCount > 0) {
        throw new Error("Cannot delete a batch that already has order allocations");
      }
      const inputs = await BatchInput.find({ batchId: batch._id }).session(session);
      for (const inp of inputs) {
        await restoreIngredientLots(session, inp.sourcePurchaseLots || []);
      }
      await FinishedInventoryLot.deleteMany({ batchId: batch._id }).session(session);
      await BatchInput.deleteMany({ batchId: batch._id }).session(session);
      await ProductionBatch.deleteOne({ _id: batch._id }).session(session);
    });
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: e.message || "Server error" });
  } finally {
    session.endSession();
  }
});

/** Finished meal lots (FIFO layer). */
r.get("/finished-stock", requireAdminOrUser, async (req, res) => {
  try {
    const lots = await FinishedInventoryLot.find({ remainingQuantityKg: { $gt: 1e-6 } })
      .sort({ createdAt: 1 })
      .lean();
    const batchIds = lots.map((l) => l.batchId);
    const batches = await ProductionBatch.find({ _id: { $in: batchIds } }).lean();
    const byId = new Map(batches.map((b) => [String(b._id), b]));

    const byProduct = new Map();
    for (const lot of lots) {
      const b = byId.get(String(lot.batchId));
      const row = {
        lotId: String(lot._id),
        batchId: String(lot.batchId),
        batchCode: b?.batchCode ?? "",
        batchDate: b?.batchDate
          ? b.batchDate instanceof Date
            ? b.batchDate.toISOString()
            : b.batchDate
          : null,
        productType: lot.productType,
        originalQuantityKg: num(lot.originalQuantityKg),
        remainingQuantityKg: num(lot.remainingQuantityKg),
        costPerKg: num(lot.costPerKg),
        valueAtCost: roundMoney(num(lot.remainingQuantityKg) * num(lot.costPerKg)),
      };
      const k = lot.productType;
      if (!byProduct.has(k)) {
        byProduct.set(k, { productType: k, totalKg: 0, valueAtCost: 0, batches: [] });
      }
      const agg = byProduct.get(k);
      agg.totalKg = roundMoney(agg.totalKg + num(lot.remainingQuantityKg));
      agg.valueAtCost = roundMoney(agg.valueAtCost + row.valueAtCost);
      agg.batches.push(row);
    }

    res.json({
      lots: lots.map((lot) => {
        const b = byId.get(String(lot.batchId));
        return {
          lotId: String(lot._id),
          batchId: String(lot.batchId),
          batchCode: b?.batchCode ?? "",
          batchDate: b?.batchDate
            ? b.batchDate instanceof Date
              ? b.batchDate.toISOString()
              : b.batchDate
            : null,
          productType: lot.productType,
          originalQuantityKg: num(lot.originalQuantityKg),
          remainingQuantityKg: num(lot.remainingQuantityKg),
          soldKg: roundMoney(num(lot.originalQuantityKg) - num(lot.remainingQuantityKg)),
          costPerKg: num(lot.costPerKg),
          status:
            num(lot.remainingQuantityKg) <= 1e-6
              ? "sold_out"
              : num(lot.originalQuantityKg) - num(lot.remainingQuantityKg) > 1e-6
                ? "partially_sold"
                : "available",
        };
      }),
      byProduct: [...byProduct.values()],
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/reports/summary", requireAdminOrUser, async (req, res) => {
  try {
    const ingredientStock = await PurchaseLine.aggregate([
      { $match: { quantityRemaining: { $gt: 1e-6 } } },
      {
        $group: {
          _id: "$inventoryItemId",
          quantity: { $sum: "$quantityRemaining" },
          stockValue: {
            $sum: { $multiply: [{ $toDouble: "$quantityRemaining" }, { $toDouble: "$unitCost" }] },
          },
        },
      },
    ]);
    const itemIds = ingredientStock.map((x) => x._id);
    const items = await InventoryItem.find({ _id: { $in: itemIds } }).lean();
    const itemMap = new Map(items.map((it) => [String(it._id), it]));

    const finishedLots = await FinishedInventoryLot.find({ remainingQuantityKg: { $gt: 1e-6 } }).lean();

    const finishedByProduct = new Map();
    for (const lot of finishedLots) {
      const val = roundMoney(num(lot.remainingQuantityKg) * num(lot.costPerKg));
      const pt = lot.productType;
      if (!finishedByProduct.has(pt)) {
        finishedByProduct.set(pt, { productType: pt, availableKg: 0, batchesAvailable: 0, valueAtCost: 0 });
      }
      const agg = finishedByProduct.get(pt);
      agg.availableKg = roundMoney(agg.availableKg + num(lot.remainingQuantityKg));
      agg.batchesAvailable += 1;
      agg.valueAtCost = roundMoney(agg.valueAtCost + val);
    }

    res.json({
      ingredientStock: ingredientStock.map((row) => {
        const it = itemMap.get(String(row._id));
        const qty = num(row.quantity);
        const sv = num(row.stockValue);
        return {
          item: it?.name ?? "",
          inventoryItemId: String(row._id),
          category: it?.category ?? "",
          availableQuantity: roundMoney(qty),
          unit: it?.unit ?? "",
          stockValue: roundMoney(sv),
        };
      }),
      finishedStock: [...finishedByProduct.values()],
      batchCount: await ProductionBatch.countDocuments({}),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/reports/order-profit", requireAdminOrUser, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, num(req.query.limit) || 100));
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    const ids = orders.map((o) => o._id);
    const allocs = await OrderBatchAllocation.find({ orderId: { $in: ids } }).lean();
    const byOrder = new Map();
    for (const a of allocs) {
      const k = String(a.orderId);
      if (!byOrder.has(k)) byOrder.set(k, []);
      byOrder.get(k).push(a);
    }

    const out = orders.map((o) => {
      const list = byOrder.get(String(o._id)) || [];
      const cogs = roundMoney(list.reduce((s, x) => s + num(x.allocatedCost), 0));
      const allocRev = roundMoney(list.reduce((s, x) => s + num(x.revenueAllocated), 0));
      const businessSubtotal = num(o.businessSubtotal);
      const delivery = num(o.deliveryAmount);
      const hasAlloc = list.length > 0;
      const isDelivered = o.status === "delivered";
      return {
        orderId: String(o._id),
        createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
        status: o.status,
        revenueExcludingDelivery: businessSubtotal,
        deliveryAmount: delivery,
        inventoryCogs: hasAlloc && isDelivered ? cogs : null,
        inventoryProfit: hasAlloc && isDelivered ? roundMoney(allocRev - cogs) : null,
        hasInventoryAllocation: hasAlloc && isDelivered,
      };
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
