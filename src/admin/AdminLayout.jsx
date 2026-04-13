import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../lib/authz.js";

const STAFF_NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/expenses", label: "Expenses" },
  { to: "/admin/balance", label: "Balance" },
];

function defaultTitleForPath(pathname) {
  if (pathname === "/admin") return "Dashboard";
  if (pathname === "/admin/customers") return "Customers";
  if (/^\/admin\/customers\/[^/]+$/.test(pathname)) return "Customer";
  if (pathname === "/admin/orders") return "Orders";
  if (pathname === "/admin/expenses") return "Expenses";
  if (pathname === "/admin/balance") return "Balance";
  if (pathname === "/admin/users") return "Users";
  return "Admin";
}

function MenuIcon({ open }) {
  return (
    <svg
      className="h-6 w-6 text-slate-700 transition-transform duration-200 ease-out"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const admin = isAdmin(user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pageTitleOverride, setPageTitleOverride] = useState(null);

  const nav = admin ? [...STAFF_NAV, { to: "/admin/users", label: "Users" }] : STAFF_NAV;

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    setPageTitleOverride(null);
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    const isNarrow = () => window.matchMedia("(max-width: 1023px)").matches;
    if (mobileNavOpen && isNarrow()) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [mobileNavOpen]);

  const setPageTitle = useCallback((value) => {
    setPageTitleOverride(value);
  }, []);

  const outletContext = useMemo(() => ({ setPageTitle }), [setPageTitle]);

  const headerTitle = pageTitleOverride ?? defaultTitleForPath(location.pathname);

  const sidebar = (
    <>
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
          className="mt-3 hidden w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 lg:block"
        >
          Log out
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeMobileNav}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2 ${
                isActive ? "bg-forest/10 text-forest" : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-[60] flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm lg:hidden">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200"
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-drawer"
          onClick={() => setMobileNavOpen((o) => !o)}
        >
          <span className="sr-only">{mobileNavOpen ? "Close menu" : "Open menu"}</span>
          <MenuIcon open={mobileNavOpen} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-slate-900">
          {headerTitle}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="max-w-[4.5rem] truncate text-xs text-slate-500 sm:max-w-[9rem]">
            {user?.displayName}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {/* Backdrop (mobile drawer) */}
        <button
          type="button"
          aria-label="Close menu"
          className={`fixed bottom-0 left-0 right-0 top-14 z-[50] bg-slate-900/40 transition-opacity duration-200 ease-out lg:hidden ${
            mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeMobileNav}
          tabIndex={mobileNavOpen ? 0 : -1}
        />

        {/* Sidebar: off-canvas below lg; fixed column on lg */}
        <aside
          id="admin-mobile-drawer"
          className={`fixed left-0 top-14 z-[55] flex w-[min(17.5rem,85vw)] max-w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:pointer-events-auto lg:static lg:top-auto lg:z-0 lg:h-auto lg:max-w-none lg:w-56 lg:min-h-screen lg:translate-x-0 lg:shadow-none ${
            mobileNavOpen
              ? "translate-x-0 pointer-events-auto"
              : "-translate-x-full pointer-events-none"
          } bottom-0 lg:bottom-auto`}
        >
          {sidebar}
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto lg:flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-5 lg:px-8 lg:py-8">
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}
