/**
 * BudgetPage.jsx
 *
 * The "/budget" page: monthly spending limits per category.
 *   - One month at a time, like the home page: it opens on the newest month with
 *     transactions (never later than today), and arrows step through months.
 *     Everything on the page uses that shown month.
 *   - Three totals at the top: the budget, spent so far, and left to spend (or over).
 *     The budget is the shown month's money in; with no money in that month, it
 *     falls back to the total of the category limits.
 *   - Category limits are monthly amounts saved for the current month, so the same
 *     limits are compared with whichever month is shown.
 *   - A row per budget with a progress bar and status ("On track" / "Near limit" / "Over budget")
 *   - Click the pencil to edit a limit inline, or remove the budget
 *   - "No budget yet" lists categories without a limit, with a "+ Set budget" button
 *   - "Auto budget" spreads all of the month's money in over the categories, in
 *     proportion to past spending (suggestBudgets in lib/finance.js). The user can
 *     keep an amount for savings, which comes out of every category evenly. A
 *     preview shows the result before anything changes.
 *   - "+ New category" lets the user make their own category
 *
 * Status thresholds come from lib/finance.js (85% = near, over 100% = over).
 * Status is shown with an icon and a label, not just color (ui-constraints.md).
 *
 * Data: useFinance(). setBudgetLimit / removeBudget save to Firestore; addCategory updates local state
 * for now (later: Firestore).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card, CategoryIcon, EmptyState, MonthSwitcher, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import {
  BUDGET_STATUS,
  budgetIncome,
  budgetRows,
  latestMonthWithData,
  monthTotals,
  spendingByCategory,
  suggestBudgets,
} from "../lib/finance";
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
 * Preview of the Auto budget suggestion. Nothing changes until "Apply".
 * Shows money in, the savings field, and one row per category with the current
 * limit (or a dash), the suggested limit and why. Budgets for categories with no
 * recent spending are listed too, because Apply removes them.
 *
 * @param {Object}   suggestion   Result of suggestBudgets() (lib/finance.js)
 * @param {Object}   current      { [categoryId]: limit } for budgets that already exist
 * @param {string[]} removing     Category ids whose budgets Apply will remove
 * @param {Object[]} categories
 * @param {string}   savings      What's typed in the savings field
 * @param {string}   [savingsError]  Shown under the field; Apply is disabled while set
 * @param {(value: string) => void} onSavingsChange
 * @param {() => void} onApply
 * @param {() => void} onCancel
 */
