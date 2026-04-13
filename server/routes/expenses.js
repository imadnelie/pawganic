import { Router } from "express";
import mongoose from "mongoose";
import { Expense } from "../db.js";
import { requireAuth, requireAdmin, requireAdminOrUser } from "../middleware/auth.js";
import { isPartner } from "../constants.js";

const r = Router();
r.use(requireAuth);

function toExpenseJson(e) {
  return {
    id: String(e._id),
    date: e.date,
    description: e.description,
    amount: e.amount,
    paidBy: e.paid_by,
  };
}

r.get("/", requireAdminOrUser, async (req, res) => {
  try {
    const rows = await Expense.find().sort({ date: -1, _id: -1 }).lean();
    res.json(rows.map(toExpenseJson));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/", requireAdminOrUser, async (req, res) => {
  try {
    const { date, description, amount, paidBy } = req.body || {};
    const pBy = String(paidBy || "").toLowerCase();
    const amt = Number(amount);
    if (!date || !description || !Number.isFinite(amt) || amt <= 0 || !isPartner(pBy)) {
      return res.status(400).json({
        error: "date, description, positive amount, and paidBy (elie|jimmy) required",
      });
    }
    const doc = await Expense.create({
      date: String(date).trim(),
      description: String(description).trim(),
      amount: amt,
      paid_by: pBy,
    });
    res.status(201).json(toExpenseJson(doc.toObject()));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Expense not found" });
    }
    const existing = await Expense.findById(id).lean();
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
    await Expense.findByIdAndUpdate(id, {
      date: String(date).trim(),
      description: String(description).trim(),
      amount: amt,
      paid_by: pBy,
    });
    const e = await Expense.findById(id).lean();
    res.json(toExpenseJson(e));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid expense id" });
    }
    const existing = await Expense.findByIdAndDelete(id);
    if (!existing) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
