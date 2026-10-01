import { createContext, useContext } from "react";

export const FinanceContext = createContext(null);

/** Access transactions, budgets, statements and their update functions from any page. */
export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