function AutoBudgetPreview({
  suggestion,
  current,
  removing,
  categories,
  savings,
  savingsError,
  onSavingsChange,
  onApply,
  onCancel,
}) {
  const { rows, total, months, income, fromIncome, uncategorized } = suggestion;
  const catById = (id) => categories.find((c) => c.id === id);
  const monthNames = months.map((m) => formatMonth(m).split(" ")[0]).join(", ");
  return (
    <Card title="Suggested budget" className="mb-6" padded={false}>
      <p className="px-5 pb-3 text-sm text-textMuted">
        {fromIncome
          ? `All of your money in is split across your categories, based on how you spent in ${monthNames}. Want to save some? Enter it below and it comes out of every category evenly.`
          : `No money in yet, so each category gets what you usually spend there (from ${monthNames}). Once a deposit shows up, Auto budget will use your money in instead.`}
        {uncategorized > 0 && (
          <>
            {" "}
            <span className="text-warn">
              {formatCurrency(uncategorized)} of spending isn't categorized yet and wasn't included.
            </span>{" "}
            <Link to="/transactions" className="text-green hover:underline">
              Set categories
            </Link>
          </>
        )}
      </p>

      {fromIncome && (
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <div>
            <p className="text-xs text-textMuted mb-1">Money in</p>
            <p className="font-mono text-lg tabular-nums text-textLight">{formatCurrency(income)}</p>
          </div>
          <label className="block">
            <span className="block text-xs text-textMuted mb-1">Keep for savings (not budgeted)</span>
            <span className="relative block">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-textMuted">$</span>
              <input
                type="number"
                min="0"
                max={income}
                step="1"
                inputMode="numeric"
                value={savings}
                onChange={(e) => onSavingsChange(e.target.value)}
                placeholder="0"
                className={`${inputStyles} w-full pl-6 py-1.5 font-mono`}
                aria-invalid={Boolean(savingsError)}
              />
            </span>
            {savingsError && <span className="block text-xs text-danger mt-1">{savingsError}</span>}
          </label>
          <div>
            <p className="text-xs text-textMuted mb-1">Budgeted to categories</p>
            <p className="font-mono text-lg tabular-nums text-green">{formatCurrency(total)}</p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {rows.map((r) => (
          <li key={r.categoryId} className="px-5 py-3 flex flex-wrap items-center gap-3">
            <CategoryIcon category={catById(r.categoryId)} size="sm" />
            <div className="flex-1 min-w-[10rem]">
              <p className="text-sm text-textLight">{catById(r.categoryId)?.label}</p>
              <p className="text-xs text-textMuted">{r.reason}</p>
            </div>
            <span className="font-mono text-sm tabular-nums text-textMuted">
              {current[r.categoryId] ? formatCurrency(current[r.categoryId]) : "—"}
            </span>
            <span className="text-textMuted" aria-hidden="true">
              →
            </span>
            <span className="w-20 text-right font-mono text-sm tabular-nums text-green">{formatCurrency(r.limit)}</span>
          </li>
        ))}
        {removing.map((id) => (
          <li key={id} className="px-5 py-3 flex flex-wrap items-center gap-3">
            <CategoryIcon category={catById(id)} size="sm" />
            <div className="flex-1 min-w-[10rem]">
              <p className="text-sm text-textLight">{catById(id)?.label}</p>
              <p className="text-xs text-textMuted">No spending in {monthNames}, so this budget is removed</p>
            </div>
            <span className="font-mono text-sm tabular-nums text-textMuted">{formatCurrency(current[id])}</span>
            <span className="text-textMuted" aria-hidden="true">
              →
            </span>
            <span className="w-20 text-right text-sm text-textMuted">—</span>
          </li>
        ))}
      </ul>
      <div className="px-5 py-4 border-t border-line flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-textLight">
          Total: <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
          {fromIncome && suggestion.savings > 0 && (
            <span className="text-textMuted"> + {formatCurrency(suggestion.savings)} kept for savings</span>
          )}
        </p>
        <button type="button" onClick={onCancel} className={buttonStyles.secondary}>
          Cancel
        </button>
        <button type="button" onClick={onApply} disabled={Boolean(savingsError)} className={buttonStyles.primary}>
          Apply
        </button>
      </div>
    </Card>
  );
}

// Colors a new category can use (same family as the built-in chart colors)
const CATEGORY_COLORS = ["#E08A5B", "#4FB286", "#5B8DD6", "#A77BD6", "#D6B35B", "#D65B8D"];

/**
 * Small form for making a new category: a name (required, unique, up to 30
 * characters) and a color. The "already used" check ignores upper/lower case.
 *
 * @param {Object[]} categories  Existing categories, to catch duplicate names
 * @param {({label, color}) => void} onSave
 * @param {() => void} onCancel
 */
function NewCategoryForm({ categories, onSave, onCancel }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const name = label.trim();
  const taken = categories.some((c) => c.label.toLowerCase() === name.toLowerCase());
  const valid = name !== "" && !taken;

  return (
    <form
      className="px-5 py-4 border-t border-line flex flex-wrap items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ label: name, color });
      }}
    >
      <label className="flex-1 min-w-[12rem]">
        <span className="block text-xs text-textMuted mb-1">Category name</span>
        <input
          autoFocus
          maxLength={30}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          placeholder="e.g. Pets"
          className={`${inputStyles} w-full`}
        />
        {taken && <span className="block text-xs text-danger mt-1">You already have a category with that name.</span>}
      </label>
      <fieldset>
        <legend className="text-xs text-textMuted mb-1">Color</legend>
        <div className="flex gap-2 py-1.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-textLight" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!valid} className={buttonStyles.primary}>
          Add category
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-textMuted hover:text-textLight px-1">
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * One budget in the list: name, amount left, status chip, spent / limit,
 * and a progress bar. Switches to LimitEditor when `editing` is true.
 *
 * @param {Object}  row      A row from budgetRows() (lib/finance.js):
 *                           { id, categoryId, category, limit, spent, remaining, pct, status }
 * @param {boolean} editing  Whether this row is being edited
 * @param {() => void} onEdit                Opens the inline editor (pencil button)
 * @param {(limit: number) => void} onSave   Saves a new limit for this category
 * @param {() => void} onCancel              Closes the editor without saving
 * @param {() => void} onRemove              Deletes this budget (only shown while editing)
 */
function BudgetRow({ row, editing, onEdit, onSave, onCancel, onRemove }) {
  // Icon, label, and bar/text colors for this row's status (ok / near / over)
  const s = BUDGET_STATUS[row.status];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <CategoryIcon category={row.category} />
        <div className="flex-1 min-w-[10rem]">
          <p className="text-sm font-medium text-textLight">{row.category.label}</p>
          {/* remaining goes negative once spending passes the limit */}
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
          {/* Fill is capped at 100% so over-budget bars don't overflow; the % label still shows the real value */}
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

/**
 * Budget page component.
 *
 * Builds the page from the current month's budgets and transactions:
 * summary totals, the list of budgeted categories, and the categories
 * that don't have a budget yet. Only one limit can be edited at a time.
 */
export default function BudgetPage() {
  const { budgets, budgetsLoading, transactionsLoading, transactions, categories, currentMonth, profile, setBudgetLimit, removeBudget, addCategory } =
    useFinance();
  // Which editor is open: an existing budget's categoryId, "new:<categoryId>"
  // for a category in "No budget yet", or null when nothing is being edited
  const [editing, setEditing] = useState(null);
  // Month picked with the arrows; null = not picked yet, so open on the newest month with data
  const [pickedMonth, setPickedMonth] = useState(null);
  const month = pickedMonth ?? (latestMonthWithData(transactions, currentMonth) || currentMonth);
  const monthName = formatMonth(month).split(" ")[0];
  // Auto budget: whether the preview is open, what's typed in its savings field,
  // a note when there's nothing to go on, and the savings last applied (to label "unassigned")
  const [autoOpen, setAutoOpen] = useState(false);
  const [savingsInput, setSavingsInput] = useState("");
  // { text, link? } shown instead of the preview when Auto budget can't run
  const [autoNote, setAutoNote] = useState(null);
  const [appliedSavings, setAppliedSavings] = useState(0);
  const [addingCategory, setAddingCategory] = useState(false);

  // Limits are saved for the current month; like the home page, apply them to whichever month is shown
  const monthBudgets = budgets.filter((b) => b.month === currentMonth).map((b) => ({ ...b, month }));
  // Budgets for the shown month, most-used first so problems are at the top
  const rows = budgetRows(monthBudgets, transactions, month, categories).sort((a, b) => b.pct - a.pct);
  // Totals for the summary cards
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const overCount = rows.filter((r) => r.status === "over").length;

  // The budget is the money that came in during the shown month, or, if none did,
  // the monthly income from Settings (SCRUM-84)
  const thisMonth = monthTotals(transactions, month);
  const incomeBase = budgetIncome(thisMonth.income, profile.monthlyIncome);
  const income = incomeBase.amount;
  const fromIncome = incomeBase.source !== null;
  // With money in, every dollar out counts; without it, only spending in budgeted categories (as before)
  const budgetTotal = fromIncome ? income : totalLimit;
  const spentTotal = fromIncome ? thisMonth.spending : totalSpent;
  const leftToSpend = budgetTotal - spentTotal;
  const unassigned = income - totalLimit;

  // Spending per category in the shown month, used for the "No budget yet" list
  const spent = spendingByCategory(transactions, month);
  // Categories with no budget yet. Income, Transfer and Uncategorized can't have a budget.
  const unbudgeted = categories.filter(
    (c) => !["income", "transfers", "uncategorized"].includes(c.id) && !rows.some((r) => r.categoryId === c.id)
  );

  // Auto budget uses the same income as the totals above.
  // Recomputed on every render while open, so the preview follows the savings field live.
  const autoIncome = income;
  const savingsNum = savingsInput.trim() === "" ? 0 : Number(savingsInput);
  const savingsError =
    !Number.isFinite(savingsNum) || savingsNum < 0
      ? "Enter an amount of $0 or more."
      : savingsNum > autoIncome && autoIncome > 0
        ? `That's more than your money in (${formatCurrency(autoIncome)}).`
        : "";
  const suggestion = autoOpen
    ? suggestBudgets(transactions, month, categories, autoIncome, savingsError ? 0 : savingsNum)
    : null;
  // Existing budgets for categories the suggestion doesn't cover (no recent spending)
  const removing = suggestion
    ? rows.map((r) => r.categoryId).filter((id) => !suggestion.rows.some((x) => x.categoryId === id))
    : [];

  // Opens the Auto budget preview, or explains why it can't make one yet
  const openAutoBudget = () => {
    const { rows: suggested, uncategorized } = suggestBudgets(transactions, month, categories, autoIncome);
    if (suggested.length) {
      setAutoOpen(true);
      setSavingsInput("");
      setAutoNote(null);
      return;
    }
    setAutoOpen(false);
    if (transactions.length === 0) {
      setAutoNote({ text: "Auto budget learns from your spending. Import a bank statement first, then try again." });
    } else if (uncategorized > 0) {
      // Imports arrive uncategorized until categories are set, so there's nothing to split yet
      setAutoNote({
        text: "Your transactions don't have categories yet, so Auto budget can't split them. Set categories on the Transactions page, or wait for auto-categorization.",
        link: { to: "/transactions", label: "Go to Transactions" },
      });
    } else {
      setAutoNote({ text: `There's no spending in ${monthName} for Auto budget to learn from. Try another month with the arrows.` });
    }
  };

  // Saves every suggested limit (existing ones are updated, the rest created) and
  // removes budgets the suggestion doesn't cover, so the total matches the preview
  const applyAutoBudget = () => {
    for (const r of suggestion.rows) setBudgetLimit(r.categoryId, r.limit);
    for (const id of removing) removeBudget(id);
    setAppliedSavings(suggestion.savings);
    setAutoOpen(false);
    setEditing(null);
  };

  // Wait for Firestore, so a user with budgets doesn't see "No budgets set yet" for a moment
  if (budgetsLoading || transactionsLoading) {
    return (
      <p className="py-16 text-center text-sm text-textMuted" role="status">
        Loading your budgets…
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title="Budget"
        description={`Monthly limits, showing ${formatMonth(month)}.`}
        actions={
          <>
            <span className="text-sm text-textMuted mr-2">
              <MonthSwitcher
                month={month}
                maxMonth={currentMonth}
                onChange={(m) => {
                  setPickedMonth(m);
                  setAutoOpen(false); // the preview was for the old month
                  setAutoNote(null);
                }}
              />
            </span>
            <button type="button" onClick={openAutoBudget} className={buttonStyles.secondary}>
              <Icon name="sparkle" className="w-4 h-4 text-green" /> Auto budget
            </button>
          </>
        }
      />

      {autoNote && (
        <p className="mb-6 text-sm text-textMuted bg-surface border border-line rounded-lg px-4 py-3">
          {autoNote.text}
          {autoNote.link && (
            <>
              {" "}
              <Link to={autoNote.link.to} className="text-green hover:underline">
                {autoNote.link.label}
              </Link>
            </>
          )}
        </p>
      )}
      {suggestion && (
        <AutoBudgetPreview
          suggestion={suggestion}
          current={Object.fromEntries(rows.map((r) => [r.categoryId, r.limit]))}
          removing={removing}
          categories={categories}
          savings={savingsInput}
          savingsError={savingsError}
          onSavingsChange={setSavingsInput}
          onApply={applyAutoBudget}
          onCancel={() => setAutoOpen(false)}
        />
      )}

      {/* Summary cards: budget (money in), spent so far, left to spend (or over) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">
            {incomeBase.source === "money-in"
              ? "Budget (money in)"
              : incomeBase.source === "setting"
                ? "Budget (monthly income)"
                : "Budget (category limits)"}
          </p>
          <p className="font-mono text-xl tabular-nums">{formatCurrency(budgetTotal)}</p>
        </div>
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">Spent so far</p>
          <p className="font-mono text-xl tabular-nums">{formatCurrency(spentTotal)}</p>
        </div>
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-xs text-textMuted mb-2">{leftToSpend >= 0 ? "Left to spend" : "Over budget by"}</p>
          <p className={`font-mono text-xl tabular-nums ${leftToSpend >= 0 ? "text-green" : "text-danger"}`}>
            {formatCurrency(Math.abs(leftToSpend))}
          </p>
          {overCount > 0 && (
            <p className="text-xs text-danger mt-1 flex items-center gap-1">
              <Icon name="x" className="w-3 h-3" /> {overCount} {overCount === 1 ? "category" : "categories"} over
            </p>
          )}
        </div>
      </div>
      {/* How the money in compares to the category limits below */}
      <p className="mt-3 mb-6 text-sm text-textMuted">
        {!fromIncome
          ? `No money came in during ${monthName}, so the budget is your category limits added up. Set your monthly income in Settings to budget from that instead.`
          : unassigned >= 0
            ? `${formatCurrency(totalLimit)} of ${formatCurrency(income)} assigned to categories, ${formatCurrency(unassigned)} unassigned${
                unassigned > 0 && unassigned === appliedSavings ? " (savings)" : ""
              }.`
            : `Your category limits add up to ${formatCurrency(totalLimit)}, ${formatCurrency(-unassigned)} more than came in.`}
      </p>

      {/* Budgeted categories, highest % used first */}
      <Card title="Categories" padded={false}>
        {/* No budgets yet (SCRUM-87): say what to do next instead of showing an empty list */}
        {rows.length === 0 && (
          <EmptyState
            icon="budget"
            title="No budgets set yet"
            body={'Pick a category under "No budget yet" below and choose + Set budget, or let Auto budget suggest limits from your spending.'}
            action={
              <button type="button" onClick={openAutoBudget} className={buttonStyles.primary}>
                Try Auto budget
              </button>
            }
          />
        )}
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

      {/* Categories without a limit, plus the button for making a new category */}
      <Card
        title="No budget yet"
        className="mt-6"
        padded={false}
        action={
          !addingCategory && (
            <button type="button" onClick={() => setAddingCategory(true)} className={buttonStyles.ghost}>
              + New category
            </button>
          )
        }
      >
        {addingCategory && (
          <NewCategoryForm
            categories={categories}
            onCancel={() => setAddingCategory(false)}
            onSave={(fields) => {
              const created = addCategory(fields);
              setAddingCategory(false);
              // Open the limit editor for it right away
              if (created) setEditing(`new:${created.id}`);
            }}
          />
        )}
        {unbudgeted.length === 0 ? (
          <p className="px-5 py-4 border-t border-line text-sm text-textMuted">Every category has a budget.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {unbudgeted.map((c) => (
              <li key={c.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <CategoryIcon category={c} size="sm" />
                <div className="flex-1">
                  <p className="text-sm text-textLight">{c.label}</p>
                  <p className="text-xs text-textMuted">{formatCurrency(spent[c.id] || 0)} spent in {monthName}</p>
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
        )}
      </Card>
    </div>
  );
}
