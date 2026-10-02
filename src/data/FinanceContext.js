/**
 * FinanceContext.js
 *
 * A React "context" lets any component read shared data without passing it
 * through props at every level. FinanceProvider.jsx puts the app's data into
 * this context; pages read it with useFinance().
 *
 * Example:
 *   const { transactions, budgets } = useFinance();
 */
import { createContext, useContext } from "react";

// Starts as null. FinanceProvider fills it in.
export const FinanceContext = createContext(null);

/** Access transactions, budgets, statements and their update functions from any page. */
export function useFinance() {
  const ctx = useContext(FinanceContext);
  // Fails loudly if a page is rendered outside <FinanceProvider> (a setup mistake)
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
