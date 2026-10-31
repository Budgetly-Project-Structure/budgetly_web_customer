/**
 * ToastProvider.jsx
 *
 * Shows one toast at a time at the bottom of the screen. A toast has a message,
 * an optional action button (such as "Undo"), and a close button. It goes away
 * by itself after a few seconds.
 *
 * Used for the Undo after deleting a manual transaction or removing a budget.
 * Deleting is a soft delete, so Undo just restores the item (see
 * restoreTransaction and restoreBudget in FinanceProvider.jsx).
 *
 * The toast lives above the pages, so it stays visible if the user changes pages
 * while it is showing. A new toast replaces the one on screen.
 *
 * Part of: Soft delete and recovery (SCRUM-126)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { ToastContext } from "./ToastContext";

/** How long a toast stays on screen, in milliseconds. */
const TOAST_MS = 8000;

export default function ToastProvider({ children }) {
  // The toast on screen: { id, message, actionLabel, onAction } or null
  const [toast, setToast] = useState(null);
  // True while the action (for example the restore) is running
  const [busy, setBusy] = useState(false);
  // Set when the action fails, so the toast can say so
  const [error, setError] = useState(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => {
    setToast(null);
    setBusy(false);
    setError(null);
  }, []);

  /**
   * Shows a toast.
   * @param {Object}   options
   * @param {string}   options.message       Text to show.
   * @param {string}   [options.actionLabel] Label for the action button (for example "Undo").
   * @param {() => Promise<void> | void} [options.onAction] Runs when the action button is clicked.
   *        If it throws, the toast shows the error message instead of closing.
   */
  const showToast = useCallback(({ message, actionLabel, onAction }) => {
    setBusy(false);
    setError(null);
    setToast({ id: nextId.current++, message, actionLabel, onAction });
  }, []);

  // Close by itself after TOAST_MS. Depends on the toast id, so a new toast restarts
  // the timer. A toast with an error stays until it is closed, so it can be read.
  useEffect(() => {
    if (!toast || busy || error) return undefined;
    const timer = setTimeout(dismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, busy, error, dismiss]);

  const runAction = async () => {
    if (!toast?.onAction || busy) return;
    const current = toast;
    setBusy(true);
    setError(null);
    try {
      await current.onAction();
      // Only close if no newer toast replaced this one while the action ran
      setToast((now) => (now && now.id === current.id ? null : now));
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err?.message || "Something went wrong. Please try again.");
    }
  };

  const value = useMemo(() => ({ showToast, dismissToast: dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        // role="status" makes screen readers read the message without interrupting
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 text-sm text-textLight shadow-lg"
          >
            <span className="flex-1">{error ?? toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                onClick={runAction}
                disabled={busy}
                className="font-medium text-green hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {busy ? "Working…" : error ? "Try again" : toast.actionLabel}
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-md p-1 text-textMuted hover:text-textLight"
              aria-label="Close message"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
