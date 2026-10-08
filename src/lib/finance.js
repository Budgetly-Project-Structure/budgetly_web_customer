// Pure calculations over transactions/budgets. No React here so these are easy to unit test.

// Conventions used throughout:
//   - amount < 0 is spending, amount > 0 is income
//   - month is a "YYYY-MM" string and txn.date is "YYYY-MM-DD", so a startsWith() check finds a month

import { formatCurrency } from "./format";

// If the AI is less than 70% sure of a category, the transaction is flagged for review
export const LOW_CONFIDENCE = 0.7;

/** True if the transaction is in the given month ("2026-09"). */
export function inMonth(txn, month) {
  return txn.date.startsWith(month);
}

/**
 * True if a transaction should be checked by the user: it's uncategorized, or
 * the AI's confidence is under LOW_CONFIDENCE. Once the user picks a
 * category themselves, it never needs review again.
 */
export function needsReview(txn) {
  return !txn.isUserCorrected && (txn.category === "uncategorized" || txn.categoryConfidence < LOW_CONFIDENCE);
}

/** Moves a "YYYY-MM" month by n months: addMonths("2026-01", -1) → "2025-12" */
export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Adds up a month's money in and out.
 * @returns {{income: number, spending: number, net: number}} spending is a positive number
 */
export function monthTotals(transactions, month) {
  let income = 0;
  let spending = 0;
  for (const t of transactions) {
    if (!inMonth(t, month)) continue;
    if (t.amount > 0) income += t.amount;
    else spending += -t.amount;
  }
  return { income, spending, net: income - spending };
}

/** { [categoryId]: totalSpent } for spending transactions in a month. */
export function spendingByCategory(transactions, month) {
  const out = {};
  for (const t of transactions) {
    if (!inMonth(t, month) || t.amount >= 0) continue;
    out[t.category] = (out[t.category] || 0) + -t.amount;
  }
  return out;
}

// What each budget status looks like: label + icon (so it never relies on color alone)
// and the Tailwind classes for its text, progress bar and chip.
export const BUDGET_STATUS = {
  over: { label: "Over budget", icon: "x", text: "text-danger", bar: "bg-danger", chip: "bg-danger/10 text-danger border-danger/40" },
  near: { label: "Near limit", icon: "alert", text: "text-warn", bar: "bg-warn", chip: "bg-warn/10 text-warn border-warn/40" },
  ok: { label: "On track", icon: "check", text: "text-green", bar: "bg-green", chip: "bg-greenDim text-green border-green/40" },
};

/**
 * "over" if spent is more than the limit, "near" at 85% or more, otherwise "ok".
 * A budget with no limit counts as "ok".
 */
export function budgetStatus(spent, limit) {
  if (!limit) return "ok";
  const pct = spent / limit;
  if (pct > 1) return "over";
  if (pct >= 0.85) return "near";
  return "ok";
}

/** Budgets joined with actual spend for the month. */
export function budgetRows(budgets, transactions, month, categories) {
  // Each budget row gets: its category object, spent, remaining (negative = over),
  // pct (% of limit used) and status
  const spent = spendingByCategory(transactions, month);
  return budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const s = spent[b.categoryId] || 0;
      return {
        ...b,
        category: categories.find((c) => c.id === b.categoryId),
        spent: s,
        remaining: b.limit - s,
        pct: b.limit ? (s / b.limit) * 100 : 0,
        status: budgetStatus(s, b.limit),
      };
    });
}

// Auto budget groups. Fixed bills keep their full average; flexible spending
// (and any category the user made) is trimmed 10% so there's room to save.
const FIXED_CATEGORIES = ["housing", "rent", "utilities", "subscriptions", "insurance"];
const FLEXIBLE_CATEGORIES = ["dining", "shopping", "entertainment"];
// Not spending, so they never get a budget
const NO_BUDGET_CATEGORIES = ["income", "transfer", "transfers", "uncategorized"];
// Share of monthly income the auto budget may use; the rest is left for savings
const AUTO_BUDGET_INCOME_SHARE = 0.8;

const roundUpTo5 = (n) => Math.ceil(n / 5) * 5;
const roundTo5 = (n) => Math.max(5, Math.round(n / 5) * 5);

