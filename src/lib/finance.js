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
 * The month a page should open on: the newest month that has transactions, but
 * never later than `currentMonth` (today). "" when there are no transactions.
 * The home and Budget pages both use this, so they always open on the same month.
 */
export function latestMonthWithData(transactions, currentMonth) {
  return transactions
    .map((t) => t.date.slice(0, 7))
    .filter((m) => m <= currentMonth)
    .reduce((a, b) => (b > a ? b : a), "");
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

// Not spending, so they never get a budget
const NO_BUDGET_CATEGORIES = ["income", "transfer", "transfers", "uncategorized"];

const roundTo5 = (n) => Math.round(n / 5) * 5;

/**
 * Takes `amount` dollars out of the rows as evenly as possible: the same amount
 * from each, never below $0. A row that hits $0 stops there, and the rest of its
 * share is split evenly over the rows that still have money. Changes rows in place.
 */
function takeEvenly(rows, amount) {
  let left = amount;
  for (;;) {
    const open = rows.filter((r) => r.limit > 0);
    if (left <= 0 || open.length === 0) break;
    // Whole dollars; the first few rows give $1 more when it doesn't divide evenly
    const share = Math.floor(left / open.length);
    let extra = left - share * open.length;
    for (const r of open) {
      const want = share + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      const take = Math.min(want, r.limit);
      r.limit -= take;
      r.savingsCut += take;
      left -= take;
    }
  }
}

/**
 * Suggests a monthly limit per spending category ("Auto budget"). Plain math,
 * no AI call, so it's free and the same input always gives the same answer.
 *
 * How it works:
 *   1. Looks at up to 3 of the most recent months before `month` that have spending.
 *      If there are none, it uses `month` itself. Averages each category's spending.
 *   2. Spreads ALL of the money in over the categories, in proportion to what you
 *      usually spend in each. Limits are rounded to $5, and the rounding difference
 *      goes on the biggest category so the limits add up to exactly the money in.
 *   3. `savings` (optional) is taken out of the categories evenly: the same dollar
 *      amount from each, none going below $0. So the limits add up to money in - savings.
 *   With no money in at all, each category just gets its average (rounded up to $5).
 *
 * @param {Object[]} transactions
 * @param {string}   month            "YYYY-MM" the budget is for
 * @param {Object[]} categories
 * @param {number}   [monthlyIncome]  Money in to budget. If not given (or 0), the average
 *                                    money in over the same months is used
 * @param {number}   [savings=0]      Dollars to keep for savings instead of budgeting
 * @returns {{rows: {categoryId: string, average: number, limit: number, reason: string}[],
 *            total: number, months: string[], income: number, savings: number, fromIncome: boolean}}
 *          rows is empty when there's no spending to learn from
 */
export function suggestBudgets(transactions, month, categories, monthlyIncome, savings = 0) {
  // Months before `month` that have spending, newest first
  const pastMonths = [
    ...new Set(transactions.filter((t) => t.amount < 0 && t.date.slice(0, 7) < month).map((t) => t.date.slice(0, 7))),
  ]
    .sort()
    .reverse()
    .slice(0, 3);
  const months = pastMonths.length ? pastMonths : [month];

  // Total spending per category, and total income, over those months
  const totals = {};
  let incomeTotal = 0;
  for (const m of months) {
    for (const [id, amount] of Object.entries(spendingByCategory(transactions, m))) {
      totals[id] = (totals[id] || 0) + amount;
    }
    incomeTotal += monthTotals(transactions, m).income;
  }
  const income = Math.round(monthlyIncome > 0 ? monthlyIncome : incomeTotal / months.length);
  const over = months.length === 1 ? "last month" : `${months.length} months`;

  const rows = categories
    .filter((c) => !NO_BUDGET_CATEGORIES.includes(c.id) && totals[c.id] > 0)
    .map((c) => ({ categoryId: c.id, average: totals[c.id] / months.length, limit: 0, savingsCut: 0 }));
  if (rows.length === 0) return { rows: [], total: 0, months, income, savings: 0, fromIncome: income > 0 };

  // No money in: nothing to spread, so fall back to the plain averages
  if (income <= 0) {
    for (const r of rows) {
      r.limit = Math.ceil(r.average / 5) * 5;
      r.reason = `avg ${formatCurrency(r.average)} of spending over ${over}`;
      delete r.savingsCut;
    }
    return { rows, total: rows.reduce((s, r) => s + r.limit, 0), months, income: 0, savings: 0, fromIncome: false };
  }

  // Spread all the money in, in proportion to the averages, then fix the rounding on the biggest
  const avgTotal = rows.reduce((s, r) => s + r.average, 0);
  for (const r of rows) r.limit = roundTo5((r.average / avgTotal) * income);
  const biggest = rows.reduce((a, b) => (b.average > a.average ? b : a));
  biggest.limit += income - rows.reduce((s, r) => s + r.limit, 0);
  // Rounding can push a tiny category below $0 in theory; take it from the biggest instead
  for (const r of rows) {
    if (r.limit < 0) {
      biggest.limit += r.limit;
      r.limit = 0;
    }
  }

  // Savings come out of every category evenly
  const kept = Math.min(Math.max(0, Math.round(savings) || 0), income);
  takeEvenly(rows, kept);

  for (const r of rows) {
    r.reason =
      `avg ${formatCurrency(r.average)} of spending over ${over}, scaled to your income` +
      (r.savingsCut ? `, minus ${formatCurrency(r.savingsCut)} for savings` : "");
    delete r.savingsCut;
  }
  return { rows, total: income - kept, months, income, savings: kept, fromIncome: true };
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
