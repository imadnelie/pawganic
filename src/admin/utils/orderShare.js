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
  };
}

export function buildOrderSummaryLines(order) {
  const normalized = normalizeShareOrder(order);
  const items = Array.isArray(normalized?.items) ? normalized.items : [];
  const { foodSubtotal, delivery, grandTotal } = getOrderBreakdown(normalized);
  const itemLines = items.map((it) => {
    const qty = Number(it.quantity || 0);
    const subtotal = Number(it.subtotal ?? qty * Number(it.pricePerUnit || 0));
    return `- ${it.mealType.replaceAll("_", " ")} x${qty}: ${money(subtotal)}`;
  });
  const lines = [
    `Pawganic Order #${normalized?.id || ""}`.trim(),
    `Customer: ${normalized?.customerFirstName || ""} ${normalized?.customerLastName || ""}`.trim(),
    `Mobile: ${normalized?.customerMobile || "N/A"}`,
    `Date: ${formatOrderDate(normalized?.createdAt)}`,
    "",
    "Items:",
    ...(itemLines.length ? itemLines : ["- No items"]),
    "",
    `Food subtotal: ${money(foodSubtotal)}`,
    `Delivery: ${money(delivery)}`,
    `Grand total: ${money(grandTotal)}`,
    `Status: ${normalized?.status || "N/A"}`,
  ];
  return lines;
}

export function buildWhatsAppMessage(order) {
  return buildOrderSummaryLines(order).join("\n");
}

export function orderFileBaseName(order) {
  const id = String(order?.id || "order");
  return `pawganic-order-${id}`;
}
