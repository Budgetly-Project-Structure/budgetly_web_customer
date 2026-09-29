/**
 * DashboardHome.jsx
 *
 * The main content of the Dashboard (home) page. It is rendered inside
 * <Layout>, which provides the sidebar and top bar.
 *
 * It shows:
 *   1. A headline number: total spent this month vs. total budgeted
 *   2. The percent of the overall budget used (green if under, warning color if over)
 *   3. A grid of cards, one per spending category, each with a badge
 *      and a progress bar
 *
 * Follows the dashboard direction in docs/ui-constraints.md:
 * a big headline number plus summary cards, with status shown by a
 * text badge ("Over" / "On track") and not by color alone.
 *
 * Part of: Account & Onboarding epic, dashboard shell (Sprint 2)
 *
 * TODO: Replace CATEGORY_SUMMARIES with real data from Firestore
 * (the user's transactions for the current month, grouped by category,
 * joined with their budgets). See docs/data-model.md.
 * TODO: Add loading, empty (no transactions yet), and error states
 * before this is wired to real data.
 *
 * @returns {JSX.Element}
 */

/**
 * PLACEHOLDER DATA. This is hard-coded so the layout can be built before
 * the backend exists.
 *
 * Each category has:
 *   - name:   category label (must match the categories the AI assigns)
 *   - spent:  total spent this month, in dollars
 *   - budget: monthly budget for the category, in dollars
 *   - status: "over" or "on-track"
 *
 * When this switches to real data, `status` should be calculated
 * (spent > budget ? "over" : "on-track") and not stored, so it can
 * never disagree with the numbers.
 */
const CATEGORY_SUMMARIES = [
  { name: "Dining Out", spent: 312, budget: 250, status: "over" },
  { name: "Groceries", spent: 418, budget: 500, status: "on-track" },
  { name: "Transportation", spent: 96, budget: 150, status: "on-track" },
  { name: "Subscriptions", spent: 64, budget: 60, status: "over" },
];

/**
 * Formats a number as US dollars with no cents.
 * Example: 1234.5 becomes "$1,235".
 *
 * Use this for every currency value so formatting stays consistent
 * across screens (a UI rule shared with the mobile app).
 * Consider moving it to a shared utils file once other pages need it.
 *
 * @param {number} n Amount in dollars.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function DashboardHome() {
  // Month-level totals, added up across all categories.
  const totalSpent = CATEGORY_SUMMARIES.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = CATEGORY_SUMMARIES.reduce((sum, c) => sum + c.budget, 0);

  // Percent of the total budget used. This can go over 100.
  // NOTE: If totalBudget is 0 (a new user with no budgets), this divides
  // by zero and shows "NaN%" or "Infinity%". Handle that case when adding
  // the empty state.
  const pctUsed = Math.round((totalSpent / totalBudget) * 100);

  return (
    <div>
      {/* ---------- Headline: total spent this month ---------- */}
      <p className="text-sm text-textMuted mb-1">This month</p>
      <div className="flex items-baseline gap-3 mb-1">
        {/* tabular-nums gives every digit the same width, so numbers
            don't shift sideways when the values change. */}
        <span className="font-mono text-5xl font-semibold text-green tabular-nums">
          {formatCurrency(totalSpent)}
        </span>
        <span className="text-sm text-textMuted">of {formatCurrency(totalBudget)} budgeted</span>
      </div>

      {/* Overall budget usage. Switches to the warning color once over 100%.
          The percentage text carries the meaning, so color is not the only signal. */}
      <p className={`text-sm mb-10 ${pctUsed > 100 ? "text-warn" : "text-green"}`}>
        {pctUsed}% of budget used
      </p>

      {/* ---------- Category cards ---------- */}
      <h2 className="text-sm font-medium text-textMuted mb-3">By category</h2>

      {/* Responsive grid: 1 column on phones, 2 on tablets, 4 on desktops. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORY_SUMMARIES.map((cat) => {
          const isOver = cat.status === "over";

          // Width of the progress bar fill, capped at 100% so an
          // over-budget category doesn't overflow its bar.
          // The card's badge and dollar amounts still show the overspend.
          const pct = Math.min(100, Math.round((cat.spent / cat.budget) * 100));

          return (
            <div
              key={cat.name}
              className="bg-surface rounded-lg border border-green p-4 shadow-[0_8px_24px_rgba(57,214,122,0.12)]"
            >
              {/* Card header: category name and status badge. */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-textLight">{cat.name}</span>
                {/* Status badge. The text label ("Over" / "On track") pairs with
                    the color so the status is clear without relying on color. */}
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

              {/* Amount spent / amount budgeted. */}
              <p className="font-mono text-lg text-textLight mb-2 tabular-nums">
                {formatCurrency(cat.spent)}
                <span className="text-textMuted text-sm"> / {formatCurrency(cat.budget)}</span>
              </p>

              {/* Progress bar: the outer div is the track, the inner div is the fill. */}
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