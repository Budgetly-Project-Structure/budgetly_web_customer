import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "./Icon";
import { useFinance } from "../data/FinanceContext";
import { formatDateTime } from "../lib/format";

/**
 * App shell: left sidebar navigation + persistent top bar.
 * Pages render into <Outlet /> (see the nested routes in App.jsx).
 * On small screens the sidebar becomes a slide-out drawer.
 */

export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/transactions", label: "Transactions", icon: "transactions" },
  { to: "/budget", label: "Budget", icon: "budget" },
  { to: "/insights", label: "Insights", icon: "insights" },
  { to: "/import", label: "Import", icon: "import" },
];

const SECONDARY_ITEMS = [{ to: "/settings", label: "Settings", icon: "settings" }];

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors border ${
          isActive
            ? "bg-greenDim border-green/60 text-white font-medium"
            : "border-transparent text-textMuted hover:text-textLight hover:bg-raised"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={`w-4 h-4 ${isActive ? "text-green" : ""}`} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function SidebarContents({ onNavigate }) {
  return (
    <>
      <div className="h-16 flex items-center px-6 border-b border-line shrink-0">
        <Link to="/" onClick={onNavigate} className="font-mono text-sm tracking-tight font-semibold text-green">
          Budgetly
        </Link>
      </div>
      <nav className="flex-1 flex flex-col px-3 py-6" aria-label="Main">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onClick={onNavigate} />
          ))}
        </div>
        <div className="mt-auto pt-6 space-y-1 border-t border-line">
          {SECONDARY_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onClick={onNavigate} />
          ))}
          <Link
            to="/login"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-textMuted hover:text-textLight hover:bg-raised transition-colors"
          >
            <Icon name="logout" className="w-4 h-4" />
            Log out
          </Link>
        </div>
      </nav>
    </>
  );
}

export default function Layout() {
  const { lastImport, profile } = useFinance();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const initials = profile.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-charcoal text-textLight font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-line">
        <SidebarContents />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col bg-surface border-r border-line">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 p-1.5 text-textMuted hover:text-textLight"
              aria-label="Close menu"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
            <SidebarContents onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="md:ml-56 relative">
        <div
          className="pointer-events-none fixed inset-0 md:left-56"
          style={{ background: "radial-gradient(600px circle at 15% 0%, rgba(57,214,122,0.06), transparent 60%)" }}
          aria-hidden="true"
        />

        {/* Top bar */}
        <header className="h-16 sticky top-0 z-30 bg-charcoal/90 backdrop-blur border-b border-line flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-1.5 -ml-1.5 text-textMuted hover:text-textLight"
            aria-label="Open menu"
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>
          <span className="md:hidden font-mono text-sm font-semibold text-green">Budgetly</span>
          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-2 text-sm text-textMuted">
            <span
              className={`inline-block w-2 h-2 rounded-full ${lastImport ? "bg-green" : "bg-warn"}`}
              aria-hidden="true"
            />
            {lastImport ? `Last import ${formatDateTime(lastImport.uploadedAt)}` : "No statements imported yet"}
          </div>
          <Link
            to="/import"
            className="inline-flex items-center gap-1.5 text-sm text-charcoal bg-green hover:bg-green/90 rounded-md px-3 py-1.5 font-medium ml-2"
          >
            <Icon name="upload" className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">Import</span>
          </Link>
          <Link
            to="/settings"
            className="w-8 h-8 rounded-full bg-surface border border-green text-textLight text-xs flex items-center justify-center font-medium"
            title={profile.displayName}
          >
            {initials}
          </Link>
        </header>

        <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
