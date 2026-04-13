import { Router } from "express";
import { Order, Expense } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);
r.use(requireAdmin);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Revenue only from delivered orders. Settlement: each partner's fair net = netProfit/2 vs (received - expenses paid). */
r.get("/", async (req, res) => {
  try {
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
          elieReceived: { $sum: { $cond: [{ $eq: ["$receiver", "elie"] }, "$totalPrice", 0] } },
          jimmyReceived: { $sum: { $cond: [{ $eq: ["$receiver", "jimmy"] }, "$totalPrice", 0] } },
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
    const elieReceived = num(revAgg?.elieReceived);
    const jimmyReceived = num(revAgg?.jimmyReceived);
    const totalExpenses = num(expAgg?.totalExpenses);
    const expensesPaidByElie = num(expAgg?.expensesPaidByElie);
    const expensesPaidByJimmy = num(expAgg?.expensesPaidByJimmy);

    const netProfit = totalRevenue - totalExpenses;
    const elieShare = netProfit / 2;
    const jimmyShare = netProfit / 2;

    const elieNetPosition = elieReceived - expensesPaidByElie;
    const jimmyNetPosition = jimmyReceived - expensesPaidByJimmy;

    const elieVersusFair = elieNetPosition - elieShare;
    const jimmyVersusFair = jimmyNetPosition - jimmyShare;

    let settlement = null;
    if (Math.abs(elieVersusFair) < 0.005 && Math.abs(jimmyVersusFair) < 0.005) {
      settlement = { balanced: true, message: "Partners are balanced (within rounding)." };
    } else if (elieVersusFair > 0) {
      settlement = {
        balanced: false,
        owesFrom: "elie",
        owesTo: "jimmy",
        amount: Math.round(elieVersusFair * 100) / 100,
        message: `Elie owes Jimmy $${elieVersusFair.toFixed(2)} (Elie is ahead of his share).`,
      };
    } else {
      const owe = Math.abs(elieVersusFair);
      settlement = {
        balanced: false,
        owesFrom: "jimmy",
        owesTo: "elie",
        amount: Math.round(owe * 100) / 100,
        message: `Jimmy owes Elie $${owe.toFixed(2)} (Elie is behind his share).`,
      };
    }

    res.json({
      totalRevenue,
      revenueToElie: elieReceived,
      revenueToJimmy: jimmyReceived,
      totalExpenses,
      expensesPaidByElie,
      expensesPaidByJimmy,
      netProfit,
      elieShare,
      jimmyShare,
      elieReceivedFromOrders: elieReceived,
      jimmyReceivedFromOrders: jimmyReceived,
      elieNetAfterExpenses: elieNetPosition,
      jimmyNetAfterExpenses: jimmyNetPosition,
      settlement,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
