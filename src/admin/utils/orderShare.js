export function money(n) {
  const value = Number(n);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    Number.isFinite(value) ? value : 0
  );
}

export function formatOrderDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

/** First non-empty trimmed string from candidates. */
export function pickShareField(...candidates) {
  for (const v of candidates) {
    const s = v != null ? String(v).trim() : "";
    if (s) return s;
  }
  return "";
}

/**
 * Display/share-only mobile cleanup (does not change stored customer data).
 * Strips markdown wrappers (* _ ~ `) and stray commas/semicolons often pasted from WhatsApp or CSV.
 */
export function formatShareMobile(value) {
  if (value == null) return "";
  let s = String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!s) return "";
  for (let i = 0; i < 3; i += 1) {
    const next = s
      .replace(/^[*_~`]+|[*_~`]+$/g, "")
      .replace(/^[,;.\s]+|[,;.\s]+$/g, "")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

function resolveShareCustomer(order, customerOrCustomers) {
  if (!customerOrCustomers) return null;
  if (Array.isArray(customerOrCustomers)) {
    const id = order?.customerId != null ? String(order.customerId) : "";
    return customerOrCustomers.find((c) => String(c.id) === id) || null;
  }
  return customerOrCustomers;
}

/** Merge order API fields with customer record when city/maps/mobile are missing on the order. */
export function enrichShareOrder(order, customerOrCustomers) {
  const base = order || {};
  const customer = resolveShareCustomer(base, customerOrCustomers);
  return {
    ...base,
    customerMobile: formatShareMobile(
      pickShareField(base.customerMobile, customer?.mobile)
    ),
    customerCity: pickShareField(base.customerCity, base.customer_city, base.city, customer?.city),
    customerMapsLink: pickShareField(
      base.customerMapsLink,
      base.customer_maps_link,
      base.maps_link,
      customer?.maps_link
    ),
  };
}

export function getOrderBreakdown(order) {
  const rawDelivery =
    order?.deliveryAmount ?? order?.delivery ?? order?.delivery_fee ?? order?.deliveryFee ?? 0;
  const delivery = Number(rawDelivery);
  const grandTotal = Number(order?.totalPrice || 0);
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsSubtotal = items.reduce((sum, it) => {
    const qty = Number(it?.quantity || 0);
    const subtotal = Number(it?.subtotal ?? qty * Number(it?.pricePerUnit || 0));
    return sum + (Number.isFinite(subtotal) ? subtotal : 0);
  }, 0);
  const fallbackSubtotal = grandTotal - (Number.isFinite(delivery) ? delivery : 0);
  const rawFoodSubtotal =
    order?.businessSubtotal ??
    order?.foodSubtotal ??
    order?.subtotal ??
    (items.length ? itemsSubtotal : fallbackSubtotal);
  const foodSubtotal = Number(rawFoodSubtotal);
  return {
    foodSubtotal: Number.isFinite(foodSubtotal) ? foodSubtotal : 0,
    delivery: Number.isFinite(delivery) ? delivery : 0,
    grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0,
  };
}

export function normalizeShareOrder(order) {
  const base = order || {};
  const { foodSubtotal, delivery, grandTotal } = getOrderBreakdown(base);
  return {
    ...base,
    businessSubtotal: foodSubtotal,
    deliveryAmount: delivery,
    totalPrice: grandTotal,
    customerMobile: formatShareMobile(
      pickShareField(base.customerMobile, base.customer_mobile, base.mobile)
    ),
    customerCity: pickShareField(base.customerCity, base.customer_city, base.city),
    customerMapsLink: pickShareField(
      base.customerMapsLink,
      base.customer_maps_link,
      base.maps_link
    ),
  };
}

function formatMealType(value) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}

function formatShareStatus(value) {
  const s = String(value || "N/A").replace(/_/g, " ").trim();
  return s || "N/A";
}

export function buildOrderSummaryLines(order) {
  const normalized = normalizeShareOrder(order);
  const items = Array.isArray(normalized?.items) ? normalized.items : [];
  const { foodSubtotal, delivery, grandTotal } = getOrderBreakdown(normalized);
  const itemLines = items.map((it) => {
    const qty = Number(it.quantity || 0);
    const subtotal = Number(it.subtotal ?? qty * Number(it.pricePerUnit || 0));
    return `- ${formatMealType(it.mealType)} x${qty}: ${money(subtotal)}`;
  });

  const lines = [
    `Pawganic Order #${normalized?.id || ""}`.trim(),
    `Customer: ${`${normalized?.customerFirstName || ""} ${normalized?.customerLastName || ""}`.trim()}`,
    `Mobile: ${formatShareMobile(normalized?.customerMobile) || "N/A"}`,
  ];

  const city = pickShareField(normalized.customerCity);
  if (city) lines.push(`City: ${city}`);

  const mapsLink = pickShareField(normalized.customerMapsLink);
  if (mapsLink) lines.push(`Location: ${mapsLink}`);

  lines.push(
    `Date: ${formatOrderDate(normalized?.createdAt)}`,
    "",
    "Items:",
    ...(itemLines.length ? itemLines : ["- No items"]),
    "",
    `Food subtotal: ${money(foodSubtotal)}`,
    `Delivery: ${money(delivery)}`,
    `Grand total: ${money(grandTotal)}`,
    `Status: ${formatShareStatus(normalized?.status)}`
  );

  return lines;
}

export function buildWhatsAppMessage(order) {
  return buildOrderSummaryLines(order).join("\n");
}

export function orderFileBaseName(order) {
  const id = String(order?.id || "order");
  return `pawganic-order-${id}`;
}