/**
 * Suggests a monthly limit per spending category from past spending ("Auto budget").
 * Plain math, no AI call, so it's free and the same input always gives the same answer.
 *
 * How it works:
 *   1. Looks at up to 3 of the most recent months before `month` that have spending.
 *      If there are none, it uses `month` itself.
 *   2. Averages each category's monthly spending over those months.
 *   3. Fixed bills (rent, utilities, subscriptions, insurance): average rounded up to $5.
 *      Flexible (dining, shopping, entertainment, custom categories): average minus 10%, rounded to $5.
 *      Everything else: average rounded up to $5.
 *   4. If the total is more than 80% of monthly income, flexible categories are scaled
 *      down so the total fits (fixed bills are never cut). Income is `monthlyIncome` when
 *      given, otherwise the average money in over the same months.
 *
 * @param {Object[]} transactions
 * @param {string}   month           "YYYY-MM" the budget is for
 * @param {Object[]} categories
 * @param {number}   [monthlyIncome]  Overrides the income worked out from transactions
 * @returns {{rows: {categoryId: string, average: number, limit: number, kind: "fixed"|"flexible"|"other", reason: string}[],
 *            total: number, months: string[], income: number, capped: boolean}}
 *          rows is empty when there's no spending to learn from
 */
export function suggestBudgets(transactions, month, categories, monthlyIncome) {
  // Months before `month` that have spending, newest first
  const pastMonths = [
    ...new Set(transactions.filter((t) => t.amount < 0 && t.date.slice(0, 7) < month).map((t) => t.date.slice(0, 7))),
  ]
    .sort()
    .reverse()
    .slice(0, 3);
  const months = pastMonths.length ? pastMonths : [month];

  // Average spending per category, and average income, over those months
  const totals = {};
  let incomeTotal = 0;
  for (const m of months) {
    for (const [id, amount] of Object.entries(spendingByCategory(transactions, m))) {
      totals[id] = (totals[id] || 0) + amount;
    }
    incomeTotal += monthTotals(transactions, m).income;
  }
  const income = monthlyIncome > 0 ? monthlyIncome : incomeTotal / months.length;
  const over = months.length === 1 ? "last month" : `${months.length} months`;
  const kindOf = (id) =>
    FIXED_CATEGORIES.includes(id) ? "fixed" : FLEXIBLE_CATEGORIES.includes(id) || id.startsWith("custom-") ? "flexible" : "other";

  const rows = categories
    .filter((c) => !NO_BUDGET_CATEGORIES.includes(c.id) && totals[c.id] > 0)
    .map((c) => {
      const average = totals[c.id] / months.length;
      const kind = kindOf(c.id);
      const avgText = `avg ${formatCurrency(average)} over ${over}`;
      return kind === "flexible"
        ? { categoryId: c.id, average, kind, limit: roundTo5(average * 0.9), reason: `${avgText}, trimmed 10%` }
        : { categoryId: c.id, average, kind, limit: roundUpTo5(average), reason: kind === "fixed" ? `${avgText}, a regular bill` : avgText };
    });

  // Keep the total under 80% of income by shrinking only the flexible categories
  const cap = income * AUTO_BUDGET_INCOME_SHARE;
  let total = rows.reduce((s, r) => s + r.limit, 0);
  let capped = false;
  const flexTotal = rows.filter((r) => r.kind === "flexible").reduce((s, r) => s + r.limit, 0);
  if (income > 0 && total > cap && flexTotal > 0) {
    const factor = Math.max(0, cap - (total - flexTotal)) / flexTotal;
    for (const r of rows) {
      if (r.kind !== "flexible") continue;
      r.limit = Math.max(5, Math.floor((r.limit * factor) / 5) * 5);
      r.reason = `avg ${formatCurrency(r.average)} over ${over}, cut to leave 20% of income for savings`;
    }
    total = rows.reduce((s, r) => s + r.limit, 0);
    capped = true;
  }

  return { rows, total, months, income, capped };
}

/**
 * Rule-based monthly insights. Stand-in for the AI-generated insights Cloud Function —
 * same output shape ({ id, tone, title, body }) so the UI won't change when that lands.
 */
