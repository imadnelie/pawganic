import { Router } from "express";
import mongoose from "mongoose";
import { Order, Customer } from "../db.js";
import { requireAuth, requireAdmin, requireAdminOrUser } from "../middleware/auth.js";
import { isMealType, isPartner } from "../constants.js";

const r = Router();
r.use(requireAuth);

function docToOrder(doc) {
  const pop = doc.customerId && typeof doc.customerId === "object" && doc.customerId.first_name != null;
  const c = pop ? doc.customerId : null;
  const cid = c ? c._id : doc.customerId;
  return {
    id: String(doc._id),
    customerId: String(cid),
    customerFirstName: c?.first_name ?? "",
    customerLastName: c?.last_name ?? "",
    customerMobile: c?.mobile ?? "",
    mealType: doc.mealType,
    quantity: doc.quantity,
    businessSubtotal: Number(doc.businessSubtotal ?? doc.totalPrice ?? 0),
    deliveryAmount: Number(doc.deliveryAmount ?? 0),
    totalPrice: doc.totalPrice,
    status: doc.status,
    createdBy: doc.createdBy,
    deliveredBy: doc.deliveredBy,
    paidTo: doc.paidTo,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    deliveredAt:
      doc.deliveredAt instanceof Date
        ? doc.deliveredAt.toISOString()
        : doc.deliveredAt || null,
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

function parseDeliveryAmount(input) {
  if (input == null || input === "") return { value: 0 };
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    return { error: "Delivery amount must be a number >= 0" };
  }
  return { value };
}

function withItems(docs) {
  return docs.map((doc) => {
    const base = docToOrder(doc);
    let items = (doc.items || []).map((it) => ({
      id: it._id ? String(it._id) : null,
      mealType: it.mealType,
      quantity: it.quantity,
      pricePerUnit: it.pricePerUnit,
      subtotal: it.subtotal,
    }));
    if (!items.length) {
      const qty = Number(doc.quantity) > 0 ? Number(doc.quantity) : 1;
      const deliveryAmount = Number(doc.deliveryAmount || 0);
      const subtotal = Number(doc.businessSubtotal ?? (Number(doc.totalPrice || 0) - deliveryAmount)) || 0;
      items = [
        {
          id: null,
          mealType: doc.mealType,
          quantity: qty,
          pricePerUnit: qty > 0 ? subtotal / qty : subtotal,
          subtotal,
        },
      ];
    }
    return { ...base, items };
  });
}

const populateCustomer = { path: "customerId", select: "first_name last_name mobile" };

r.get("/", requireAdminOrUser, async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const filter = {};
    if (status === "pending" || status === "delivered") {
      filter.status = status;
    }
    if (createdBy && isPartner(String(createdBy).toLowerCase())) {
      filter.createdBy = String(createdBy).toLowerCase();
    }
    const docs = await Order.find(filter).populate(populateCustomer).sort({ createdAt: -1 }).lean();
    res.json(withItems(docs));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/customer/:customerId", requireAdminOrUser, async (req, res) => {
  try {
    const customerId = req.params.customerId;
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ error: "Invalid customer id" });
    }
    const docs = await Order.find({ customerId })
      .populate(populateCustomer)
      .sort({ createdAt: -1 })
      .lean();
    res.json(withItems(docs));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/", requireAdminOrUser, async (req, res) => {
  try {
    const { customerId, items: itemsInput, deliveryAmount: deliveryAmountInput } = req.body || {};
    const parsed = parseItems(itemsInput);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const items = parsed.items;
    const parsedDelivery = parseDeliveryAmount(deliveryAmountInput);
    if (parsedDelivery.error) return res.status(400).json({ error: parsedDelivery.error });
    const deliveryAmount = parsedDelivery.value;
    const businessSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const totalPrice = businessSubtotal + deliveryAmount;
    if (!mongoose.isValidObjectId(String(customerId))) {
      return res.status(400).json({ error: "Customer not found" });
    }
    const cust = await Customer.findById(customerId).select("_id").lean();
    if (!cust) return res.status(400).json({ error: "Customer not found" });
    const username = String(req.user?.username || "").toLowerCase().trim();
    if (!isPartner(username)) {
      return res.status(400).json({ error: "Invalid session user for created_by" });
    }
    const first = items[0];
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const order = await Order.create({
      customerId: cust._id,
      mealType: first.mealType,
      quantity: totalQty,
      businessSubtotal,
      deliveryAmount,
      totalPrice,
      status: "pending",
      createdBy: username,
      items: items.map((it) => ({
        mealType: it.mealType,
        quantity: it.quantity,
        pricePerUnit: it.pricePerUnit,
        subtotal: it.subtotal,
      })),
    });
    const populated = await Order.findById(order._id).populate(populateCustomer).lean();
    res.status(201).json(withItems([populated])[0]);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/:id/deliver", requireAdminOrUser, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const role = String(req.user?.role || "");
    const username = String(req.user?.username || "").toLowerCase().trim();
    const body = req.body && typeof req.body === "object" ? req.body : {};
    let pTo = null;
    let deliveredAt = null;

    if (role === "admin" || role === "user") {
      const { paidTo, deliveredDate } = body;
      const forbiddenFields = Object.keys(body).filter(
        (k) => !["status", "deliveredAt", "paidTo", "deliveredDate"].includes(k)
      );
      if (forbiddenFields.length) {
        return res.status(400).json({ error: "Staff can only mark order as delivered" });
      }
      if (role === "user" && body.status != null && String(body.status).toLowerCase() !== "delivered") {
        return res.status(400).json({ error: "Staff can only set status to delivered" });
      }

      pTo = String(paidTo || "").toLowerCase();
      if (!isPartner(pTo)) {
        return res.status(400).json({ error: "paidTo must be elie or jimmy" });
      }
      const dateText = String(deliveredDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return res.status(400).json({ error: "deliveredDate is required (YYYY-MM-DD)" });
      }
      deliveredAt = new Date(`${dateText}T12:00:00.000Z`);

      if (role === "user" && !isPartner(username)) {
        return res.status(400).json({ error: "Invalid session user for delivery action" });
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "delivered") {
      return res.status(400).json({ error: "Order already delivered" });
    }
    await Order.findByIdAndUpdate(id, {
      status: "delivered",
      deliveredBy: null,
      paidTo: pTo,
      deliveredAt,
    });
    const populated = await Order.findById(id).populate(populateCustomer).lean();
    res.json(withItems([populated])[0]);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { customerId, items: itemsInput, status, paidTo, deliveredDate, deliveryAmount: deliveryAmountInput } = req.body || {};
    const cid = String(customerId);
    const parsed = parseItems(itemsInput);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const items = parsed.items;
    const parsedDelivery = parseDeliveryAmount(deliveryAmountInput);
    if (parsedDelivery.error) return res.status(400).json({ error: parsedDelivery.error });
    const deliveryAmount = parsedDelivery.value;
    const businessSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const totalPrice = businessSubtotal + deliveryAmount;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const first = items[0];
    const s = String(status || "").toLowerCase();
    if (!mongoose.isValidObjectId(cid) || !["pending", "delivered"].includes(s)) {
      return res.status(400).json({ error: "Invalid order data" });
    }
    const cust = await Customer.findById(cid).select("_id").lean();
    if (!cust) return res.status(400).json({ error: "Customer not found" });

    let pTo = null;
    let deliveredAt = null;
    if (s === "delivered") {
      pTo = String(paidTo || "").toLowerCase();
      const dateText = String(deliveredDate || "").trim();
      if (!isPartner(pTo) || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return res.status(400).json({ error: "Delivered orders require paidTo and deliveredDate" });
      }
      deliveredAt = new Date(`${dateText}T12:00:00.000Z`);
    }

    await Order.findByIdAndUpdate(id, {
      customerId: cust._id,
      mealType: first.mealType,
      quantity: totalQty,
      businessSubtotal,
      deliveryAmount,
      totalPrice,
      status: s,
      deliveredBy: null,
      paidTo: pTo,
      deliveredAt,
      items: items.map((it) => ({
        mealType: it.mealType,
        quantity: it.quantity,
        pricePerUnit: it.pricePerUnit,
        subtotal: it.subtotal,
      })),
    });

    const populated = await Order.findById(id).populate(populateCustomer).lean();
    return res.json(withItems([populated])[0]);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const existing = await Order.findByIdAndDelete(id);
    if (!existing) return res.status(404).json({ error: "Order not found" });
    return res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;
