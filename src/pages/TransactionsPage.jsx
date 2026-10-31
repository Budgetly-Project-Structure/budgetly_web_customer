/**
 * TransactionsPage.jsx
 *
 * The "/transactions" page: every imported transaction, with
 *   - search by merchant, and filters for month, category and type (spending/income)
 *   - a "Needs review" toggle for transactions the AI wasn't confident about
 *   - sortable columns (date, merchant, amount)
 *   - a category dropdown on every row, so fixing a category is one click + one choice
 *
 * Layout: a table on desktop and a card list on phones. ui-constraints.md says to
 * design each separately instead of squeezing the table onto a small screen.
 *
 * The "review" filter is stored in the URL (?review=1) so the Home page's
 * "Review now" button can link straight to the filtered list.
 *
 * Manual transactions (SCRUM-86): "Add transaction" opens a form to enter one by hand
 * (saved with source "manual"). Those rows get Edit and Delete buttons; imported
 * rows only get the category dropdown, since the statement is their source of truth.
 *
 * Inline category edit (SCRUM-77): picking a category saves it right away
 * (updateTransactionCategory, a Firestore update that marks it isUserCorrected),
 * shows "Saving…" and a message if it fails, and then offers to give the other
 * transactions from the same merchant the same category in one click.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import ManualTransactionForm from "../components/ManualTransactionForm";
import { Card, CategoryIcon, EmptyState, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { useToast } from "../components/ToastContext";
import { isTransfer, needsReview } from "../lib/finance";
import { formatAmount, formatDate, formatMonth, maskAccount } from "../lib/format";

/**
 * The category dropdown shown on each transaction. Correcting a category is one
 * click + one choice (ui-constraints.md). Adds a "Review" chip if the category is
 * low-confidence, and "Edited" if the user already changed it.
 *
 * After a change it offers "Also set N more": the other transactions from the
 * same merchant that the user hasn't set themselves and that aren't in that
 * category yet.
 *
 * @param {Object}   txn         The transaction
 * @param {Object[]} categories  All categories (for the options)
 * @param {(id: string, category: string) => Promise<void>} onChange  Saves one; throws on failure
 * @param {(txn: Object) => Object[]} sameMerchant  Other transactions with this merchant
 */
