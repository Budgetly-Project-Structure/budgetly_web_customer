/**
 * money.js (Sprint 5, SCRUM-148)
 *
 * Money is saved as whole cents (budgetly_contracts schemas/data-model.md, "Money is
 * stored in whole cents"): a $250 monthly limit is limitCents 25000. Integers add up and
 * compare exactly; dollar numbers don't (0.1 + 0.2 !== 0.3). Dollars exist only for display,
 * so the pages keep showing dollars and these helpers convert at the edge:
 *
 *   dollarsToCents(d)       what the pages hand to Firestore: 250 -> 25000
 *   centsToDollars(c)       what the pages show: 25000 -> 250
 *   budgetLimitDollars(doc) a saved budget's limit for the pages
 *   parseCents(text)        what the user typed, read digit by digit: "12.40" -> 1240
 *   txnCents(txn)           a transaction's amount in cents (SCRUM-150)
 */

/**
 * Dollars to whole cents: Math.round(dollars * 100), so 19.99 -> 1999 even though
 * 19.99 * 100 is 1998.9999999999998 in JavaScript.
 * @param {number} dollars
 * @returns {number} integer cents, or NaN when it isn't a finite number
 */
export function dollarsToCents(dollars) {
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Cents to dollars, for display only. Never add these up; add cents. */
export function centsToDollars(cents) {
  return cents / 100;
}

/**
 * A saved budget's monthly limit in dollars, for the pages.
 *
 * TEMPORARY fallback: budgets saved before SCRUM-148 only have `limit` in dollars. Once the
 * migration (SCRUM-151) has given every budget limitCents, only the first branch is needed.
 *
 * @param {{limitCents?: number, limit?: number}} data  a budget document's data
 * @returns {number}
 */
export function budgetLimitDollars(data) {
  if (Number.isInteger(data?.limitCents)) return centsToDollars(data.limitCents);
  return Number(data?.limit) || 0;
}

/**
 * Reads a dollar amount the user typed into whole cents without going through a
 * floating-point number: "12.40" -> 1240, "1,234.5" -> 123450, ".99" -> 99.
 * Accepts an optional "$" and thousands commas, at most 2 decimals.
 * @param {string} text
 * @returns {number} integer cents, or NaN when it isn't an amount (empty, letters, 3 decimals)
 */
export function parseCents(text) {
  const s = String(text ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  const m = s.match(/^(\d*)(?:\.(\d{0,2}))?$/);
  if (!m || (m[1] === "" && !m[2])) return NaN;
  const cents = Number(m[1] || 0) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

/**
 * A transaction's amount in whole cents (negative = spending, positive = income).
 *
 * TEMPORARY fallback: transactions saved before SCRUM-150 only have `amount` in dollars,
 * and the sample data in mockData.js has no cents. Once the migration (SCRUM-151) has
 * given every document amountCents, only the first branch is needed.
 *
 * @param {{amountCents?: number, amount?: number}} txn
 * @returns {number}
 */
export function txnCents(txn) {
  if (Number.isInteger(txn?.amountCents)) return txn.amountCents;
  return Math.round((Number(txn?.amount) || 0) * 100);
}
