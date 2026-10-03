/**
 * BudgetPage.jsx
 *
 * The "/budget" page: monthly spending limits per category.
 *   - Three totals at the top: budgeted, spent so far, remaining (or over)
 *   - A row per budget with a progress bar and status ("On track" / "Near limit" / "Over budget")
 *   - Click the pencil to edit a limit inline, or remove the budget
 *   - "No budget yet" lists categories without a limit, with a "+ Set budget" button
 *
 * Status thresholds come from lib/finance.js (85% = near, over 100% = over).
 * Status is shown with an icon and a label, not just color (ui-constraints.md).
 *
 * Data: useFinance(). setBudgetLimit / removeBudget update local state for now
 * (later: Firestore).
 */
import { useState } from "react";
import Icon from "../components/Icon";
import { Card, CategoryIcon, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { BUDGET_STATUS, budgetRows, spendingByCategory } from "../lib/finance";
import { formatCurrency, formatMonth } from "../lib/format";

// Maps a budget status to the StatusChip color tone
const STATUS_TONE = { over: "danger", near: "warn", ok: "ok" };

/**
 * Small inline form for typing a monthly limit in dollars.
 * Save is disabled until the value is a positive number; Escape cancels.
 * The saved value is rounded to whole dollars.
 *
 * @param {number} [initial]  Starting value
 * @param {(limit: number) => void} onSave
 * @param {() => void} onCancel
 */
function LimitEditor({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(String(initial ?? ""));
  const num = Number(value);
  const valid = value !== "" && Number.isFinite(num) && num > 0;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(Math.round(num));
      }}
    >
      <label className="relative">
        <span className="sr-only">Monthly limit</span>
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-textMuted">$</span>
        <input
          autoFocus
          type="number"
          min="1"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          className={`${inputStyles} w-28 pl-6 py-1.5 font-mono`}
        />
      </label>
      <button type="submit" disabled={!valid} className={`${buttonStyles.primary} px-3 py-1.5`}>
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-textMuted hover:text-textLight px-1">
        Cancel
      </button>
    </form>
  );
}

/**
 * One budget in the list: name, amount left, status chip, spent / limit,
 * and a progress bar. Switches to LimitEditor when `editing` is true.
 *
 * @param {Object}  row      A row from budgetRows() (lib/finance.js)
 * @param {boolean} editing  Whether this row is being edited
 */
function BudgetRow({ row, editing, onEdit, onSave, onCancel, onRemove }) {
  const s = BUDGET_STATUS[row.status];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <CategoryIcon category={row.category} />
        <div className="flex-1 min-w-[10rem]">
          <p className="text-sm font-medium text-textLight">{row.category.label}</p>
          <p className="text-xs text-textMuted mt-0.5">
            {row.remaining >= 0
              ? `${formatCurrency(row.remaining)} left`
              : `${formatCurrency(-row.remaining)} over`}
          </p>
        </div>
        {editing ? (
          <LimitEditor initial={row.limit} onSave={onSave} onCancel={onCancel} />
        ) : (
          <div className="flex items-center gap-3">
            <StatusChip tone={STATUS_TONE[row.status]} icon={s.icon}>
              {s.label}
            </StatusChip>
            <span className="font-mono text-sm tabular-nums text-textLight">
              {formatCurrency(row.spent)}
              <span className="text-textMuted"> / {formatCurrency(row.limit)}</span>
            </span>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-textMuted hover:text-textLight hover:bg-raised"
              aria-label={`Edit ${row.category.label} budget`}
            >
              <Icon name="pencil" className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {/* role="progressbar" + aria values let screen readers announce the % used */}
        <div
          className="flex-1 h-2 rounded-full bg-charcoal border border-line overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(row.pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${row.category.label}: ${Math.round(row.pct)}% of budget used`}
        >
          <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, row.pct)}%` }} />
        </div>
        <span className={`w-10 text-right text-xs font-mono tabular-nums ${s.text}`}>{Math.round(row.pct)}%</span>
      </div>
      {editing && (
        <button onClick={onRemove} className="mt-3 text-xs text-textMuted hover:text-danger">
          Remove this budget
        </button>
      )}
    </li>
  );
}

/** Budget page component. */
export default function BudgetPage() {
  const { budgets, transactions, categories, currentMonth, setBudgetLimit, removeBudget } = useFinance();
  const [editing, setEditing] = useState(null); // categoryId being edited, or "new:<id>"

  // Budgets for this month, most-used first so problems are at the top
  const rows = budgetRows(budgets, transactions, currentMonth, categories).sort((a, b) => b.pct - a.pct);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const overCount = rows.filter((r) => r.status === "over").length;

  // Categories with no budget yet. Income and Uncategorized can't have a budget.
  const spent = spendingByCategory(transactions, currentMonth);
  const unbudgeted = categories.filter(
    (c) => c.id !== "income" && c.id !== "uncategorized" && !rows.some((r) => r.categoryId === c.id)
  );

  return (
    <div>
      <PageHeader title="Budget" description={`Monthly limits for ${formatMonth(currentMonth)}.`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">Budgeted</p>
          <p className="font-mono text-xl tabular-nums">{formatCurrency(totalLimit)}</p>
        </div>
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">Spent so far</p>
          <p className="font-mono text-xl tabular-nums">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">{totalLimit - totalSpent >= 0 ? "Remaining" : "Over"}</p>
          <p className={`font-mono text-xl tabular-nums ${totalLimit - totalSpent >= 0 ? "text-green" : "text-danger"}`}>
            {formatCurrency(Math.abs(totalLimit - totalSpent))}
          </p>
          {overCount > 0 && (
            <p className="text-xs text-danger mt-1 flex items-center gap-1">
              <Icon name="x" className="w-3 h-3" /> {overCount} {overCount === 1 ? "category" : "categories"} over
            </p>
          )}
        </div>
      </div>

      <Card title="Categories" padded={false}>
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <BudgetRow
              key={row.id}
              row={row}
              editing={editing === row.categoryId}
              onEdit={() => setEditing(row.categoryId)}
              onCancel={() => setEditing(null)}
              onSave={(limit) => {
                setBudgetLimit(row.categoryId, limit);
                setEditing(null);
              }}
              onRemove={() => {
                removeBudget(row.categoryId);
                setEditing(null);
              }}
            />
          ))}
        </ul>
      </Card>

      {unbudgeted.length > 0 && (
        <Card title="No budget yet" className="mt-6" padded={false}>
          <ul className="divide-y divide-line border-t border-line">
            {unbudgeted.map((c) => (
              <li key={c.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <CategoryIcon category={c} size="sm" />
                <div className="flex-1">
                  <p className="text-sm text-textLight">{c.label}</p>
                  <p className="text-xs text-textMuted">{formatCurrency(spent[c.id] || 0)} spent this month</p>
                </div>
                {editing === `new:${c.id}` ? (
                  <LimitEditor
                    // Suggested starting limit: this month's spending rounded up to $10, at least $50
                    initial={Math.max(50, Math.ceil((spent[c.id] || 0) / 10) * 10)}
                    onCancel={() => setEditing(null)}
                    onSave={(limit) => {
                      setBudgetLimit(c.id, limit);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <button onClick={() => setEditing(`new:${c.id}`)} className={buttonStyles.ghost}>
                    + Set budget
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
