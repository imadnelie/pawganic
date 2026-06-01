import { FINISHED_PRODUCT_TYPES, mealLabel } from "./constants.js";

export const MEAL_TYPE_TO_PRODUCT = {
  chicken_with_rice: "chicken_rice",
  beef_with_rice: "beef_rice",
  fish_with_rice: "fish_rice",
};

export function formatKg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x % 1 === 0 ? String(x) : x.toFixed(3).replace(/\.?0+$/, "");
}

export function emptyProductKgTotals() {
  return { chicken_rice: 0, beef_rice: 0, fish_rice: 0, totalKg: 0 };
}

/** Sum remainingQuantityKg from batch rows by productType. */
export function sumBatchRemainingKg(batches) {
  const totals = emptyProductKgTotals();
  for (const b of batches || []) {
    const pt = String(b.productType || "");
    if (!Object.prototype.hasOwnProperty.call(totals, pt)) continue;
    totals[pt] += Number(b.remainingQuantityKg || 0);
  }
  totals.chicken_rice = roundKg(totals.chicken_rice);
  totals.beef_rice = roundKg(totals.beef_rice);
  totals.fish_rice = roundKg(totals.fish_rice);
  totals.totalKg = roundKg(totals.chicken_rice + totals.beef_rice + totals.fish_rice);
  return totals;
}

/** Sum item quantities from pending orders in the current list (respects filters). */
export function sumPendingOrderKg(orders) {
  const totals = emptyProductKgTotals();
  for (const o of orders || []) {
    if (String(o.status || "") !== "pending") continue;
    for (const it of normalizeOrderItems(o)) {
      const pt = MEAL_TYPE_TO_PRODUCT[String(it.mealType || "")];
      if (!pt) continue;
      totals[pt] += Number(it.quantity || 0);
    }
  }
  totals.chicken_rice = roundKg(totals.chicken_rice);
  totals.beef_rice = roundKg(totals.beef_rice);
  totals.fish_rice = roundKg(totals.fish_rice);
  totals.totalKg = roundKg(totals.chicken_rice + totals.beef_rice + totals.fish_rice);
  return totals;
}

function roundKg(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

/** Line items for display; supports legacy single-meal orders. */
export function normalizeOrderItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length) return items;
  if (order?.mealType) {
    return [
      {
        mealType: order.mealType,
        quantity: Number(order.quantity || 0),
      },
    ];
  }
  return [];
}

export function orderItemBreakdownLines(order) {
  return normalizeOrderItems(order).map((it) => ({
    label: mealLabel(it.mealType),
    qtyKg: Number(it.quantity || 0),
  }));
}

export function orderItemBreakdownTotalKg(order) {
  return orderItemBreakdownLines(order).reduce((s, line) => s + line.qtyKg, 0);
}

export const PRODUCT_KG_LABELS = FINISHED_PRODUCT_TYPES.map((p) => ({
  key: p.value,
  label: p.label,
}));