function CategorySelect({ txn, categories, onChange, sameMerchant }) {
  const flagged = needsReview(txn);
  // null, "saving", an error message, or { category, others } to offer the same change
  const [status, setStatus] = useState(null);

  async function change(category) {
    setStatus("saving");
    try {
      await onChange(txn.id, category);
      const others = sameMerchant(txn).filter((o) => !o.isUserCorrected && o.category !== category);
      setStatus(others.length ? { category, others } : null);
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function applyToOthers() {
    const { category, others } = status;
    setStatus("saving");
    // Each one is its own small update, so one failure doesn't stop the rest
    const results = await Promise.allSettled(others.map((o) => onChange(o.id, category)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setStatus(failed ? `${failed} of ${others.length} couldn't be saved. Try again.` : null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={txn.category}
        onChange={(e) => change(e.target.value)}
        disabled={status === "saving"}
        aria-label={`Category for ${txn.merchant}`}
        className={`bg-charcoal border rounded-md pl-2 pr-7 py-1 text-sm text-textLight focus:outline-none focus:border-green cursor-pointer ${
          flagged ? "border-warn/60" : "border-line hover:border-textMuted"
        }`}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {flagged && (
        <StatusChip tone="warn" icon="alert">
          Review
        </StatusChip>
      )}
      {txn.isUserCorrected && status === null && (
        <span className="text-xs text-textMuted" title="You set this category">
          Edited
        </span>
      )}
      {status === "saving" && (
        <span className="text-xs text-textMuted" role="status">
          Saving…
        </span>
      )}
      {typeof status === "string" && status !== "saving" && (
        <span className="text-xs text-danger" role="alert">
          {status}
        </span>
      )}
      {status?.others && (
        <span className="flex items-center gap-2 text-xs">
          <button type="button" onClick={applyToOthers} className="text-green hover:underline">
            Also set {status.others.length} more from this merchant
          </button>
          <button type="button" onClick={() => setStatus(null)} className="text-textMuted hover:text-textLight" aria-label="No thanks">
            ✕
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * A clickable column header that sorts the table.
 * First click sorts descending; clicking the active column again flips the direction.
 *
 * @param {string} field  Which field this column sorts by ("date" | "merchant" | "amount")
 * @param {{field: string, dir: "asc"|"desc"}} sort  Current sort
 */
function SortHeader({ label, field, sort, setSort, align = "left" }) {
  const active = sort.field === field;
  return (
    <th scope="col" className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => setSort({ field, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
        className={`inline-flex items-center gap-1 hover:text-textLight ${active ? "text-textLight" : ""}`}
      >
        {label}
        {active && <Icon name={sort.dir === "desc" ? "arrowDown" : "arrowUp"} className="w-3 h-3" />}
      </button>
    </th>
  );
}

/** Transactions page component. */
export default function TransactionsPage() {
  const {
    transactions,
    transactionsLoading,
    transactionsError,
    categories,
    accounts,
    currentMonth,
    previousMonth,
    updateTransactionCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
  } = useFinance();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  // Transactions grouped by merchant text, for "Also set N more from this merchant"
  const byMerchant = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      if (!map.has(t.merchant)) map.set(t.merchant, []);
      map.get(t.merchant).push(t);
    }
    return map;
  }, [transactions]);
  const sameMerchant = (txn) => (byMerchant.get(txn.merchant) ?? []).filter((o) => o.id !== txn.id);

  // Filter and sort state. Month defaults to the current month; newest first.
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  // Manual transactions: the form is open to add (adding) or to edit one (editing = that
  // transaction); confirmDeleteId is the row showing "Delete? Yes / No"
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);
  // "Needs review" lives in the URL instead of state (see header comment)
  const reviewOnly = params.get("review") === "1";

  // Turns ?review=1 on or off. replace:true so toggling doesn't fill up browser history.
  const setReviewOnly = (on) => {
    const next = new URLSearchParams(params);
    if (on) next.set("review", "1");
    else next.delete("review");
    setParams(next, { replace: true });
  };

  // Lookups from ids to full objects (for icons, labels, masked account numbers)
  const catById = (id) => categories.find((c) => c.id === id);
  const acctById = (id) => accounts.find((a) => a.id === id);

  // Apply every filter, then sort. useMemo re-runs this only when an input changes.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = transactions.filter((t) => {
      if (month !== "all" && !t.date.startsWith(month)) return false;
      if (category !== "all" && t.category !== category) return false;
      if (type === "spending" && t.amount >= 0) return false;
      if (type === "income" && t.amount < 0) return false;
      if (reviewOnly && !needsReview(t)) return false;
      if (q && !t.merchant.toLowerCase().includes(q)) return false;
      return true;
    });
    // dir flips the comparison for ascending vs descending.
    // Amount sorts by size (ignoring sign); date ties are broken by id so the order is stable.
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.field === "amount") return (Math.abs(a.amount) - Math.abs(b.amount)) * dir;
      if (sort.field === "merchant") return a.merchant.localeCompare(b.merchant) * dir;
      return a.date.localeCompare(b.date) * dir || a.id.localeCompare(b.id) * dir;
    });
  }, [transactions, query, month, category, type, reviewOnly, sort]);

  // Sum of what's on screen (shown as "net" above the table). Transfers (card payments,
  // moving money between your own accounts) are left out, the same as on the dashboard,
  // unless you're looking at the Transfer category on purpose.
  const skipTransfers = category !== "transfers";
  const net = filtered.reduce((s, t) => (skipTransfers && isTransfer(t) ? s : s + t.amount), 0);
  const transfersLeftOut = skipTransfers && filtered.some(isTransfer);
  // Count for the "Needs review (N)" button, for the selected month regardless of other filters
  const reviewTotal = transactions.filter((t) => (month === "all" || t.date.startsWith(month)) && needsReview(t)).length;
  const hasFilters = query || category !== "all" || type !== "all" || reviewOnly;

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setType("all");
    setReviewOnly(false);
  };

  // Saves the form. After saving, show all months so the new or moved transaction
  // can't end up hidden by the month filter.
  const saveManual = async (values) => {
    if (editing) await updateTransaction(editing.id, values);
    else await addTransaction(values);
    setMonth("all");
    setAdding(false);
    setEditing(null);
  };

  const removeManual = async (id) => {
    setRowError(null);
    const name = transactions.find((t) => t.id === id)?.merchant;
    try {
      await deleteTransaction(id);
      // Deleting is a soft delete, so Undo just restores it
      showToast({
        message: name ? `Deleted "${name}"` : "Transaction deleted",
        actionLabel: "Undo",
        onAction: () => restoreTransaction(id),
      });
    } catch (err) {
      setRowError(err.message);
    }
    setConfirmDeleteId(null);
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
  };
  // "Add" opens the form at the top (that's where its button is). "Edit" opens it right
  // on the row being edited, so it's never out of sight on a long list.
  const showForm = adding;
  const addButton = (
    <button
      onClick={() => {
        setEditing(null);
        setAdding(true);
      }}
      className={buttonStyles.secondary}
    >
      + Add transaction
    </button>
  );
  const form = showForm && (
    <ManualTransactionForm key="new" categories={categories} accounts={accounts} onSave={saveManual} onCancel={closeForm} />
  );
  // The same form, in place of the row being edited
  const editForm = editing && (
    <ManualTransactionForm
      key={editing.id}
      inline
      initial={editing}
      categories={categories}
      accounts={accounts}
      onSave={saveManual}
      onCancel={closeForm}
    />
  );

  // Loading / error / "no data yet" come before the filters: with nothing imported,
  // search and filters have nothing to work on. (All hooks above run on every render.)
  if (transactionsLoading || transactionsError || transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Transactions" description="Everything from your imported statements." />
        {!transactionsLoading && !transactionsError && form}
        <Card>
          {transactionsLoading ? (
            <p className="py-12 text-center text-sm text-textMuted" role="status">
              Loading your transactions…
            </p>
          ) : transactionsError ? (
            <EmptyState icon="alert" title="We couldn't load your transactions" body={transactionsError} />
          ) : (
            <EmptyState
              icon="upload"
              title="No transactions yet"
              body="Import a CSV or PDF bank statement and your transactions will show up here."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link to="/import" className={buttonStyles.primary}>
                    Import a statement
                  </Link>
                  {addButton}
                </div>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  /** Edit / Delete for a manual transaction (nothing for imported ones). Delete asks first. */
  const ManualActions = ({ txn }) => {
    if (txn.source !== "manual") return null;
    if (confirmDeleteId === txn.id) {
      return (
        <span className="inline-flex items-center gap-2 text-xs mt-2 md:mt-0">
          <span className="text-textMuted">Delete this?</span>
          <button onClick={() => removeManual(txn.id)} className="text-danger hover:underline">
            Yes, delete
          </button>
          <button onClick={() => setConfirmDeleteId(null)} className="text-textMuted hover:text-textLight">
            Cancel
          </button>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-3 text-xs mt-2 md:mt-0">
        <button
          onClick={() => {
            setAdding(false);
            setEditing(txn);
          }}
          aria-label={`Edit ${txn.merchant}`}
          className="text-textMuted hover:text-textLight"
        >
          Edit
        </button>
        <button onClick={() => setConfirmDeleteId(txn.id)} aria-label={`Delete ${txn.merchant}`} className="text-textMuted hover:text-danger">
          Delete
        </button>
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Everything from your imported statements, plus any you add yourself. Change a category and it's remembered."
        actions={addButton}
      />

      {form}
      {rowError && (
        <p role="alert" className="text-sm text-danger mb-3">
          {rowError}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <span className="sr-only">Search merchants</span>
          <Icon name="search" className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search merchants"
            className={`${inputStyles} w-full pl-9`}
          />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:flex">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputStyles} col-span-2 sm:col-span-1`} aria-label="Month">
            <option value={currentMonth}>{formatMonth(currentMonth)}</option>
            <option value={previousMonth}>{formatMonth(previousMonth)}</option>
            <option value="all">All time</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputStyles} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputStyles} aria-label="Type">
            <option value="all">All types</option>
            <option value="spending">Spending</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setReviewOnly(!reviewOnly)}
          aria-pressed={reviewOnly}
          className={`inline-flex items-center gap-2 text-sm rounded-full border px-3 py-1 transition-colors ${
            reviewOnly ? "bg-warn/10 border-warn/60 text-warn" : "border-line text-textMuted hover:text-textLight"
          }`}
        >
          <Icon name={reviewOnly ? "check" : "alert"} className="w-3.5 h-3.5" />
          Needs review ({reviewTotal})
        </button>
        <p className="text-sm text-textMuted">
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"} · net{" "}
          <span className={`font-mono tabular-nums ${net >= 0 ? "text-green" : "text-textLight"}`}>{formatAmount(net)}</span>
          {transfersLeftOut && <span> (transfers not counted)</span>}
        </p>
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title={reviewOnly ? "Nothing left to review" : "No transactions match"}
            body={reviewOnly ? "Every transaction has a confident category." : "Try a different search or clear the filters."}
            action={
              hasFilters && (
                <button onClick={clearFilters} className={buttonStyles.secondary}>
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-textMuted border-b border-line">
                  <tr>
                    <SortHeader label="Date" field="date" sort={sort} setSort={setSort} />
                    <SortHeader label="Merchant" field="merchant" sort={sort} setSort={setSort} />
                    <th scope="col" className="px-4 py-3 font-medium text-left">Category</th>
                    <th scope="col" className="px-4 py-3 font-medium text-left">Account</th>
                    <SortHeader label="Amount" field="amount" sort={sort} setSort={setSort} align="right" />
                    <th scope="col" className="px-4 py-3 font-medium text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((t) => {
                    const acct = acctById(t.accountId);
                    if (editing?.id === t.id) {
                      return (
                        <tr key={t.id}>
                          <td colSpan={6} className="px-4 py-3">
                            {editForm}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={t.id} className="hover:bg-raised/60">
                        <td className="px-4 py-2.5 text-textMuted whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <CategoryIcon category={catById(t.category)} size="sm" />
                            <span className="text-textLight">{t.merchant}</span>
                            {t.source === "manual" && <span className="text-xs text-textMuted border border-line rounded px-1">Manual</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <CategorySelect txn={t} categories={categories} onChange={updateTransactionCategory} sameMerchant={sameMerchant} />
                        </td>
                        <td className="px-4 py-2.5 text-textMuted whitespace-nowrap">
                          {acct?.name} <span className="font-mono text-xs">{maskAccount(acct?.last4)}</span>
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                            t.amount > 0 ? "text-green" : "text-textLight"
                          }`}
                        >
                          {formatAmount(t.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <ManualActions txn={t} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="md:hidden divide-y divide-line">
              {filtered.map((t) =>
                editing?.id === t.id ? (
                  <li key={t.id} className="p-4">
                    {editForm}
                  </li>
                ) : (
                <li key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm text-textLight truncate">{t.merchant}</p>
                      <p className="text-xs text-textMuted">
                        {formatDate(t.date)} · {maskAccount(acctById(t.accountId)?.last4)}
                      </p>
                    </div>
                    <span className={`font-mono text-sm tabular-nums ${t.amount > 0 ? "text-green" : "text-textLight"}`}>
                      {formatAmount(t.amount)}
                    </span>
                  </div>
                  <CategorySelect txn={t} categories={categories} onChange={updateTransactionCategory} sameMerchant={sameMerchant} />
                  <ManualActions txn={t} />
                </li>
                )
              )}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
