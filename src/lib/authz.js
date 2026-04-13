/** Role checks mirror server authorization (JWT `role` claim). */

export function isAdmin(user) {
  return String(user?.role || "") === "admin";
}

/** Staff who may view and edit customers (admin or `user`, e.g. Jimmy). */
export function canManageCustomers(user) {
  const r = String(user?.role || "");
  return r === "admin" || r === "user";
}

export function postLoginDestination(user, fromPathname) {
  if (isAdmin(user)) return fromPathname || "/admin";
  const from = fromPathname || "";
  if (from.startsWith("/admin/customers")) return from || "/admin/customers";
  return "/admin/customers";
}
