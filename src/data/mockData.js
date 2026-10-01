/**
 * Placeholder data shaped like the Firestore data model (docs/data-model.md).
 * Replace with real Firestore queries once Auth + the statement import function are live.
 *
 * Conventions:
 *  - amount < 0 = spending, amount > 0 = income
 *  - dates are ISO strings (Firestore Timestamps will be converted with .toDate() later)
 *  - account numbers are only ever stored masked (last 4)
 */

export const CURRENT_MONTH = "2026-09";
export const PREVIOUS_MONTH = "2026-08";

export const CATEGORIES = [
  { id: "dining", label: "Dining Out", icon: "dining", color: "#E08A5B" },
  { id: "groceries", label: "Groceries", icon: "groceries", color: "#4FB286" },
  { id: "transportation", label: "Transportation", icon: "transportation", color: "#5B8DD6" },
  { id: "subscriptions", label: "Subscriptions", icon: "subscriptions", color: "#A77BD6" },
  { id: "shopping", label: "Shopping", icon: "shopping", color: "#D6B35B" },
  { id: "utilities", label: "Utilities", icon: "utilities", color: "#5BC0D6" },
  { id: "entertainment", label: "Entertainment", icon: "entertainment", color: "#D65B8D" },
  { id: "health", label: "Health", icon: "health", color: "#8DD65B" },
  { id: "income", label: "Income", icon: "income", color: "#39D67A" },
  { id: "uncategorized", label: "Uncategorized", icon: "uncategorized", color: "#8C9296" },
];

export const ACCOUNTS = [
  { id: "acct-checking", name: "Checking", last4: "4521" },
  { id: "acct-credit", name: "Credit Card", last4: "8830" },
];

// [date, merchant, amount, category, confidence, accountId]
const RAW = [
  // ---- September 2026 ----
  ["2026-09-01", "ACME CORP PAYROLL", 1850.0, "income", 0.99, "acct-checking"],
  ["2026-09-01", "Evergy Electric", -94.4, "utilities", 0.96, "acct-checking"],
  ["2026-09-02", "Starbucks", -6.45, "dining", 0.98, "acct-credit"],
  ["2026-09-02", "Hy-Vee", -96.42, "groceries", 0.97, "acct-credit"],
  ["2026-09-03", "Netflix", -15.49, "subscriptions", 0.99, "acct-credit"],
  ["2026-09-03", "Shell Oil 57442", -42.1, "transportation", 0.94, "acct-credit"],
  ["2026-09-04", "Chipotle", -14.85, "dining", 0.97, "acct-credit"],
  ["2026-09-05", "Amazon.com", -48.99, "shopping", 0.88, "acct-credit"],
  ["2026-09-05", "Spotify", -11.99, "subscriptions", 0.99, "acct-credit"],
  ["2026-09-06", "Olive Garden", -58.2, "dining", 0.96, "acct-credit"],
  ["2026-09-07", "Aldi", -54.18, "groceries", 0.95, "acct-credit"],
  ["2026-09-08", "Google Fiber", -70.0, "utilities", 0.93, "acct-checking"],
  ["2026-09-08", "Starbucks", -5.95, "dining", 0.98, "acct-credit"],
  ["2026-09-09", "Target T-1123", -62.14, "shopping", 0.64, "acct-credit"],
  ["2026-09-10", "AMC Theatres", -28.5, "entertainment", 0.92, "acct-credit"],
  ["2026-09-10", "Panera Bread", -13.4, "dining", 0.97, "acct-credit"],
  ["2026-09-11", "SQ *MKT 4471", -18.0, "uncategorized", 0.31, "acct-credit"],
  ["2026-09-12", "Trader Joe's", -71.35, "groceries", 0.97, "acct-credit"],
  ["2026-09-12", "iCloud Storage", -2.99, "subscriptions", 0.95, "acct-credit"],
  ["2026-09-13", "Sweetgreen", -16.75, "dining", 0.95, "acct-credit"],
  ["2026-09-14", "CVS Pharmacy", -24.18, "health", 0.58, "acct-credit"],
  ["2026-09-15", "ACME CORP PAYROLL", 1850.0, "income", 0.99, "acct-checking"],
  ["2026-09-15", "QuikTrip 0381", -38.9, "transportation", 0.91, "acct-credit"],
  ["2026-09-16", "The Blue Door Kitchen", -72.3, "dining", 0.82, "acct-credit"],
  ["2026-09-17", "Adobe Creative Cloud", -22.99, "subscriptions", 0.97, "acct-credit"],
  ["2026-09-17", "Venmo Payment", -40.0, "uncategorized", 0.22, "acct-checking"],
  ["2026-09-18", "DoorDash", -41.6, "dining", 0.93, "acct-credit"],
  ["2026-09-18", "Steam Games", -19.99, "entertainment", 0.9, "acct-credit"],
  ["2026-09-19", "Hy-Vee", -112.6, "groceries", 0.97, "acct-credit"],
  ["2026-09-19", "YouTube Premium", -13.99, "subscriptions", 0.96, "acct-credit"],
  ["2026-09-20", "Starbucks", -6.45, "dining", 0.98, "acct-credit"],
  ["2026-09-20", "Uber Trip", -15.0, "transportation", 0.95, "acct-credit"],
  ["2026-09-21", "Amazon.com", -23.47, "shopping", 0.86, "acct-credit"],
  ["2026-09-21", "Taco Bell", -11.2, "dining", 0.97, "acct-credit"],
  ["2026-09-22", "Costco Wholesale", -83.45, "groceries", 0.69, "acct-credit"],
  ["2026-09-22", "Kona Grill", -64.85, "dining", 0.95, "acct-credit"],

  // ---- August 2026 ----
  ["2026-08-01", "ACME CORP PAYROLL", 1850.0, "income", 0.99, "acct-checking"],
  ["2026-08-01", "Evergy Electric", -102.0, "utilities", 0.96, "acct-checking"],
  ["2026-08-03", "Netflix", -15.49, "subscriptions", 0.99, "acct-credit"],
  ["2026-08-04", "Hy-Vee", -148.2, "groceries", 0.97, "acct-credit"],
  ["2026-08-05", "Spotify", -11.99, "subscriptions", 0.99, "acct-credit"],
  ["2026-08-06", "Shell Oil 57442", -51.3, "transportation", 0.94, "acct-credit"],
  ["2026-08-08", "Google Fiber", -70.0, "utilities", 0.93, "acct-checking"],
  ["2026-08-09", "Olive Garden", -61.4, "dining", 0.96, "acct-credit"],
  ["2026-08-10", "Amazon.com", -132.55, "shopping", 0.88, "acct-credit"],
  ["2026-08-12", "iCloud Storage", -2.99, "subscriptions", 0.95, "acct-credit"],
  ["2026-08-13", "Trader Joe's", -88.1, "groceries", 0.97, "acct-credit"],
  ["2026-08-15", "ACME CORP PAYROLL", 1850.0, "income", 0.99, "acct-checking"],
  ["2026-08-16", "Chipotle", -29.7, "dining", 0.97, "acct-credit"],
  ["2026-08-17", "Adobe Creative Cloud", -22.99, "subscriptions", 0.97, "acct-credit"],
  ["2026-08-18", "Dave & Buster's", -80.0, "entertainment", 0.89, "acct-credit"],
  ["2026-08-19", "QuikTrip 0381", -44.8, "transportation", 0.91, "acct-credit"],
  ["2026-08-21", "Target T-1123", -107.45, "shopping", 0.81, "acct-credit"],
  ["2026-08-22", "Costco Wholesale", -215.7, "groceries", 0.9, "acct-credit"],
  ["2026-08-24", "DoorDash", -54.3, "dining", 0.93, "acct-credit"],
  ["2026-08-26", "Uber Trip", -31.9, "transportation", 0.95, "acct-credit"],
  ["2026-08-28", "The Blue Door Kitchen", -118.6, "dining", 0.82, "acct-credit"],
];