export function generateInsights(transactions, month, prevMonth, categories, budgets) {
  // Spending per category this month and last month
  const cur = spendingByCategory(transactions, month);
  const prev = spendingByCategory(transactions, prevMonth);
  const label = (id) => categories.find((c) => c.id === id)?.label ?? id;
  const insights = [];

  // Insight 1 and 2: compare each category to last month. Categories under $20
  // last month are skipped, because a small base makes the % change misleading.
  // Sorted from biggest increase to biggest decrease.
  // Biggest % increase / decrease vs last month (ignore tiny categories)
  const changes = Object.keys({ ...cur, ...prev })
    .filter((id) => id !== "uncategorized" && (prev[id] || 0) >= 20 && (cur[id] || 0) >= 0)
    .map((id) => ({ id, pct: (((cur[id] || 0) - prev[id]) / prev[id]) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const up = changes[0];
  if (up && up.pct > 5) {
    insights.push({
      id: "up",
      tone: "warn",
      title: `${label(up.id)} is up ${Math.round(up.pct)}%`,
      body: `You've spent more on ${label(up.id).toLowerCase()} so far this month than in all of last month.`,
    });
  }
  const down = changes[changes.length - 1];
  if (down && down.pct < -5) {
    insights.push({
      id: "down",
      tone: "good",
      title: `${label(down.id)} is down ${Math.abs(Math.round(down.pct))}%`,
      body: `Nice — ${label(down.id).toLowerCase()} spending is well below last month's pace.`,
    });
  }

  // Insight 3: the merchant visited most this month (only if 3+ visits)
  // Top merchant by frequency
  const counts = {};
  for (const t of transactions) {
    if (inMonth(t, month) && t.amount < 0) counts[t.merchant] = (counts[t.merchant] || 0) + 1;
  }
  const [topMerchant, visits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  if (visits >= 3) {
    const total = transactions
      .filter((t) => inMonth(t, month) && t.merchant === topMerchant)
      .reduce((s, t) => s + -t.amount, 0);
    insights.push({
      id: "merchant",
      tone: "neutral",
      title: `${visits} trips to ${topMerchant}`,
      body: `That's $${total.toFixed(2)} this month — your most frequent merchant.`,
    });
  }

  // Insight 4: list every category that's over budget
  // Over-budget categories
  const over = budgetRows(budgets, transactions, month, categories).filter((r) => r.status === "over");
  if (over.length) {
    insights.push({
      id: "over",
      tone: "warn",
      title: `${over.length} ${over.length === 1 ? "category is" : "categories are"} over budget`,
      body: over.map((r) => `${r.category.label} (+$${Math.abs(r.remaining).toFixed(0)})`).join(", "),
    });
  }

  return insights;
}

/**
 * Tiny keyword matcher for "How much did I spend on X?" — placeholder for the
 * natural-language query Cloud Function. Returns null if it can't answer.
 */
export function answerSpendingQuestion(question, transactions, month, categories) {
  // Tried in this order; the first match wins:
  //   1. A category name in the question ("dining", "groceries"). "restaurant",
  //      "eating out" and "food" also count as dining.
  //   2. A nickname: coffee → Starbucks, gas → Shell/QuikTrip, amazon → Amazon
  //   3. The first word of a merchant name ("target" matches "Target T-1123")
  // Only this month's spending is searched. Returns { total, count, subject }.
  const q = question.toLowerCase();
  const monthTx = transactions.filter((t) => inMonth(t, month) && t.amount < 0);

  const cat = categories.find(
    (c) => q.includes(c.label.toLowerCase()) || q.includes(c.id) || (c.id === "dining" && /(restaurant|eating out|food)/.test(q))
  );
  if (cat) {
    const list = monthTx.filter((t) => t.category === cat.id);
    const total = list.reduce((s, t) => s + -t.amount, 0);
    return { total, count: list.length, subject: cat.label };
  }

  const aliases = { coffee: "starbucks", gas: "shell|quiktrip", amazon: "amazon" };
  for (const [word, pattern] of Object.entries(aliases)) {
    if (q.includes(word)) {
      const re = new RegExp(pattern, "i");
      const list = monthTx.filter((t) => re.test(t.merchant));
      return { total: list.reduce((s, t) => s + -t.amount, 0), count: list.length, subject: word };
    }
  }

  const merchant = [...new Set(monthTx.map((t) => t.merchant))].find((m) =>
    q.includes(m.toLowerCase().split(" ")[0])
  );
  if (merchant) {
    const key = merchant.toLowerCase().split(" ")[0];
    const list = monthTx.filter((t) => t.merchant.toLowerCase().startsWith(key));
    return { total: list.reduce((s, t) => s + -t.amount, 0), count: list.length, subject: merchant };
  }
  return null;
}
