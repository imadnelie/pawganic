import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin =
    String(user?.username || "").toLowerCase() === "elie" && user?.role === "admin";
  const nav = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/expenses", label: "Expenses" },
    { to: "/admin/balance", label: "Balance" },
    ...(isSuperAdmin ? [{ to: "/admin/users", label: "Users" }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="font-semibold text-slate-900">Pawganic</div>
          <div className="mt-1 text-xs text-slate-500">
            {user?.displayName} · {user?.role}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-forest/10 text-forest" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
