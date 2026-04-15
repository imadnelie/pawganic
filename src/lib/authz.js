/** Role checks mirror server authorization (JWT `role` claim). */

export function isAdmin(user) {
  return String(user?.role || "") === "admin";
}

/** Staff partner account (`user` role, e.g. Jimmy). */
export function isStaffUser(user) {
  return String(user?.role || "") === "user";
}

/** Admin or staff: may use shared operational routes (not `/users`). */
export function isAdminOrStaff(user) {
  return isAdmin(user) || isStaffUser(user);
}

/** View/edit customer records (GET/POST/PATCH); DELETE remains admin-only in UI + API. */
export function canManageCustomers(user) {
  return isAdminOrStaff(user);
}

export const canViewDashboard = isAdminOrStaff;
export const canViewBalance = isAdminOrStaff;
export const canViewOrders = isAdminOrStaff;
export const canCreateOrder = isAdminOrStaff;

/** Full order mutation powers: edit/delete stay admin-only. */
export const canAdminMutateOrders = isAdmin;

/** Mark delivered is allowed for admin and staff. */
export const canMarkOrderDelivered = isAdminOrStaff;

export const canViewExpenses = isAdminOrStaff;
export const canCreateExpense = isAdminOrStaff;
export const canEditExpense = isAdmin;
export const canDeleteExpense = isAdmin;

export const canAccessUsersPage = isAdmin;

export function postLoginDestination(user, fromPathname) {
  if (!isAdminOrStaff(user)) {
    return fromPathname && !String(fromPathname).startsWith("/admin") ? fromPathname : "/";
  }
  if (isAdmin(user)) {
    return fromPathname || "/admin";
  }
  const from = String(fromPathname || "").trim();
  if (from.startsWith("/admin/users")) return "/admin";
  if (from.startsWith("/admin")) return from || "/admin";
  return "/admin";
}
