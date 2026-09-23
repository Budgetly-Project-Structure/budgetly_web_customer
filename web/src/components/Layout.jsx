import { useState } from "react";

/**
 * App shell: left sidebar navigation + persistent top bar.
 * Wrap page content: <Layout activeNav="dashboard"><DashboardHome /></Layout>
 *
 * Requires these colors added to tailwind.config.js theme.extend.colors:
 *   charcoal: '#17191C', surface: '#212528', line: '#2C3033',
 *   green: '#39D67A', greenDim: '#1E4430',
 *   warn: '#D9A441', textLight: '#EBEEF0', textMuted: '#8C9296'
 *
 * Requires IBM Plex Sans + IBM Plex Mono loaded (e.g. in index.html or index.css):
 *   @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
 */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "budget", label: "Budget" },
  { key: "insights", label: "Insights" },
];

export default function Layout({ children, activeNav = "dashboard", onNavigate }) {
  const [syncStatus] = useState({ state: "synced", label: "Synced just now" });

  return (
    <div className="min-h-screen bg-charcoal text-textLight font-[Inter,system-ui,sans-serif]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-line">
          <div className="h-16 flex items-center px-6 border-b border-line">
            <span className="font-mono text-sm tracking-tight font-semibold text-green">
              Ledger
            </span>
          </div>
          <nav className="flex-1 px-3 py-6 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate?.(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                    isActive
                      ? "bg-greenDim border-green text-white font-medium"
                      : "border-transparent text-textMuted hover:text-textLight hover:border-line"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main column */}
        <div className="flex-1 md:ml-56 relative">
          {/* soft green-tinted background glow for depth */}
          <div
            className="pointer-events-none fixed inset-0 md:left-56 -z-10"
            style={{
              background:
                "radial-gradient(600px circle at 15% 0%, rgba(57,214,122,0.07), transparent 60%)",
            }}
            aria-hidden="true"
          />

          {/* Top bar */}
          <header className="h-16 sticky top-0 z-10 bg-charcoal/90 backdrop-blur border-b border-line flex items-center justify-between px-6">
            <span className="md:hidden font-mono text-sm font-semibold text-green">
              Ledger
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  syncStatus.state === "synced" ? "bg-green" : "bg-warn"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm text-textMuted">{syncStatus.label}</span>
              <div className="w-8 h-8 rounded-full bg-surface border border-green text-textLight text-xs flex items-center justify-center font-medium ml-2">
                JD
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}