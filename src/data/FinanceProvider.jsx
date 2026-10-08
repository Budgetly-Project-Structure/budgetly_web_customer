/**
 * FinanceProvider.jsx
 *
 * The single place the web app's financial data lives. App.jsx wraps every
 * route in <FinanceProvider>, and pages read from it with useFinance().
 *
 * What it provides:
 *   Data:    categories, accounts, currentMonth, previousMonth,
 *            transactions, budgets, statements (import history), profile, lastImport
 *   Actions: updateTransactionCategory, setBudgetLimit, removeBudget, addCategory,
 *            addStatement, updateStatement, removeStatement, setProfile
 *
 * Transactions and import history are live from Firestore (onSnapshot).
 * Budgets and profile still start as mock data and live in React state, so
 * changes to those are lost on refresh. Categories the user makes are kept in
 * this browser (localStorage) until they move to Firestore too. The plan is to swap them for Firestore
 * here too; the pages won't need to change.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { FinanceContext } from "./FinanceContext";
import {
  ACCOUNTS,
  BUDGETS,
  CATEGORIES,
  CURRENT_MONTH,
  PREVIOUS_MONTH,
  PROFILE,
} from "./mockData";

/**
 * Turns a Firestore import doc (users/{uid}/imports/{id}, written by the
 * onStatementUploaded Cloud Function) into the "statement" shape the UI uses.
 * Fields the server hasn't set yet get safe defaults.
 */
