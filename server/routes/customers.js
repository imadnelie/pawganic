import { Router } from "express";
import mongoose from "mongoose";
import { Customer, Order } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth);

function toCustomerRow(c) {
  return {
    id: String(c._id),
    first_name: c.first_name,
    last_name: c.last_name,
    mobile: c.mobile,
    lat: c.lat,
    lng: c.lng,
    created_at:
      c.created_at instanceof Date
        ? c.created_at.toISOString()
        : c.created_at,
    order_count: c.order_count ?? 0,
  };
}

r.get("/", async (req, res) => {
  try {
    const rows = await Customer.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "customerId",
          as: "ord",
        },
      },
      { $addFields: { order_count: { $size: "$ord" } } },
      { $project: { ord: 0 } },
      { $sort: { created_at: -1 } },
    ]);
    res.json(rows.map(toCustomerRow));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const row = await Customer.findById(id).lean();
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json({
      id: String(row._id),
      first_name: row.first_name,
      last_name: row.last_name,
      mobile: row.mobile,
      lat: row.lat,
      lng: row.lng,
      created_at:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/", async (req, res) => {
  try {
    const { firstName, lastName, mobile, lat, lng } = req.body || {};
    if (!firstName || !lastName || !mobile) {
      return res.status(400).json({ error: "firstName, lastName, and mobile are required" });
    }
    const latN = lat != null && lat !== "" ? Number(lat) : null;
    const lngN = lng != null && lng !== "" ? Number(lng) : null;
    const created = await Customer.create({
      first_name: String(firstName).trim(),
      last_name: String(lastName).trim(),
      mobile: String(mobile).trim(),
      lat: Number.isFinite(latN) ? latN : null,
      lng: Number.isFinite(lngN) ? lngN : null,
    });
    const row = created.toObject();
    res.status(201).json({
      id: String(row._id),
      first_name: row.first_name,
      last_name: row.last_name,
      mobile: row.mobile,
      lat: row.lat,
      lng: row.lng,
      created_at:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.patch("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const existing = await Customer.findById(id).lean();
    if (!existing) return res.status(404).json({ error: "Customer not found" });
    const { firstName, lastName, mobile, lat, lng } = req.body || {};
    const update = {
      first_name: firstName != null ? String(firstName).trim() : existing.first_name,
      last_name: lastName != null ? String(lastName).trim() : existing.last_name,
      mobile: mobile != null ? String(mobile).trim() : existing.mobile,
      lat:
        lat !== undefined
          ? lat === "" || lat == null
            ? null
            : Number(lat)
          : existing.lat,
      lng:
        lng !== undefined
          ? lng === "" || lng == null
            ? null
            : Number(lng)
          : existing.lng,
    };
    await Customer.findByIdAndUpdate(id, update);
    const row = await Customer.findById(id).lean();
    res.json({
      id: String(row._id),
      first_name: row.first_name,
      last_name: row.last_name,
      mobile: row.mobile,
      lat: row.lat,
      lng: row.lng,
      created_at:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid customer id" });
    }
    const existing = await Customer.findById(id).select("_id").lean();
    if (!existing) return res.status(404).json({ error: "Customer not found" });
    const hasOrders = await Order.countDocuments({ customerId: existing._id });
    if (hasOrders > 0) {
      return res.status(400).json({ error: "Cannot delete customer with existing orders" });
    }
    await Customer.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
