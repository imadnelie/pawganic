import mongoose from "mongoose";
import {
  PurchaseLine,
  ProductionBatch,
  FinishedInventoryLot,
  OrderBatchAllocation,
  INVENTORY_MODEL_CONSTANTS,
} from "../inventoryModels.js";
import { mealTypeToFinishedProductType } from "../constants.js";

const EPS = 1e-6;

export function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10000) / 10000;
}

function computeBatchStatus({ remainingQuantityKg, soldQuantityKg }) {
  const rem = Number(remainingQuantityKg) || 0;
  const sold = Number(soldQuantityKg) || 0;
  if (rem <= EPS) return "sold_out";
  if (sold > EPS) return "partially_sold";
  return "available";
}

function saveOpts(session) {
  return session ? { session } : {};
}

/**
 * Consume ingredient stock using FIFO (oldest purchase lines first).
 */
export async function consumeIngredientFifo(session, inventoryItemId, quantityNeeded) {
  const need = Number(quantityNeeded);
  if (!Number.isFinite(need) || need <= 0) {
    throw new Error("Ingredient quantity must be greater than 0");
  }
  let remainingToTake = need;
  let allocatedCost = 0;
  const lots = [];

  let q = PurchaseLine.find({
    inventoryItemId,
    quantityRemaining: { $gt: EPS },
  }).sort({ createdAt: 1, _id: 1 });
  if (session) q = q.session(session);
  const lines = await q.exec();

  for (const line of lines) {
    if (remainingToTake <= EPS) break;
    const available = Number(line.quantityRemaining) || 0;
    if (available <= EPS) continue;
    const take = Math.min(available, remainingToTake);
    const unitCost = Number(line.unitCost) || 0;
    const cost = roundMoney(take * unitCost);
    allocatedCost = roundMoney(allocatedCost + cost);
    line.quantityRemaining = roundMoney(available - take);
    await line.save(saveOpts(session));
    lots.push({
      purchaseLineId: line._id,
      quantity: take,
      unitCost,
      cost,
    });
    remainingToTake = roundMoney(remainingToTake - take);
  }

  if (remainingToTake > EPS) {
    throw new Error("Insufficient ingredient inventory for this item");
  }

  return { allocatedCost, lots };
}

export async function restoreIngredientLots(session, lots) {
  if (!Array.isArray(lots) || !lots.length) return;
  for (const lot of lots) {
    const id = lot.purchaseLineId;
    if (!mongoose.isValidObjectId(String(id))) continue;
    let q = PurchaseLine.findById(id);
    if (session) q = q.session(session);
    const line = await q;
    if (!line) continue;
    line.quantityRemaining = roundMoney(Number(line.quantityRemaining || 0) + Number(lot.quantity || 0));
    await line.save(saveOpts(session));
  }
}

/**
 * Consume finished goods (FIFO by finished lot creation time).
 * Returns allocation payloads (not inserted) for OrderBatchAllocation.insertMany.
 */
export async function consumeFinishedFifo(session, { productType, quantityKg, pricePerUnit, orderId, orderItemId }) {
  const need = Number(quantityKg);
  if (!Number.isFinite(need) || need <= EPS) {
    throw new Error("Order item quantity (kg) must be greater than 0");
  }
  const ppu = Number(pricePerUnit);
  if (!Number.isFinite(ppu) || ppu < 0) {
    throw new Error("Invalid price per unit");
  }

  let remaining = need;
  const allocationDocs = [];

  let q = FinishedInventoryLot.find({
    productType,
    remainingQuantityKg: { $gt: EPS },
  }).sort({ createdAt: 1, _id: 1 });
  if (session) q = q.session(session);
  const lots = await q.exec();

  for (const lot of lots) {
    if (remaining <= EPS) break;
    const available = Number(lot.remainingQuantityKg) || 0;
    if (available <= EPS) continue;

    const take = Math.min(available, remaining);
    const costPerKg = Number(lot.costPerKg) || 0;
    const allocatedCost = roundMoney(take * costPerKg);
    const revenueAllocated = roundMoney(take * ppu);

    lot.remainingQuantityKg = roundMoney(available - take);
    await lot.save(saveOpts(session));

    let bq = ProductionBatch.findById(lot.batchId);
    if (session) bq = bq.session(session);
    const batch = await bq;
    if (batch) {
      batch.soldQuantityKg = roundMoney(Number(batch.soldQuantityKg || 0) + take);
      batch.remainingQuantityKg = roundMoney(Number(batch.remainingQuantityKg || 0) - take);
      batch.status = computeBatchStatus(batch);
      await batch.save(saveOpts(session));
    }

    allocationDocs.push({
      orderId,
      orderItemId,
      batchId: lot.batchId,
      finishedLotId: lot._id,
      productType,
      quantityKg: take,
      costPerKg,
      allocatedCost,
      revenueAllocated,
    });

    remaining = roundMoney(remaining - take);
  }

  if (remaining > EPS) {
    throw new Error(
      `Insufficient finished inventory for ${productType.replace(/_/g, " ")} (need ${need} kg, short ${remaining} kg)`
    );
  }

  return allocationDocs;
}

