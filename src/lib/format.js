// Shared formatting helpers — keep currency/date formatting identical everywhere (see ui-constraints.md).

const currency0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currency2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function formatCurrency(n, { cents = false } = {}) {
  return (cents ? currency2 : currency0).format(n);
}

/** Signed amount for transaction rows: "−$12.40" for spending, "+$1,850.00" for income. */
export function formatAmount(n) {
  const s = currency2.format(Math.abs(n));
  return n < 0 ? `−${s}` : `+${s}`;
}

export function formatDate(iso, opts = { month: "short", day: "numeric" }) {
  // Parse YYYY-MM-DD as a local date (avoids the UTC off-by-one)
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "•••• 4521", or "" when the account is unknown (e.g. a statement uploaded without one). */
export function maskAccount(last4) {
  return last4 ? `•••• ${last4}` : "";
}

export function formatPercent(n) {
  return `${Math.round(n)}%`;
}
