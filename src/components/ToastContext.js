/**
 * ToastContext.js
 *
 * Lets any page show a small message at the bottom of the screen, optionally
 * with an action button (for example "Undo"). ToastProvider.jsx puts the
 * function into this context; pages read it with useToast().
 *
 * Example:
 *   const { showToast } = useToast();
 *   showToast({
 *     message: 'Deleted "Coffee"',
 *     actionLabel: "Undo",
 *     onAction: () => restoreTransaction(id),
 *   });
 */
import { createContext, useContext } from "react";

// Starts as null. ToastProvider fills it in.
export const ToastContext = createContext(null);

/** Show a toast from any page. */
export function useToast() {
  const ctx = useContext(ToastContext);
  // Fails loudly if a page is rendered outside <ToastProvider> (a setup mistake)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
