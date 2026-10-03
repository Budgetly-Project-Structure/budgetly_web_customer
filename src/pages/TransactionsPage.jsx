import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import { Card, CategoryIcon, EmptyState, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { needsReview } from "../lib/finance";
import { formatAmount, formatDate, formatMonth, maskAccount } from "../lib/format";

/** Inline category picker — correcting a category is one click + one choice (ui-constraints.md). */
function CategorySelect({ txn, categories, onChange }) {
  const flagged = needsReview(txn);
  return (
    <div className="flex items-center gap-2">
      <select
        value={txn.category}
        onChange={(e) => onChange(txn.id, e.target.value)}
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
      {txn.isUserCorrected && (
        <span className="text-xs text-textMuted" title="You set this category">
          Edited
        </span>
      )}
    </div>
  );
}

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

export default function TransactionsPage() {
  const { transactions, transactionsLoading, transactionsError, categories, accounts, currentMonth, previousMonth, updateTransactionCategory } =
    useFinance();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  const reviewOnly = params.get("review") === "1";

  const setReviewOnly = (on) => {
    const next = new URLSearchParams(params);
    if (on) next.set("review", "1");
    else next.delete("review");
    setParams(next, { replace: true });
  };

  const catById = (id) => categories.find((c) => c.id === id);
  const acctById = (id) => accounts.find((a) => a.id === id);

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
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.field === "amount") return (Math.abs(a.amount) - Math.abs(b.amount)) * dir;
      if (sort.field === "merchant") return a.merchant.localeCompare(b.merchant) * dir;
      return a.date.localeCompare(b.date) * dir || a.id.localeCompare(b.id) * dir;
    });
  }, [transactions, query, month, category, type, reviewOnly, sort]);

  const net = filtered.reduce((s, t) => s + t.amount, 0);
  const reviewTotal = transactions.filter((t) => (month === "all" || t.date.startsWith(month)) && needsReview(t)).length;
  const hasFilters = query || category !== "all" || type !== "all" || reviewOnly;

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setType("all");
    setReviewOnly(false);
  };

  // Loading / error / "no data yet" come before the filters: with nothing imported,
  // search and filters have nothing to work on. (All hooks above run on every render.)
  if (transactionsLoading || transactionsError || transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Transactions" description="Everything from your imported statements." />
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
                <Link to="/import" className={buttonStyles.primary}>
                  Import a statement
                </Link>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Everything from your imported statements. Change a category and it's remembered."
      />

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
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((t) => {
                    const acct = acctById(t.accountId);
                    return (
                      <tr key={t.id} className="hover:bg-raised/60">
                        <td className="px-4 py-2.5 text-textMuted whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <CategoryIcon category={catById(t.category)} size="sm" />
                            <span className="text-textLight">{t.merchant}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <CategorySelect txn={t} categories={categories} onChange={updateTransactionCategory} />
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="md:hidden divide-y divide-line">
              {filtered.map((t) => (
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
                  <CategorySelect txn={t} categories={categories} onChange={updateTransactionCategory} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
