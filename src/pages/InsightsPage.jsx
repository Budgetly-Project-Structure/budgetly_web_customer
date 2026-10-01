import { useState } from "react";
import Icon from "../components/Icon";
import { Card, PageHeader, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { answerSpendingQuestion, generateInsights, spendingByCategory } from "../lib/finance";
import { formatCurrency, formatMonth } from "../lib/format";

const TONE = {
  warn: { icon: "arrowUp", cls: "text-warn" },
  good: { icon: "arrowDown", cls: "text-green" },
  neutral: { icon: "sparkle", cls: "text-textMuted" },
};

const EXAMPLES = [
  "How much did I spend on coffee?",
  "How much on groceries?",
  "What did I spend at Amazon?",
];

/**
 * Grouped horizontal bars: this month vs last month per category.
 * Two series → legend + value labels so identity never relies on color alone.
 */
function CategoryComparisonChart({ rows, currentLabel, previousLabel }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.current, r.previous]));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-textMuted mb-4" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-seriesCurrent" /> {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-seriesPrevious" /> {previousLabel}
        </span>
      </div>
      <ul className="space-y-4">
        {rows.map((r) => {
          const diff = r.current - r.previous;
          return (
            <li
              key={r.id}
              className="relative grid grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr] items-center gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-raised/60"
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="text-sm text-textLight truncate">{r.label}</span>
              <div className="space-y-0.5">
                {[
                  { v: r.current, cls: "bg-seriesCurrent" },
                  { v: r.previous, cls: "bg-seriesPrevious" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 h-3.5">
                    <div
                      className={`h-full rounded-r ${s.cls}`}
                      style={{ width: `${(s.v / max) * 85}%`, minWidth: s.v > 0 ? 3 : 0 }}
                    />
                    <span className="font-mono text-[11px] text-textMuted tabular-nums">{formatCurrency(s.v)}</span>
                  </div>
                ))}
              </div>
              {hover === r.id && (
                <div className="absolute right-2 -top-2 z-10 bg-charcoal border border-line rounded-md px-3 py-2 text-xs shadow-lg pointer-events-none">
                  <p className="text-textLight font-medium mb-1">{r.label}</p>
                  <p className="text-textMuted">
                    {currentLabel}: <span className="text-textLight font-mono">{formatCurrency(r.current)}</span>
                  </p>
                  <p className="text-textMuted">
                    {previousLabel}: <span className="text-textLight font-mono">{formatCurrency(r.previous)}</span>
                  </p>
                  <p className={diff > 0 ? "text-warn" : "text-green"}>
                    {diff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(diff))}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function InsightsPage() {
  const { transactions, categories, budgets, currentMonth, previousMonth } = useFinance();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const insights = generateInsights(transactions, currentMonth, previousMonth, categories, budgets);
  const cur = spendingByCategory(transactions, currentMonth);
  const prev = spendingByCategory(transactions, previousMonth);
  const chartRows = categories
    .filter((c) => c.id !== "income" && ((cur[c.id] || 0) > 0 || (prev[c.id] || 0) > 0))
    .map((c) => ({ id: c.id, label: c.label, current: cur[c.id] || 0, previous: prev[c.id] || 0 }))
    .sort((a, b) => b.current - a.current);

  const currentLabel = formatMonth(currentMonth).split(" ")[0];
  const previousLabel = formatMonth(previousMonth).split(" ")[0];

  function ask(q) {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    const res = answerSpendingQuestion(text, transactions, currentMonth, categories);
    setAnswer({ q: text, res });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description={`What stands out in ${formatMonth(currentMonth)} so far.`} />

      {/* Ask a question */}
      <Card>
        <div className="pt-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <label className="relative flex-1">
              <span className="sr-only">Ask about your spending</span>
              <Icon name="sparkle" className="w-4 h-4 text-green absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your spending…"
                className={`${inputStyles} w-full pl-9`}
              />
            </label>
            <button type="submit" className={buttonStyles.primary}>
              Ask
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="text-xs text-textMuted border border-line rounded-full px-3 py-1 hover:text-textLight hover:border-textMuted"
              >
                {ex}
              </button>
            ))}
          </div>
          {answer && (
            <div className="mt-4 bg-charcoal border border-line rounded-md p-4" aria-live="polite">
              <p className="text-xs text-textMuted mb-1">“{answer.q}”</p>
              {answer.res ? (
                <p className="text-sm text-textLight">
                  You spent{" "}
                  <span className="font-mono text-green">{formatCurrency(answer.res.total, { cents: true })}</span> on{" "}
                  {answer.res.subject} across {answer.res.count} transaction{answer.res.count === 1 ? "" : "s"} in{" "}
                  {formatMonth(currentMonth)}.
                </p>
              ) : (
                <p className="text-sm text-textMuted">
                  I couldn't match that to a category or merchant yet. Try naming a category like “dining” or a store.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Insight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map((ins) => {
          const t = TONE[ins.tone] || TONE.neutral;
          return (
            <div key={ins.id} className="bg-surface border border-line rounded-lg p-5">
              <p className={`flex items-center gap-1.5 text-sm font-medium ${t.cls}`}>
                <Icon name={t.icon} className="w-4 h-4" />
                <span className="text-textLight">{ins.title}</span>
              </p>
              <p className="text-sm text-textMuted mt-1.5">{ins.body}</p>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <Card
        title={`Spending by category — ${currentLabel} vs ${previousLabel}`}
        action={
          <button onClick={() => setShowTable((v) => !v)} className={buttonStyles.ghost}>
            {showTable ? "Show chart" : "Show table"}
          </button>
        }
      >
        {showTable ? (
          <table className="w-full text-sm">
            <thead className="text-xs text-textMuted border-b border-line">
              <tr>
                <th className="text-left font-medium py-2">Category</th>
                <th className="text-right font-medium py-2">{currentLabel}</th>
                <th className="text-right font-medium py-2">{previousLabel}</th>
                <th className="text-right font-medium py-2">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {chartRows.map((r) => {
                const d = r.current - r.previous;
                return (
                  <tr key={r.id}>
                    <td className="py-2 text-textLight">{r.label}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatCurrency(r.current)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-textMuted">{formatCurrency(r.previous)}</td>
                    <td className={`py-2 text-right font-mono tabular-nums ${d > 0 ? "text-warn" : "text-green"}`}>
                      {d > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(d))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <CategoryComparisonChart rows={chartRows} currentLabel={currentLabel} previousLabel={previousLabel} />
        )}
        <p className="text-xs text-textMuted mt-4">
          {currentLabel} is month-to-date; {previousLabel} is the full month.
        </p>
      </Card>
    </div>
  );
}
