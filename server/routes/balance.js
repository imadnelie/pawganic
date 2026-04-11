import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function sumPluck(sql, params = []) {
  return num(db.prepare(sql).pluck().get(...params));
}

/** Revenue only from delivered orders. Settlement: each partner's fair net = netProfit/2 vs (received - expenses paid). */
r.get("/", (req, res) => {
  const receiver = `LOWER(TRIM(COALESCE(paid_to, delivered_by)))`;

  const totalRevenue = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered'`
  );
  const totalExpenses = sumPluck(`SELECT COALESCE(SUM(amount), 0) FROM expenses`);

  const elieReceived = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered' AND ${receiver} = 'elie'`
  );
  const jimmyReceived = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered' AND ${receiver} = 'jimmy'`
  );

  const expensesPaidByElie = sumPluck(
    `SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE LOWER(TRIM(paid_by)) = 'elie'`
  );
  const expensesPaidByJimmy = sumPluck(
    `SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE LOWER(TRIM(paid_by)) = 'jimmy'`
  );

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
});

export default r;
