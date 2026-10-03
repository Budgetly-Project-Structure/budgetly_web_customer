/**
 * HomePage.jsx
 *
 * The dashboard ("/"), the first page a signed-in user sees. It shows:
 *   1. Headline: how much of this month's total budget is spent, with a progress bar
 *   2. Four summary tiles: income, spending (vs last month), net, and "needs review"
 *   3. "Budgets to watch": the 5 budgets closest to (or over) their limit
 *   4. The top insight and a nudge to review low-confidence categories
 *   5. The 6 most recent transactions this month
 *
 * Data: everything comes from useFinance() (FinanceProvider). Transactions are
 * live from Firestore; budgets are still mock data.
 * All the math lives in lib/finance.js so this file only handles display.
 *
 * New user with no transactions → shows an empty state pointing to /import
 * (ui-constraints.md: design the empty state up front).
 */
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card, CategoryIcon, EmptyState, StatusChip, buttonStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { BUDGET_STATUS, budgetRows, generateInsights, monthTotals, needsReview } from "../lib/finance";
import { formatAmount, formatCurrency, formatDate, formatMonth } from "../lib/format";

/**
 * One small stat card in the summary row.
 *
 * @param {string} label    Small caption, e.g. "Income"
 * @param {string} value    The big number, already formatted
 * @param {string} [sub]    Optional line under the number
 * @param {"muted"|"good"|"warn"} [subTone]  Color of the sub line
 */
function SummaryTile({ label, value, sub, subTone = "muted" }) {
  const tones = { muted: "text-textMuted", good: "text-green", warn: "text-warn" };
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <p className="text-xs text-textMuted mb-2">{label}</p>
      <p className="font-mono text-xl text-textLight tabular-nums">{value}</p>
      {sub && <p className={`text-xs mt-1 ${tones[subTone]}`}>{sub}</p>}
    </div>
  );
}

