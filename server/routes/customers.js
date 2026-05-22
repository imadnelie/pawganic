import { Router } from "express";
import mongoose from "mongoose";
import { Customer, Order } from "../db.js";
import { requireAuth, requireAdmin, requireAdminOrUser } from "../middleware/auth.js";
import {
  optionalString,
  extractCoordsFromMapsLink,
  resolveCustomerCoords,
} from "../utils/mapsLink.js";

const r = Router();
r.use(requireAuth);

function toCustomerRow(c) {
  return {
    id: String(c._id),
    first_name: c.first_name,
    last_name: c.last_name,
    mobile: c.mobile,
    city: c.city ?? null,
    maps_link: c.maps_link ?? null,
    lat: c.lat,
    lng: c.lng,
    created_at:
      c.created_at instanceof Date
        ? c.created_at.toISOString()
        : c.created_at,
    order_count: c.order_count ?? 0,
  };
}

r.get("/", requireAdminOrUser, async (req, res) => {
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

r.get("/:id", requireAdminOrUser, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const row = await Customer.findById(id).lean();
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(toCustomerRow(row));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/", requireAdminOrUser, async (req, res) => {
  try {
    const { firstName, lastName, mobile, city, maps_link, lat, lng } = req.body || {};
    if (!firstName || !lastName || !mobile) {
      return res.status(400).json({ error: "firstName, lastName, and mobile are required" });
    }
    const mapsLinkStr = optionalString(maps_link);
    const { lat: latN, lng: lngN } = resolveCustomerCoords({ lat, lng, maps_link: mapsLinkStr });
    const created = await Customer.create({
      first_name: String(firstName).trim(),
      last_name: String(lastName).trim(),
      mobile: String(mobile).trim(),
      city: optionalString(city),
      maps_link: mapsLinkStr,
      lat: latN,
      lng: lngN,
    });
    res.status(201).json(toCustomerRow(created.toObject()));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.patch("/:id", requireAdminOrUser, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const existing = await Customer.findById(id).lean();
    if (!existing) return res.status(404).json({ error: "Customer not found" });
    const { firstName, lastName, mobile, city, maps_link, lat, lng } = req.body || {};

    const update = {
      first_name: firstName != null ? String(firstName).trim() : existing.first_name,
      last_name: lastName != null ? String(lastName).trim() : existing.last_name,
      mobile: mobile != null ? String(mobile).trim() : existing.mobile,
    };

    if (city !== undefined) {
      update.city = optionalString(city);
    }

    if (maps_link !== undefined) {
      update.maps_link = optionalString(maps_link);
    }

    const latProvided = lat !== undefined;
    const lngProvided = lng !== undefined;
    if (latProvided || lngProvided) {
      update.lat =
        lat === "" || lat == null
          ? null
          : Number.isFinite(Number(lat))
            ? Number(lat)
            : existing.lat;
      update.lng =
        lng === "" || lng == null
          ? null
          : Number.isFinite(Number(lng))
            ? Number(lng)
            : existing.lng;
    } else if (maps_link !== undefined && update.maps_link) {
      const extracted = extractCoordsFromMapsLink(update.maps_link);
      if (extracted) {
        update.lat = extracted.lat;
        update.lng = extracted.lng;
      }
    }

    await Customer.findByIdAndUpdate(id, update);
    const row = await Customer.findById(id).lean();
    res.json(toCustomerRow(row));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.delete("/:id", requireAdmin, async (req, res) => {
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