function statementFromDoc(d) {
  const x = d.data();
  return {
    id: d.id,
    // Uploads are stored as "{timestamp}_{name}" so repeats don't collide; show just the name
    fileName: (x.fileName ?? "Statement").replace(/^\d{13}_/, ""),
    fileType: x.fileType ?? "csv",
    accountId: x.accountId ?? null,
    status: x.status ?? "uploaded", // uploaded → processing → completed | failed
    transactionCount: x.transactionCount ?? 0,
    skippedRowCount: x.skippedRowCount ?? 0, // rows the parser couldn't read
    rowErrors: x.rowErrors ?? [], // [{ row, reason }]
    error: x.error ?? null, // user-facing message when status is "failed"
    size: x.sizeBytes ?? 0,
    storagePath: x.storagePath ?? null,
    uploadedAt: x.uploadedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Turns a Firestore transaction doc (users/{uid}/transactions/{id}, written by
 * the import Cloud Function) into the shape the pages use.
 *   - date: stored as a Timestamp at 12:00 UTC; the pages want "YYYY-MM-DD"
 *   - isUserCorrected / categoryConfidence: derived from categorySource, because
 *     the Firestore rules only let the browser change category + categorySource
 */
function transactionFromDoc(d) {
  const x = d.data();
  const corrected = x.categorySource === "user";
  return {
    id: d.id,
    userId: x.userId ?? null,
    date: x.date?.toDate?.().toISOString().slice(0, 10) ?? null,
    merchant: x.merchant ?? "",
    amount: x.amount ?? 0,
    category: x.category ?? "uncategorized",
    categoryConfidence: x.categoryConfidence ?? (corrected ? 1 : 0),
    isUserCorrected: corrected,
    accountId: x.accountId ?? null,
    sourceStatementId: x.sourceStatementId ?? null,
  };
}

// Failed imports can't be deleted by the browser (Firestore rules make imports
// read-only), so "Dismiss" just hides them. We remember that per user, per device.
const dismissedKey = (uid) => `budgetly.dismissedImports.${uid}`;

// Categories the user made themselves, also per user, per device (until Firestore)
const customCategoriesKey = (uid) => `budgetly.customCategories.${uid}`;

function loadCustomCategories(uid) {
  try {
    const list = JSON.parse(localStorage.getItem(customCategoriesKey(uid)) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function loadDismissed(uid) {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissedKey(uid)) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Transactions and imports come from Firestore; budgets and profile are still in
 * memory (their updaters have a TODO showing the Firestore call they will become).
 * Page components only talk to this provider, so swapping the data source later
 * won't touch the pages.
 */
export default function FinanceProvider({ children }) {
  const [serverTransactions, setServerTransactions] = useState(null); // null = still loading
  const [transactionsError, setTransactionsError] = useState(null);
  const [budgets, setBudgets] = useState(BUDGETS);
  // Import history = uploads this browser is sending right now (pendingUploads)
  // + the server's import docs (serverImports, live from Firestore).
  const [pendingUploads, setPendingUploads] = useState([]);
  const [serverImports, setServerImports] = useState(null); // null = still loading
  const [statementsError, setStatementsError] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(PROFILE);
  const [customCategories, setCustomCategories] = useState([]);

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

  const removeBudget = useCallback((categoryId) => {
    setBudgets((prev) => prev.filter((b) => !(b.categoryId === categoryId && b.month === CURRENT_MONTH)));
  }, []);

  // Built-in categories, then the user's own. A transaction can point at a custom
  // category this browser doesn't know (made on another device), so those get a
  // plain placeholder instead of breaking the pages.
  const categories = useMemo(() => {
    const list = [...CATEGORIES, ...customCategories];
    const known = new Set(list.map((c) => c.id));
    const missing = [...new Set((serverTransactions ?? []).map((t) => t.category))].filter((id) => !known.has(id));
    return [
      ...list,
      ...missing.map((id) => ({ id, label: id.replace(/^custom-/, "").replace(/-/g, " "), icon: "uncategorized", color: "#8C9296" })),
    ];
  }, [customCategories, serverTransactions]);

  /**
   * Makes a new category the user named. The id is "custom-" + the name in
   * lowercase-with-dashes, so it can never clash with a built-in id.
   * Returns the new category, or null if the name is empty or already used.
   */
  const addCategory = useCallback(
    ({ label, color }) => {
      const name = label.trim().slice(0, 30);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) return null;
      const id = `custom-${slug}`;
      const all = [...CATEGORIES, ...customCategories];
      if (all.some((c) => c.id === id || c.label.toLowerCase() === name.toLowerCase())) return null;
      const category = { id, label: name, icon: "uncategorized", color, isCustom: true };
      // TODO (SCRUM-80): setDoc(doc(db, "users", uid, "categories", id), category)
      const next = [...customCategories, category];
      setCustomCategories(next);
      try {
        if (uid) localStorage.setItem(customCategoriesKey(uid), JSON.stringify(next));
      } catch {
        /* storage unavailable: the category lasts until a refresh */
      }
      return category;
    },
    [customCategories, uid]
  );

  // Who is logged in? (null when logged out). Also shows their own name and
  // email instead of placeholder profile data.
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setUid(user?.uid ?? null);
        if (user) {
          setProfile((p) => ({
            ...p,
            displayName: user.displayName || user.email?.split("@")[0] || "",
            email: user.email ?? "",
          }));
        }
      }),
    []
  );

  // Live transactions from Firestore. Until the first snapshot arrives,
  // transactionsLoading is true so pages don't flash "no data yet".
  useEffect(() => {
    if (!uid) {
      setServerTransactions(null);
      return undefined;
    }
    setServerTransactions(null);
    setTransactionsError(null);
    return onSnapshot(
      collection(db, "users", uid, "transactions"),
      (snap) => setServerTransactions(snap.docs.map(transactionFromDoc).filter((t) => t.date)),
      (err) => {
        console.error("Could not load transactions:", err.code, err.message);
        setTransactionsError("We couldn't load your transactions. Refresh the page to try again.");
        setServerTransactions([]);
      }
    );
  }, [uid]);

  const transactions = useMemo(() => serverTransactions ?? [], [serverTransactions]);
  const transactionsLoading = Boolean(uid) && serverTransactions === null;

  // Saves a category the user picked. The rules only allow category, categorySource
  // ("user") and updatedAt to change from the browser; the live listener above
  // updates the screen right away.
  const updateTransactionCategory = useCallback(
    async (id, category) => {
      if (!uid) return;
      try {
        await updateDoc(doc(db, "users", uid, "transactions", id), {
          category,
          categorySource: "user",
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not save category:", err.code, err.message);
      }
    },
    [uid]
  );

  // Live import history. onSnapshot fires on every change, so when the Cloud
  // Function moves an import from "uploaded" to "processing" to "completed",
  // the Import page updates by itself.
  useEffect(() => {
    if (!uid) {
      setServerImports(null);
      setPendingUploads([]);
      setCustomCategories([]);
      return undefined;
    }
    setServerImports(null);
    setStatementsError(null);
    setDismissedIds(loadDismissed(uid));
    setCustomCategories(loadCustomCategories(uid));
    const q = query(collection(db, "users", uid, "imports"), orderBy("uploadedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => setServerImports(snap.docs.map(statementFromDoc)),
      (err) => {
        console.error("Could not load import history:", err.code, err.message);
        setStatementsError("We couldn't load your import history. Refresh the page to try again.");
        setServerImports([]);
      }
    );
  }, [uid]);

  // A file being uploaded from this browser shows up instantly; once the
  // server's import doc for the same file arrives, the server's version replaces it.
  /** Adds a row to the top of Import history (ImportPage calls this when an upload starts). */
  const addStatement = useCallback((statement) => {
    setPendingUploads((prev) => [statement, ...prev]);
  }, []);

  /** Changes fields on one Import history row, e.g. { status: "uploaded" }. */
  const updateStatement = useCallback((id, patch) => {
    setPendingUploads((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /** Removes a row from Import history (server imports are hidden, not deleted). */
  const removeStatement = useCallback(
    (id) => {
      setPendingUploads((prev) => prev.filter((s) => s.id !== id));
      // Server imports can't be deleted from the browser: hide them and remember that
      setDismissedIds((prev) => {
        const next = new Set(prev).add(id);
        try {
          if (uid) localStorage.setItem(dismissedKey(uid), JSON.stringify([...next]));
        } catch {
          /* storage unavailable: the import just reappears after a refresh */
        }
        return next;
      });
    },
    [uid]
  );

  const statements = useMemo(() => {
    const serverPaths = new Set((serverImports ?? []).map((s) => s.storagePath));
    // Hide a pending row once the server has its own doc for the same file
    const pending = pendingUploads.filter((p) => !p.storagePath || !serverPaths.has(p.storagePath));
    const server = (serverImports ?? []).filter((s) => !dismissedIds.has(s.id));
    return [...pending, ...server];
  }, [pendingUploads, serverImports, dismissedIds]);

  const statementsLoading = Boolean(uid) && serverImports === null;

  const lastImport = statements.find((s) => s.status === "completed");

  const value = useMemo(
    () => ({
      categories,
      accounts: ACCOUNTS,
      currentMonth: CURRENT_MONTH,
      previousMonth: PREVIOUS_MONTH,
      transactions,
      transactionsLoading,
      transactionsError,
      budgets,
      statements,
      statementsLoading,
      statementsError,
      profile,
      lastImport,
      updateTransactionCategory,
      setBudgetLimit,
      removeBudget,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
      setProfile,
    }),
    [
      categories,
      transactions,
      transactionsLoading,
      transactionsError,
      budgets,
      statements,
      statementsLoading,
      statementsError,
      profile,
      lastImport,
      updateTransactionCategory,
      setBudgetLimit,
      removeBudget,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
