/**
 * Layout.jsx
 *
 * The app shell that wraps every signed-in page. It provides:
 *   - A left sidebar with the main navigation (desktop, `md` breakpoint and up)
 *   - A slide-out drawer with the same navigation (phones and small tablets)
 *   - A sticky top bar with the import status, an Import button, and the user's initials
 *   - A centered, max-width content area where the current page renders
 *
 * Pages render into <Outlet />. In App.jsx, pages are nested routes under a
 * route whose element is <Layout />, so each page only renders its own
 * content and never repeats the sidebar or top bar.
 *
 * Follows the web layout in docs/ui-constraints.md: left sidebar, persistent
 * top bar with account and sync status, and a max-width content container.
 *
 * Data: reads `lastImport` and `profile` from FinanceContext (useFinance).
 *
 * Part of: Account & Onboarding epic, dashboard shell (Sprint 2)
 */
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "./Icon";
import { useFinance } from "../data/FinanceContext";
import { formatDateTime } from "../lib/format";

/**
 * Main navigation links, shown at the top of the sidebar in this order.
 *
 * Each item has:
 *   - to:    route path (must match a route in App.jsx)
 *   - label: text shown in the sidebar
 *   - icon:  a name from the PATHS map in Icon.jsx
 *   - end:   (optional) when true, the link is active only on an exact path match.
 *            Home needs this; otherwise "/" would count as active on every page.
 *
 * Exported so other components (for example, a mobile bottom tab bar) can reuse
 * the same list and the navigation stays consistent.
 */
export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/transactions", label: "Transactions", icon: "transactions" },
  { to: "/budget", label: "Budget", icon: "budget" },
  { to: "/insights", label: "Insights", icon: "insights" },
  { to: "/import", label: "Import", icon: "import" },
];

/** Links pinned to the bottom of the sidebar, below a divider. */
const SECONDARY_ITEMS = [{ to: "/settings", label: "Settings", icon: "settings" }];

/**
 * A single sidebar link. It is highlighted when its route is the current page.
 *
 * NavLink (from react-router) passes `isActive` to both `className` and
 * `children` when they are functions, which is how the active styling works here.
 *
 * @param {Object}   props
 * @param {Object}   props.item      One entry from NAV_ITEMS or SECONDARY_ITEMS.
 * @param {Function} [props.onClick] Optional click handler (used to close the mobile drawer).
 */
