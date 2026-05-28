import { Router } from "express";
import { Customer, Order, Expense } from "../db.js";
import { requireAuth, requireAdminOrUser } from "../middleware/auth.js";
import { mealTypeToFinishedProductType } from "../constants.js";
import { FinishedInventoryLot } from "../inventoryModels.js";

const r = Router();
r.use(requireAuth);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10000) / 10000;
}

function roundKg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1000) / 1000;
}

const MEAL_SALES_KG_FIELD = {
  chicken_with_rice: "chickenRiceKg",
  beef_with_rice: "beefRiceKg",
  fish_with_rice: "fishRiceKg",
};

function emptyMealSalesKg() {
  return { chickenRiceKg: 0, beefRiceKg: 0, fishRiceKg: 0, totalKg: 0 };
}

function rowsToMealSalesKg(rows) {
  const out = emptyMealSalesKg();
  for (const row of rows || []) {
    const field = MEAL_SALES_KG_FIELD[String(row._id || "")];
    if (!field) continue;
    out[field] = roundKg(out[field] + num(row.kg));
  }
  out.totalKg = roundKg(out.chickenRiceKg + out.beefRiceKg + out.fishRiceKg);
  return out;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function aggregateDeliveredMealKg(salesDateFrom = null) {
  const pipeline = [
    { $match: { status: "delivered" } },
    {
      $addFields: {
        salesDate: { $ifNull: ["$deliveredAt", "$createdAt"] },
        lineItems: {
          $cond: {
            if: { $gt: [{ $size: { $ifNull: ["$items", []] } }, 0] },
            then: "$items",
            else: [
              {
                mealType: "$mealType",
                quantity: { $ifNull: ["$quantity", 0] },
              },
            ],
          },
        },
      },
    },
  ];
  if (salesDateFrom) {
    pipeline.push({ $match: { salesDate: { $gte: salesDateFrom } } });
  }
  pipeline.push(
    { $unwind: "$lineItems" },
    {
      $group: {
        _id: "$lineItems.mealType",
        kg: { $sum: { $ifNull: ["$lineItems.quantity", 0] } },
      },
    }
  );
  return Order.aggregate(pipeline);
}

r.get("/meal-sales-quantity", requireAdminOrUser, async (req, res) => {
  try {
    const monthStart = startOfCurrentMonth();
    const [allTimeRows, monthRows] = await Promise.all([
      aggregateDeliveredMealKg(),
      aggregateDeliveredMealKg(monthStart),
    ]);
    res.json({
      allTime: rowsToMealSalesKg(allTimeRows),
      thisMonth: rowsToMealSalesKg(monthRows),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/summary", requireAdminOrUser, async (req, res) => {
  try {
    const customers = await Customer.countDocuments();

    const ordersPending = await Order.countDocuments({ status: "pending" });
    const ordersDelivered = await Order.countDocuments({ status: "delivered" });
    const ordersCancelled = await Order.countDocuments({ status: "cancelled" });

    const [revAgg] = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $addFields: {
          businessRevenue: {
            $ifNull: [
              "$businessSubtotal",
              { $subtract: [{ $ifNull: ["$totalPrice", 0] }, { $ifNull: ["$deliveryAmount", 0] }] },
            ],
          },
          receiver: {
            $toLower: {
              $trim: {
                input: { $ifNull: ["$paidTo", { $ifNull: ["$deliveredBy", ""] }] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$businessRevenue" },
          revenueToElie: { $sum: { $cond: [{ $eq: ["$receiver", "elie"] }, "$businessRevenue", 0] } },
          revenueToJimmy: { $sum: { $cond: [{ $eq: ["$receiver", "jimmy"] }, "$businessRevenue", 0] } },
        },
      },
    ]);

    const [expAgg] = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" },
          expensesPaidByElie: {
            $sum: {
              $cond: [{ $eq: [{ $toLower: { $trim: { input: "$paid_by" } } }, "elie"] }, "$amount", 0],
            },
          },
          expensesPaidByJimmy: {
            $sum: {
              $cond: [{ $eq: [{ $toLower: { $trim: { input: "$paid_by" } } }, "jimmy"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const totalRevenue = num(revAgg?.totalRevenue);
    const revenueToElie = num(revAgg?.revenueToElie);
    const revenueToJimmy = num(revAgg?.revenueToJimmy);
    const totalExpenses = num(expAgg?.totalExpenses);
    const expensesPaidByElie = num(expAgg?.expensesPaidByElie);
    const expensesPaidByJimmy = num(expAgg?.expensesPaidByJimmy);

    const byMealRows = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.mealType",
          cnt: { $sum: 1 },
          rev: { $sum: "$items.subtotal" },
        },
      },
    ]);

    const revenueByMeal = byMealRows.map((row) => ({
      mealType: row._id,
      count: row.cnt,
      revenue: num(row.rev),
    }));

    const elieNetPosition = revenueToElie - expensesPaidByElie;
    const jimmyNetPosition = revenueToJimmy - expensesPaidByJimmy;

    const pendingDemandRows = await Order.aggregate([
      { $match: { status: "pending" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.mealType",
          pendingKg: { $sum: "$items.quantity" },
        },
      },
    ]);

    const finishedStockRows = await FinishedInventoryLot.aggregate([
      { $match: { remainingQuantityKg: { $gt: 1e-6 } } },
      {
        $group: {
          _id: "$productType",
          availableKg: { $sum: "$remainingQuantityKg" },
        },
      },
    ]);

    const availableByProduct = new Map(
      finishedStockRows.map((r) => [String(r._id), num(r.availableKg)])
    );
    const demandByProduct = new Map();
    for (const row of pendingDemandRows) {
      const pt = mealTypeToFinishedProductType(row._id);
      if (!pt) continue;
      demandByProduct.set(pt, roundMoney(num(demandByProduct.get(pt)) + num(row.pendingKg)));
    }

    const productKeys = new Set([...availableByProduct.keys(), ...demandByProduct.keys()]);
    const productionDemand = [...productKeys].map((productType) => {
      const pendingKg = num(demandByProduct.get(productType));
      const availableKg = num(availableByProduct.get(productType));
      const shortfallKg = roundMoney(Math.max(0, pendingKg - availableKg));
      return { productType, pendingKg, availableKg, shortfallKg };
    });
    productionDemand.sort((a, b) => b.shortfallKg - a.shortfallKg || a.productType.localeCompare(b.productType));

    res.json({
      customers,
      ordersPending,
      ordersDelivered,
      ordersCancelled,
      totalRevenue,
      revenueToElie,
      revenueToJimmy,
      totalExpenses,
      expensesPaidByElie,
      expensesPaidByJimmy,
      elieNetPosition,
      jimmyNetPosition,
      netProfit: totalRevenue - totalExpenses,
      revenueByMeal,
      productionDemand,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