export const FINISHED_INVENTORY_ORDER_ERROR = "Not enough finished inventory available for this order.";

function mapFinishedInventoryError(err) {
  const msg = String(err?.message || "");
  if (msg.includes("Insufficient finished inventory")) {
    return new Error(FINISHED_INVENTORY_ORDER_ERROR);
  }
  return err;
}

export async function orderHasAllocations(session, orderId) {
  let q = OrderBatchAllocation.countDocuments({ orderId });
  if (session) q = q.session(session);
  return (await q) > 0;
}

/**
 * FIFO allocate finished goods for an order. Skips if allocations already exist (legacy orders).
 * Persists OrderBatchAllocation rows.
 */
export async function allocateOrderInventory(session, orderDoc) {
  const orderId = orderDoc._id;
  if (await orderHasAllocations(session, orderId)) {
    return [];
  }
  const items = orderDoc.items || [];
  if (!items.length) {
    throw new Error("Order has no items");
  }

  const allocationDocs = [];
  try {
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const pt = mealTypeToFinishedProductType(it.mealType);
      if (!pt) {
        throw new Error("Unsupported meal type for inventory routing");
      }
      const docs = await consumeFinishedFifo(session, {
        productType: pt,
        quantityKg: it.quantity,
        pricePerUnit: it.pricePerUnit,
        orderId,
        orderItemId: it._id,
      });
      allocationDocs.push(...docs);
    }
    if (allocationDocs.length) {
      await OrderBatchAllocation.insertMany(allocationDocs, session ? { session } : {});
    }
  } catch (e) {
    if (allocationDocs.length) {
      await reverseFinishedAllocations(session, allocationDocs);
    }
    throw mapFinishedInventoryError(e);
  }
  return allocationDocs;
}

/**
 * Undo an in-memory list of finished allocations (same shape as consumeFinishedFifo output) before they are persisted.
 * Used to roll back if order creation fails mid-way.
 */
export async function reverseFinishedAllocations(session, allocationDocs) {
  if (!Array.isArray(allocationDocs) || !allocationDocs.length) return;
  for (const a of [...allocationDocs].reverse()) {
    let lq = FinishedInventoryLot.findById(a.finishedLotId);
    if (session) lq = lq.session(session);
    const lot = await lq;
    if (lot) {
      lot.remainingQuantityKg = roundMoney(Number(lot.remainingQuantityKg || 0) + Number(a.quantityKg || 0));
      await lot.save(saveOpts(session));
    }
    let bq = ProductionBatch.findById(a.batchId);
    if (session) bq = bq.session(session);
    const batch = await bq;
    if (batch) {
      batch.soldQuantityKg = roundMoney(Number(batch.soldQuantityKg || 0) - Number(a.quantityKg || 0));
      batch.remainingQuantityKg = roundMoney(Number(batch.remainingQuantityKg || 0) + Number(a.quantityKg || 0));
      batch.status = computeBatchStatus(batch);
      await batch.save(saveOpts(session));
    }
  }
}

export async function reverseOrderAllocationsForOrder(session, orderId) {
  let q = OrderBatchAllocation.find({ orderId });
  if (session) q = q.session(session);
  const list = await q.lean();
  for (const a of list) {
    let lq = FinishedInventoryLot.findById(a.finishedLotId);
    if (session) lq = lq.session(session);
    const lot = await lq;
    if (lot) {
      lot.remainingQuantityKg = roundMoney(Number(lot.remainingQuantityKg || 0) + Number(a.quantityKg || 0));
      await lot.save(saveOpts(session));
    }
    let bq = ProductionBatch.findById(a.batchId);
    if (session) bq = bq.session(session);
    const batch = await bq;
    if (batch) {
      batch.soldQuantityKg = roundMoney(Number(batch.soldQuantityKg || 0) - Number(a.quantityKg || 0));
      batch.remainingQuantityKg = roundMoney(Number(batch.remainingQuantityKg || 0) + Number(a.quantityKg || 0));
      batch.status = computeBatchStatus(batch);
      await batch.save(saveOpts(session));
    }
  }
  let dq = OrderBatchAllocation.deleteMany({ orderId });
  if (session) dq = dq.session(session);
  await dq;
}

export async function generateBatchCode(session) {
  const prefix = `PG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const filter = { batchCode: new RegExp(`^${prefix}`) };
  const count = session
    ? await ProductionBatch.countDocuments(filter).session(session)
    : await ProductionBatch.countDocuments(filter);
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export function validateBatchProductType(pt) {
  return INVENTORY_MODEL_CONSTANTS.FINISHED_PRODUCT_TYPES.includes(pt);
}
