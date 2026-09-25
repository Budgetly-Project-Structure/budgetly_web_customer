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
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [budgets, setBudgets] = useState(BUDGETS);
  const [statements, setStatements] = useState(STATEMENTS);
  const [profile, setProfile] = useState(PROFILE);

  const updateTransactionCategory = useCallback((id, category) => {
    // TODO: updateDoc(doc(db, "transactions", id), { category, isUserCorrected: true })
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category, isUserCorrected: true, categoryConfidence: 1 } : t))
    );
  }, []);

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

  const removeBudget = useCallback((categoryId) => {
    setBudgets((prev) => prev.filter((b) => !(b.categoryId === categoryId && b.month === CURRENT_MONTH)));
  }, []);

  const addStatement = useCallback((statement) => {
    // TODO: upload to Storage, then the Cloud Function creates/updates the statement doc
    setStatements((prev) => [statement, ...prev]);
  }, []);

  const updateStatement = useCallback((id, patch) => {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeStatement = useCallback((id) => {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const lastImport = statements.find((s) => s.status === "completed");

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
