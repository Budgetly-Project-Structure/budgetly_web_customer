// Shared formatting helpers — keep currency/date formatting identical everywhere (see ui-constraints.md).

// Reusable number formatters (making these once is faster than every call).
// currency0 = whole dollars ("$1,234"); currency2 = with cents ("$1,234.56").
const currency0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currency2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/**
 * Dollar amount, whole dollars by default.
 * formatCurrency(1234.5) → "$1,235"; formatCurrency(1234.5, { cents: true }) → "$1,234.50"
 */
export function formatCurrency(n, { cents = false } = {}) {
  return (cents ? currency2 : currency0).format(n);
}

/** Signed amount for transaction rows: "−$12.40" for spending, "+$1,850.00" for income. */
export function formatAmount(n) {
  const s = currency2.format(Math.abs(n));
  return n < 0 ? `−${s}` : `+${s}`;
}

/** "2026-09-05" → "Sep 5". Pass opts to change the format. */
export function formatDate(iso, opts = { month: "short", day: "numeric" }) {
  // Parse YYYY-MM-DD as a local date (avoids the UTC off-by-one)
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

/** Full timestamp → "Sep 22, 6:04 PM" (used for upload times). */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2026-09" → "September 2026" */
export function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "4521" → "•••• 4521". Full account numbers are never shown. */
export function maskAccount(last4) {
  return last4 ? `•••• ${last4}` : "";
}

/** 84.6 → "85%" */
export function formatPercent(n) {
  return `${Math.round(n)}%`;
}
