import { Router } from "express";
import { Customer, Order, Expense } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);
r.use(requireAdmin);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

r.get("/summary", async (req, res) => {
  try {
    const customers = await Customer.countDocuments();

    const ordersPending = await Order.countDocuments({ status: "pending" });
    const ordersDelivered = await Order.countDocuments({ status: "delivered" });

    const [revAgg] = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $addFields: {
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
          totalRevenue: { $sum: "$totalPrice" },
          revenueToElie: { $sum: { $cond: [{ $eq: ["$receiver", "elie"] }, "$totalPrice", 0] } },
          revenueToJimmy: { $sum: { $cond: [{ $eq: ["$receiver", "jimmy"] }, "$totalPrice", 0] } },
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

    res.json({
      customers,
      ordersPending,
      ordersDelivered,
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
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
