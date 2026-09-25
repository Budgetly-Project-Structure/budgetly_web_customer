/**
 * Dashboard home content — used inside <Layout>.
 * Placeholder data below; wire up to Firestore query results.
 */

const CATEGORY_SUMMARIES = [
  { name: "Dining Out", spent: 312, budget: 250, status: "over" },
  { name: "Groceries", spent: 418, budget: 500, status: "on-track" },
  { name: "Transportation", spent: 96, budget: 150, status: "on-track" },
  { name: "Subscriptions", spent: 64, budget: 60, status: "over" },
];

function formatCurrency(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function DashboardHome() {
  const totalSpent = CATEGORY_SUMMARIES.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = CATEGORY_SUMMARIES.reduce((sum, c) => sum + c.budget, 0);
  const pctUsed = Math.round((totalSpent / totalBudget) * 100);

  return (
    <div>
      <p className="text-sm text-textMuted mb-1">This month</p>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono text-5xl font-semibold text-green tabular-nums">
          {formatCurrency(totalSpent)}
        </span>
        <span className="text-sm text-textMuted">of {formatCurrency(totalBudget)} budgeted</span>
      </div>
      <p className={`text-sm mb-10 ${pctUsed > 100 ? "text-warn" : "text-green"}`}>
        {pctUsed}% of budget used
      </p>

      <h2 className="text-sm font-medium text-textMuted mb-3">By category</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORY_SUMMARIES.map((cat) => {
          const isOver = cat.status === "over";
          const pct = Math.min(100, Math.round((cat.spent / cat.budget) * 100));
          return (
            <div
              key={cat.name}
              className="bg-surface rounded-lg border border-green p-4 shadow-[0_8px_24px_rgba(57,214,122,0.12)]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-textLight">{cat.name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    isOver
                      ? "bg-warn/10 text-warn border-warn/40"
                      : "bg-greenDim text-green border-green/40"
                  }`}
                >
                  {isOver ? "Over" : "On track"}
                </span>
              </div>
              <p className="font-mono text-lg text-textLight mb-2 tabular-nums">
                {formatCurrency(cat.spent)}
                <span className="text-textMuted text-sm"> / {formatCurrency(cat.budget)}</span>
              </p>
              <div className="h-1.5 rounded-full bg-charcoal border border-line overflow-hidden">
                <div
                  className={`h-full rounded-full ${isOver ? "bg-warn" : "bg-green"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}