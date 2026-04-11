import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { isMealType, isPartner } from "../constants.js";

const r = Router();
r.use(requireAuth);

function rowToOrder(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    mealType: row.meal_type,
    quantity: row.quantity,
    totalPrice: row.total_price,
    status: row.status,
    createdBy: row.created_by,
    deliveredBy: row.delivered_by,
    paidTo: row.paid_to,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
  };
}

function parseItems(itemsInput) {
  if (!Array.isArray(itemsInput) || itemsInput.length < 1) return { error: "At least one item is required" };
  const items = [];
  for (const it of itemsInput) {
    const mealType = String(it?.mealType || "");
    const quantity = Number(it?.quantity);
    const pricePerUnit = Number(it?.pricePerUnit);
    if (!isMealType(mealType)) return { error: "Invalid meal type in items" };
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Item quantity must be greater than 0" };
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) return { error: "Item price_per_unit must be >= 0" };
    const subtotal = quantity * pricePerUnit;
    items.push({ mealType, quantity, pricePerUnit, subtotal });
  }
  return { items };
}

function getItemsForOrderIds(orderIds) {
  if (!orderIds.length) return new Map();
  const placeholders = orderIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, order_id, meal_type, quantity, price_per_unit, subtotal
       FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`
    )
    .all(...orderIds);
  const map = new Map();
  for (const r of rows) {
    const list = map.get(r.order_id) || [];
    list.push({
      id: r.id,
      mealType: r.meal_type,
      quantity: r.quantity,
      pricePerUnit: r.price_per_unit,
      subtotal: r.subtotal,
    });
    map.set(r.order_id, list);
  }
  return map;
}

function withItems(rows) {
  const ids = rows.map((r) => r.id);
  const itemsMap = getItemsForOrderIds(ids);
  return rows.map((row) => {
    const base = rowToOrder(row);
    let items = itemsMap.get(row.id) || [];
    if (!items.length) {
      const qty = Number(row.quantity) > 0 ? Number(row.quantity) : 1;
      const subtotal = Number(row.total_price) || 0;
      items = [
        {
          id: null,
          mealType: row.meal_type,
          quantity: qty,
          pricePerUnit: qty > 0 ? subtotal / qty : subtotal,
          subtotal,
        },
      ];
    }
    return { ...base, items };
  });
}

r.get("/", (req, res) => {
  const { status, createdBy } = req.query;
  let sql = `SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
    FROM orders o JOIN customers c ON c.id = o.customer_id WHERE 1=1`;
  const params = [];
  if (status === "pending" || status === "delivered") {
    sql += " AND o.status = ?";
    params.push(status);
  }
  if (createdBy && isPartner(String(createdBy).toLowerCase())) {
    sql += " AND o.created_by = ?";
    params.push(String(createdBy).toLowerCase());
  }
  sql += " ORDER BY o.created_at DESC";
  const rows = db.prepare(sql).all(...params);
  res.json(withItems(rows));
});

r.get("/customer/:customerId", (req, res) => {
  const customerId = Number(req.params.customerId);
  const rows = db
    .prepare(
      `SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.customer_id = ? ORDER BY o.created_at DESC`
    )
    .all(customerId);
  res.json(withItems(rows));
});

r.post("/", (req, res) => {
  const { customerId, items: itemsInput } = req.body || {};
  const parsed = parseItems(itemsInput);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const items = parsed.items;
  const totalPrice = items.reduce((s, i) => s + i.subtotal, 0);
  const cust = db.prepare("SELECT id FROM customers WHERE id = ?").get(Number(customerId));
  if (!cust) return res.status(400).json({ error: "Customer not found" });
  const username = req.user.username.toLowerCase();
  if (!isPartner(username)) {
    return res.status(400).json({ error: "Invalid session user for created_by" });
  }
  const first = items[0];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_id, meal_type, quantity, total_price, status, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, meal_type, quantity, price_per_unit, subtotal)
     VALUES (?, ?, ?, ?, ?)`
  );
  const info = db.transaction(() => {
    const orderInfo = insertOrder.run(Number(customerId), first.mealType, totalQty, totalPrice, username);
    const orderId = Number(orderInfo.lastInsertRowid);
    for (const it of items) {
      insertItem.run(orderId, it.mealType, it.quantity, it.pricePerUnit, it.subtotal);
    }
    return orderInfo;
  })();
  const row = db
    .prepare(
      `SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(withItems([row])[0]);
});

r.post("/:id/deliver", (req, res) => {
  const id = Number(req.params.id);
  const { paidTo, deliveredDate } = req.body || {};
  const pTo = String(paidTo || "").toLowerCase();
  if (!isPartner(pTo)) {
    return res.status(400).json({ error: "paidTo must be elie or jimmy" });
  }
  const dateText = String(deliveredDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return res.status(400).json({ error: "deliveredDate is required (YYYY-MM-DD)" });
  }
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status === "delivered") {
    return res.status(400).json({ error: "Order already delivered" });
  }
  // Save a stable ISO timestamp based on the selected date.
  const deliveredAt = new Date(`${dateText}T12:00:00.000Z`).toISOString();
  db.prepare(
    `UPDATE orders SET status = 'delivered', delivered_by = ?, paid_to = ?, delivered_at = ?
     WHERE id = ?`
  ).run(null, pTo, deliveredAt, id);
  const row = db
    .prepare(
      `SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`
    )
    .get(id);
  res.json(withItems([row])[0]);
});

r.put("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { customerId, items: itemsInput, status, paidTo, deliveredDate } =
    req.body || {};
  const cid = Number(customerId);
  const parsed = parseItems(itemsInput);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const items = parsed.items;
  const totalPrice = items.reduce((s, i) => s + i.subtotal, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const first = items[0];
  const s = String(status || "").toLowerCase();
  if (
    !Number.isFinite(cid) ||
    !["pending", "delivered"].includes(s)
  ) {
    return res.status(400).json({ error: "Invalid order data" });
  }
  const cust = db.prepare("SELECT id FROM customers WHERE id = ?").get(cid);
  if (!cust) return res.status(400).json({ error: "Customer not found" });

  let pTo = null;
  let deliveredAt = null;
  if (s === "delivered") {
    pTo = String(paidTo || "").toLowerCase();
    const dateText = String(deliveredDate || "").trim();
    if (!isPartner(pTo) || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      return res
        .status(400)
        .json({ error: "Delivered orders require paidTo and deliveredDate" });
    }
    deliveredAt = new Date(`${dateText}T12:00:00.000Z`).toISOString();
  }

  const updateOrder = db.prepare(
    `UPDATE orders SET
      customer_id = ?, meal_type = ?, quantity = ?, total_price = ?, status = ?,
      delivered_by = ?, paid_to = ?, delivered_at = ?
     WHERE id = ?`
  );
  const deleteItems = db.prepare("DELETE FROM order_items WHERE order_id = ?");
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, meal_type, quantity, price_per_unit, subtotal)
     VALUES (?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    updateOrder.run(cid, first.mealType, totalQty, totalPrice, s, null, pTo, deliveredAt, id);
    deleteItems.run(id);
    for (const it of items) {
      insertItem.run(id, it.mealType, it.quantity, it.pricePerUnit, it.subtotal);
    }
  })();

  const row = db
    .prepare(
      `SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`
    )
    .get(id);
  return res.json(withItems([row])[0]);
});

r.delete("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid order id" });
  }
  const existing = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Order not found" });
  db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  return res.status(204).send();
});

export default r;