/** Dashboard page component. */
export default function HomePage() {
  const { transactions, transactionsLoading, transactionsError, budgets, categories, currentMonth, previousMonth, profile } =
    useFinance();

  // Waiting for the first snapshot from Firestore: don't flash "no data yet"
  if (transactionsLoading) {
    return (
      <p className="py-16 text-center text-sm text-textMuted" role="status">
        Loading your transactions…
      </p>
    );
  }

  // Couldn't read from Firestore: say so, rather than telling a user with data to import
  if (transactionsError) {
    return (
      <Card>
        <EmptyState icon="alert" title="We couldn't load your transactions" body={transactionsError} />
      </Card>
    );
  }

  // Brand-new user: nothing imported yet, so show the "import your first statement" card
  if (transactions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="upload"
          title="Import your first statement"
          body="Upload a CSV or PDF bank statement and we'll categorize your transactions automatically."
          action={
            <Link to="/import" className={buttonStyles.primary}>
              Import a statement
            </Link>
          }
        />
      </Card>
    );
  }

  // --- Numbers for the headline and summary tiles ---
  // totals / prevTotals = { income, spending, net } for this month and last month
  const totals = monthTotals(transactions, currentMonth);
  const prevTotals = monthTotals(transactions, previousMonth);
  // One row per budget with spent, remaining, % used and status (see lib/finance.js)
  const rows = budgetRows(budgets, transactions, currentMonth, categories);
  // Headline numbers only count spending in categories that HAVE a budget
  const totalBudget = rows.reduce((s, r) => s + r.limit, 0);
  const budgetedSpent = rows.reduce((s, r) => s + r.spent, 0);
  const pctUsed = totalBudget ? (budgetedSpent / totalBudget) * 100 : 0;
  const leftToSpend = totalBudget - budgetedSpent;

  // Newest 6 transactions this month (ISO dates sort correctly as strings)
  const recent = transactions
    .filter((t) => t.date.startsWith(currentMonth))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  // Counts for the tile sub-lines
  const depositCount = transactions.filter((t) => t.date.startsWith(currentMonth) && t.amount > 0).length;
  const reviewCount =transactions.filter((t) => t.date.startsWith(currentMonth) && needsReview(t)).length;

  // Budgets that need attention first, then the biggest ones
  const watchList = [...rows]
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  // Only the first (most important) insight is shown here; /insights shows all of them
  const insight = generateInsights(transactions, currentMonth, previousMonth, categories, budgets)[0];
  const catById = (id) => categories.find((c) => c.id === id);
  // % change in spending vs last month (0 if last month had no spending, to avoid dividing by 0)
  const spendChange = prevTotals.spending ? ((totals.spending - prevTotals.spending) / prevTotals.spending) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Headline */}
      <div>
        <p className="text-sm text-textMuted mb-1">
          Hi {profile.displayName.split(" ")[0]} · {formatMonth(currentMonth)}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-4xl sm:text-5xl font-semibold text-green tabular-nums">
            {formatCurrency(budgetedSpent)}
          </span>
          <span className="text-sm text-textMuted">of {formatCurrency(totalBudget)} budgeted</span>
        </div>
        <div className="mt-3 max-w-md">
          {/* Progress bar: red over 100%, amber at 85%+, green otherwise. Width is capped at 100% */}
          <div className="h-2 rounded-full bg-surface border border-line overflow-hidden">
            <div
              className={`h-full rounded-full ${pctUsed > 100 ? "bg-danger" : pctUsed >= 85 ? "bg-warn" : "bg-green"}`}
              style={{ width: `${Math.min(100, pctUsed)}%` }}
            />
          </div>
          <p className="text-xs text-textMuted mt-2">
            {Math.round(pctUsed)}% used ·{" "}
            {leftToSpend >= 0 ? `${formatCurrency(leftToSpend)} left this month` : `${formatCurrency(-leftToSpend)} over`}
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spending going UP is shown as a warning; going down is good */}
        <SummaryTile label="Income" value={formatCurrency(totals.income)} sub={`${depositCount} deposit${depositCount === 1 ? "" : "s"}`} />
        <SummaryTile
          label="Spending"
          value={formatCurrency(totals.spending)}
          sub={`${spendChange >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(spendChange))}% vs ${formatMonth(previousMonth).split(" ")[0]}`}
          subTone={spendChange > 0 ? "warn" : "good"}
        />
        <SummaryTile
          label="Net"
          value={formatCurrency(totals.net)}
          sub={totals.net >= 0 ? "Saving this month" : "Spending more than earned"}
          subTone={totals.net >= 0 ? "good" : "warn"}
        />
        <SummaryTile
          label="Needs review"
          value={String(reviewCount)}
          sub={reviewCount ? "Low-confidence categories" : "All categorized"}
          subTone={reviewCount ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Budget watch list */}
        <Card
          className="lg:col-span-3"
          title="Budgets to watch"
          action={
            <Link to="/budget" className={buttonStyles.ghost}>
              All budgets <Icon name="chevronRight" className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <ul className="space-y-4">
            {watchList.map((r) => {
              // s = label, icon and colors for this budget's status ("over" / "near" / "ok")
              const s = BUDGET_STATUS[r.status];
              return (
                <li key={r.id} className="flex items-center gap-3">
                  <CategoryIcon category={r.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm text-textLight truncate">{r.category.label}</span>
                      <span className="font-mono text-xs text-textMuted tabular-nums">
                        {formatCurrency(r.spent)} / {formatCurrency(r.limit)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-charcoal border border-line overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                  </div>
                  {/* Wide screens show the full status chip; phones show just the icon
                      (with screen-reader text) so the row doesn't overflow */}
                  <span className="hidden sm:flex w-28 justify-end">
                    <StatusChip tone={r.status === "over" ? "danger" : r.status === "near" ? "warn" : "ok"} icon={s.icon}>
                      {s.label}
                    </StatusChip>
                  </span>
                  <span className={`sm:hidden ${s.text}`} title={s.label}>
                    <Icon name={s.icon} className="w-4 h-4" />
                    <span className="sr-only">{s.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Insight callout */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {insight && (
            <Card>
              <div className="pt-5">
                <p className="flex items-center gap-1.5 text-xs text-green mb-2">
                  <Icon name="sparkle" className="w-3.5 h-3.5" /> Insight
                </p>
                <p className="text-base font-medium text-textLight">{insight.title}</p>
                <p className="text-sm text-textMuted mt-1">{insight.body}</p>
                <Link to="/insights" className={`${buttonStyles.ghost} mt-4`}>
                  See all insights <Icon name="chevronRight" className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          )}
          {/* Only shown when some transactions have a low-confidence or missing category */}
          {reviewCount > 0 && (
            <Card>
              <div className="pt-5 flex items-start gap-3">
                <span className="text-warn mt-0.5">
                  <Icon name="alert" className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm text-textLight font-medium">
                    {reviewCount} transactions need a category check
                  </p>
                  <p className="text-sm text-textMuted mt-1">The AI wasn't confident about these. Takes a few seconds.</p>
                  <Link to="/transactions?review=1" className={`${buttonStyles.ghost} mt-3`}>
                    Review now <Icon name="chevronRight" className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <Card
        title="Recent transactions"
        padded={false}
        action={
          <Link to="/transactions" className={buttonStyles.ghost}>
            View all <Icon name="chevronRight" className="w-3.5 h-3.5" />
          </Link>
        }
      >
        <ul className="divide-y divide-line border-t border-line">
          {recent.map((t) => {
            const cat = catById(t.category);
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <CategoryIcon category={cat} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-textLight truncate">{t.merchant}</p>
                  <p className="text-xs text-textMuted">
                    {formatDate(t.date)} · {cat?.label}
                  </p>
                </div>
                <span className={`font-mono text-sm tabular-nums ${t.amount > 0 ? "text-green" : "text-textLight"}`}>
                  {formatAmount(t.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
