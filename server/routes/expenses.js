import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { isPartner } from "../constants.js";

const r = Router();
r.use(requireAuth);

r.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM expenses ORDER BY date DESC, id DESC").all();
  res.json(
    rows.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      paidBy: e.paid_by,
    }))
  );
});

r.post("/", (req, res) => {
  const { date, description, amount, paidBy } = req.body || {};
  const pBy = String(paidBy || "").toLowerCase();
  const amt = Number(amount);
  if (!date || !description || !Number.isFinite(amt) || amt <= 0 || !isPartner(pBy)) {
    return res.status(400).json({
      error: "date, description, positive amount, and paidBy (elie|jimmy) required",
    });
  }
  const info = db
    .prepare(
      `INSERT INTO expenses (date, description, amount, paid_by) VALUES (?, ?, ?, ?)`
    )
    .run(String(date).trim(), String(description).trim(), amt, pBy);
  const e = db.prepare("SELECT * FROM expenses WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({
    id: e.id,
    date: e.date,
    description: e.description,
    amount: e.amount,
    paidBy: e.paid_by,
  });
});

r.put("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Expense not found" });
  }
  const { date, description, amount, paidBy } = req.body || {};
  const pBy = String(paidBy || "").toLowerCase();
  const amt = Number(amount);
  if (!date || !String(description).trim() || !Number.isFinite(amt) || amt <= 0 || !isPartner(pBy)) {
    return res.status(400).json({
      error: "date, description, positive amount, and paidBy (elie|jimmy) required",
    });
  }
  db.prepare(
    `UPDATE expenses SET date = ?, description = ?, amount = ?, paid_by = ? WHERE id = ?`
  ).run(String(date).trim(), String(description).trim(), amt, pBy, id);
  const e = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  res.json({
    id: e.id,
    date: e.date,
    description: e.description,
    amount: e.amount,
    paidBy: e.paid_by,
  });
});

r.delete("/:id", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid expense id" });
  }
  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Expense not found" });
  }
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  res.status(204).send();
});

export default r;
