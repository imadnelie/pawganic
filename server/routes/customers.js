import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);

r.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
       FROM customers c ORDER BY c.created_at DESC`
    )
    .all();
  res.json(rows);
});

r.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Customer not found" });
  res.json(row);
});

r.post("/", (req, res) => {
  const { firstName, lastName, mobile, lat, lng } = req.body || {};
  if (!firstName || !lastName || !mobile) {
    return res.status(400).json({ error: "firstName, lastName, and mobile are required" });
  }
  const latN = lat != null && lat !== "" ? Number(lat) : null;
  const lngN = lng != null && lng !== "" ? Number(lng) : null;
  const info = db
    .prepare(
      `INSERT INTO customers (first_name, last_name, mobile, lat, lng)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(String(firstName).trim(), String(lastName).trim(), String(mobile).trim(), latN, lngN);
  const created = db.prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(created);
});

r.patch("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  const { firstName, lastName, mobile, lat, lng } = req.body || {};
  db.prepare(
    `UPDATE customers SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      mobile = COALESCE(?, mobile),
      lat = ?,
      lng = ?
     WHERE id = ?`
  ).run(
    firstName != null ? String(firstName).trim() : existing.first_name,
    lastName != null ? String(lastName).trim() : existing.last_name,
    mobile != null ? String(mobile).trim() : existing.mobile,
    lat !== undefined ? (lat === "" || lat == null ? null : Number(lat)) : existing.lat,
    lng !== undefined ? (lng === "" || lng == null ? null : Number(lng)) : existing.lng,
    id
  );
  res.json(db.prepare("SELECT * FROM customers WHERE id = ?").get(id));
});

r.delete("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid customer id" });
  }
  const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  const hasOrders = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?")
    .get(id).n;
  if (hasOrders > 0) {
    return res.status(400).json({ error: "Cannot delete customer with existing orders" });
  }
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return res.status(204).send();
});

export default r;
