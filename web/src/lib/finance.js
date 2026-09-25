// Pure calculations over transactions/budgets. No React here so these are easy to unit test.

export const LOW_CONFIDENCE = 0.7;

export function inMonth(txn, month) {
  return txn.date.startsWith(month);
}

export function needsReview(txn) {
  return !txn.isUserCorrected && (txn.category === "uncategorized" || txn.categoryConfidence < LOW_CONFIDENCE);
}

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

export const BUDGET_STATUS = {
  over: { label: "Over budget", icon: "x", text: "text-danger", bar: "bg-danger", chip: "bg-danger/10 text-danger border-danger/40" },
  near: { label: "Near limit", icon: "alert", text: "text-warn", bar: "bg-warn", chip: "bg-warn/10 text-warn border-warn/40" },
  ok: { label: "On track", icon: "check", text: "text-green", bar: "bg-green", chip: "bg-greenDim text-green border-green/40" },
};

export function budgetStatus(spent, limit) {
  if (!limit) return "ok";
  const pct = spent / limit;
  if (pct > 1) return "over";
  if (pct >= 0.85) return "near";
  return "ok";
}

/** Budgets joined with actual spend for the month. */
export function budgetRows(budgets, transactions, month, categories) {
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

/**
 * Rule-based monthly insights. Stand-in for the AI-generated insights Cloud Function —
 * same output shape ({ id, tone, title, body }) so the UI won't change when that lands.
 */
export function generateInsights(transactions, month, prevMonth, categories, budgets) {
  const cur = spendingByCategory(transactions, month);
  const prev = spendingByCategory(transactions, prevMonth);
  const label = (id) => categories.find((c) => c.id === id)?.label ?? id;
  const insights = [];

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
