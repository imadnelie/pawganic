import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Single aggregate via .pluck().get() — avoids SQLite/driver column-name mismatches on .get(). */
function sumPluck(sql, params = []) {
  return num(db.prepare(sql).pluck().get(...params));
}

r.get("/summary", (req, res) => {
  const customers = sumPluck(`SELECT COUNT(*) FROM customers`);
  const ordersPending = sumPluck(`SELECT COUNT(*) FROM orders WHERE LOWER(TRIM(status)) = 'pending'`);
  const ordersDelivered = sumPluck(`SELECT COUNT(*) FROM orders WHERE LOWER(TRIM(status)) = 'delivered'`);

  const totalRevenue = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered'`
  );

  const receiver = `LOWER(TRIM(COALESCE(paid_to, delivered_by)))`;
  const revenueToElie = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered' AND ${receiver} = 'elie'`
  );
  const revenueToJimmy = sumPluck(
    `SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE LOWER(TRIM(status)) = 'delivered' AND ${receiver} = 'jimmy'`
  );

  const totalExpenses = sumPluck(`SELECT COALESCE(SUM(amount), 0) FROM expenses`);
  const expensesPaidByElie = sumPluck(
    `SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE LOWER(TRIM(paid_by)) = 'elie'`
  );
  const expensesPaidByJimmy = sumPluck(
    `SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE LOWER(TRIM(paid_by)) = 'jimmy'`
  );

  const byMealRows = db
    .prepare(
      `SELECT oi.meal_type, COUNT(*) AS cnt, COALESCE(SUM(oi.subtotal), 0) AS rev
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE LOWER(TRIM(o.status)) = 'delivered'
       GROUP BY oi.meal_type`
    )
    .all();
  const revenueByMeal = byMealRows.map((row) => ({
    mealType: row.meal_type,
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
});

export default r;