export const TRANSACTIONS = RAW.map(([date, merchant, amount, category, categoryConfidence, accountId], i) => ({
  id: `txn-${String(i + 1).padStart(3, "0")}`,
  userId: "demo-user",
  date,
  merchant,
  amount,
  category,
  categoryConfidence,
  isUserCorrected: false,
  accountId,
  sourceStatementId: date.startsWith(PREVIOUS_MONTH) ? "stmt-001" : "stmt-003",
}));

export const BUDGETS = [
  { categoryId: "dining", limit: 250 },
  { categoryId: "groceries", limit: 500 },
  { categoryId: "transportation", limit: 150 },
  { categoryId: "subscriptions", limit: 60 },
  { categoryId: "shopping", limit: 200 },
  { categoryId: "utilities", limit: 180 },
  { categoryId: "entertainment", limit: 100 },
  { categoryId: "health", limit: 80 },
].map((b) => ({ ...b, id: `bud-${b.categoryId}-${CURRENT_MONTH}`, userId: "demo-user", month: CURRENT_MONTH }));

export const STATEMENTS = [
  {
    id: "stmt-003",
    fileName: "checking_sept_2026.csv",
    fileType: "csv",
    accountId: "acct-checking",
    uploadedAt: "2026-09-22T18:04:00",
    status: "completed",
    transactionCount: 36,
  },
  {
    id: "stmt-002",
    fileName: "credit_card_statement_0822.pdf",
    fileType: "pdf",
    accountId: "acct-credit",
    uploadedAt: "2026-09-22T17:58:00",
    status: "failed",
    transactionCount: 0,
    error: "We couldn't find a transaction table on page 2. Try exporting this statement as CSV.",
  },
  {
    id: "stmt-001",
    fileName: "checking_aug_2026.csv",
    fileType: "csv",
    accountId: "acct-checking",
    uploadedAt: "2026-09-01T09:12:00",
    status: "completed",
    transactionCount: 23,
  },
];

export const PROFILE = {
  displayName: "Zach Sheppard",
  email: "demo@ledger.app",
  createdAt: "2026-09-01",
};
