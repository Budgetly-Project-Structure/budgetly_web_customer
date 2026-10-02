/**
 * FinanceProvider.jsx
 *
 * The single place the web app's financial data lives. App.jsx wraps every
 * route in <FinanceProvider>, and pages read from it with useFinance().
 *
 * What it provides:
 *   Data:    categories, accounts, currentMonth, previousMonth,
 *            transactions, budgets, statements (import history), profile, lastImport
 *   Actions: updateTransactionCategory, setBudgetLimit, removeBudget,
 *            addStatement, updateStatement, removeStatement, setProfile
 *
 * Right now the data starts as the mock data and lives in React state, so
 * changes are lost on refresh. The plan is to swap each piece for Firestore
 * here; the pages won't need to change.
 */
import { useCallback, useMemo, useState } from "react";
import { FinanceContext } from "./FinanceContext";
import {
  ACCOUNTS,
  BUDGETS,
  CATEGORIES,
  CURRENT_MONTH,
  PREVIOUS_MONTH,
  PROFILE,
  STATEMENTS,
  TRANSACTIONS,
} from "./mockData";

/**
 * Holds app data in memory for now. Each updater has a TODO showing the Firestore
 * call it will become — page components only talk to this provider, so swapping the
 * data source later won't touch the pages.
 */
export default function FinanceProvider({ children }) {
  // Each piece of data starts as the mock version
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [budgets, setBudgets] = useState(BUDGETS);
  const [statements, setStatements] = useState(STATEMENTS);
  const [profile, setProfile] = useState(PROFILE);

  /**
   * User changed a transaction's category. Marks it as user-corrected with
   * confidence 1, so it no longer shows as "needs review".
   * useCallback keeps the same function between renders, so components using it don't redraw needlessly.
   */
  const updateTransactionCategory = useCallback((id, category) => {
    // TODO: updateDoc(doc(db, "transactions", id), { category, isUserCorrected: true })
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category, isUserCorrected: true, categoryConfidence: 1 } : t))
    );
  }, []);

  /**
   * Sets this month's limit for a category: updates the budget if it exists,
   * otherwise creates a new one.
   */
  const setBudgetLimit = useCallback((categoryId, limit) => {
    // TODO: setDoc(doc(db, "budgets", `${uid}_${categoryId}_${CURRENT_MONTH}`), { ... }, { merge: true })
    setBudgets((prev) => {
      const exists = prev.some((b) => b.categoryId === categoryId && b.month === CURRENT_MONTH);
      if (exists) {
        return prev.map((b) => (b.categoryId === categoryId && b.month === CURRENT_MONTH ? { ...b, limit } : b));
      }
      return [
        ...prev,
        { id: `bud-${categoryId}-${CURRENT_MONTH}`, userId: "demo-user", categoryId, month: CURRENT_MONTH, limit },
      ];
    });
  }, []);

  /** Deletes this month's budget for a category. */
  const removeBudget = useCallback((categoryId) => {
    setBudgets((prev) => prev.filter((b) => !(b.categoryId === categoryId && b.month === CURRENT_MONTH)));
  }, []);

  /** Adds a row to the top of Import history (ImportPage calls this when an upload starts). */
  const addStatement = useCallback((statement) => {
    // TODO: upload to Storage, then the Cloud Function creates/updates the statement doc
    setStatements((prev) => [statement, ...prev]);
  }, []);

  /** Changes fields on one Import history row, e.g. { status: "uploaded" }. */
  const updateStatement = useCallback((id, patch) => {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /** Removes a row from Import history. */
  const removeStatement = useCallback((id) => {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Most recent successful import. The top bar uses it to show when data was last updated.
  const lastImport = statements.find((s) => s.status === "completed");

  // Everything pages can use. useMemo builds a new object only when something
  // in the list at the bottom changes, so pages don't re-render for no reason.
  const value = useMemo(
    () => ({
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      currentMonth: CURRENT_MONTH,
      previousMonth: PREVIOUS_MONTH,
      transactions,
      budgets,
      statements,
      profile,
      lastImport,
      updateTransactionCategory,
      setBudgetLimit,
      removeBudget,
      addStatement,
      updateStatement,
      removeStatement,
      setProfile,
    }),
    [
      transactions,
      budgets,
      statements,
      profile,
      lastImport,
      updateTransactionCategory,
      setBudgetLimit,
      removeBudget,
      addStatement,
      updateStatement,
      removeStatement,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