function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      // Active page: green-tinted background and border, white bold text.
      // Other pages: muted text that lightens on hover.
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors border ${
          isActive
            ? "bg-greenDim border-green/60 text-white font-medium"
            : "border-transparent text-textMuted hover:text-textLight hover:bg-raised"
        }`
      }
    >
      {/* The icon also turns green on the active page. */}
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={`w-4 h-4 ${isActive ? "text-green" : ""}`} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * Everything inside the sidebar: the logo, main nav, and bottom section
 * (Settings and Log out).
 *
 * Shared by the desktop sidebar and the mobile drawer so they always match.
 *
 * @param {Object}   props
 * @param {Function} [props.onNavigate] Called when any link is clicked. The mobile
 *                                      drawer uses this to close itself. The desktop
 *                                      sidebar doesn't pass it.
 */
function SidebarContents({ onNavigate }) {
  return (
    <>
      {/* Logo row. Same height (h-16) as the top bar, so their borders line up. */}
      <div className="h-16 flex items-center px-6 border-b border-line shrink-0">
        <Link to="/" onClick={onNavigate} className="font-mono text-sm tracking-tight font-semibold text-green">
          Budgetly
        </Link>
      </div>

      {/* aria-label names this landmark "Main navigation" for screen readers. */}
      <nav className="flex-1 flex flex-col px-3 py-6" aria-label="Main">
        {/* Main links */}
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onClick={onNavigate} />
          ))}
        </div>

        {/* Bottom section. `mt-auto` pushes it to the bottom of the sidebar. */}
        <div className="mt-auto pt-6 space-y-1 border-t border-line">
          {SECONDARY_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onClick={onNavigate} />
          ))}

          {/* Log out.
              NOTE: This only goes to the /login page. It does NOT sign the user
              out of Firebase, so they are still authenticated.
              TODO: Call Firebase `signOut(auth)` first, then navigate to /login. */}
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

/**
 * The layout component itself. Use it as the element of the parent route in App.jsx.
 *
 * @returns {JSX.Element}
 */
export default function Layout() {
  // Shared app data from FinanceContext:
  //   lastImport: the most recent statement upload, or null if none yet
  //   profile:    the signed-in user's profile (needs a displayName)
  const { lastImport, profile } = useFinance();

  // Whether the mobile navigation drawer is open.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The current URL. Used below to close the drawer after navigating.
  const location = useLocation();

  // Close the mobile drawer whenever the route changes, so it doesn't stay
  // open on top of the new page. This also covers navigation that doesn't
  // come from a sidebar click (for example, the browser's back button).
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // The user's initials for the avatar circle, for example "Zach Sheppard" becomes "ZS".
  // Takes the first letter of each word, keeps at most 2, and uppercases them.
  // NOTE: This crashes if profile or profile.displayName is missing (for example,
  // while the profile is still loading). Consider `(profile?.displayName || "")`.
  const initials = profile.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-charcoal text-textLight font-sans">
      {/* ---------- Desktop sidebar ----------
          Hidden on small screens. From `md` up it's a fixed 14rem-wide (w-56) column. */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-line">
        <SidebarContents />
      </aside>

      {/* ---------- Mobile drawer ----------
          Only rendered when open, and only on small screens (md:hidden). */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Dark backdrop behind the drawer. Clicking it closes the drawer. */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

          {/* The drawer panel, sliding in from the left. */}
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col bg-surface border-r border-line">
            {/* Close (X) button. aria-label gives the icon-only button a name for screen readers. */}
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

      {/* ---------- Main column ----------
          On desktop, shifted right by the sidebar's width (md:ml-56). */}
      <div className="md:ml-56 relative">
        {/* Decorative green glow in the top left of the content area.
            Doesn't block clicks and is hidden from screen readers. */}
        <div
          className="pointer-events-none fixed inset-0 md:left-56"
          style={{ background: "radial-gradient(600px circle at 15% 0%, rgba(57,214,122,0.06), transparent 60%)" }}
          aria-hidden="true"
        />

        {/* ---------- Top bar ----------
            `sticky top-0` keeps it visible while scrolling. The slightly
            transparent background plus backdrop-blur frosts the content that
            scrolls underneath it. */}
        <header className="h-16 sticky top-0 z-30 bg-charcoal/90 backdrop-blur border-b border-line flex items-center gap-3 px-4 sm:px-6">
          {/* Hamburger button. Mobile only; opens the drawer. */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-1.5 -ml-1.5 text-textMuted hover:text-textLight"
            aria-label="Open menu"
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>

          {/* Logo. Mobile only, since on desktop it's already in the sidebar. */}
          <span className="md:hidden font-mono text-sm font-semibold text-green">Budgetly</span>

          {/* Spacer that pushes everything after it to the right edge. */}
          <div className="flex-1" />

          {/* Sync status (hidden on the smallest screens).
              The dot is green once a statement has been imported and the warning
              color if not. The text next to it carries the meaning, so the status
              doesn't rely on color alone. */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-textMuted">
            <span
              className={`inline-block w-2 h-2 rounded-full ${lastImport ? "bg-green" : "bg-warn"}`}
              aria-hidden="true"
            />
            {lastImport ? `Last import ${formatDateTime(lastImport.uploadedAt)}` : "No statements imported yet"}
          </div>

          {/* Import shortcut. Icon only on phones; icon plus label from `sm` up. */}
          <Link
            to="/import"
            className="inline-flex items-center gap-1.5 text-sm text-charcoal bg-green hover:bg-green/90 rounded-md px-3 py-1.5 font-medium ml-2"
          >
            <Icon name="upload" className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">Import</span>
          </Link>

          {/* Avatar with the user's initials. Links to Settings.
              `title` shows the full name as a hover tooltip. */}
          <Link
            to="/settings"
            className="w-8 h-8 rounded-full bg-surface border border-green text-textLight text-xs flex items-center justify-center font-medium"
            title={profile.displayName}
          >
            {initials}
          </Link>
        </header>

        {/* ---------- Page content ----------
            The current route's page renders here (Dashboard, Transactions, etc.).
            `max-w-6xl mx-auto` keeps the content from stretching too wide on large screens. */}
        <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}