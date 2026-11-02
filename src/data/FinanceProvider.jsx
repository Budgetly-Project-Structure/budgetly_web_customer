/**
 * FinanceProvider.jsx
 *
 * The single place the web app's financial data lives. App.jsx wraps every
 * route in <FinanceProvider>, and pages read from it with useFinance().
 *
 * What it provides:
 *   Data:    categories, accounts, currentMonth, previousMonth,
 *            transactions, budgets, statements (import history), profile, lastImport
 *   Deleted: deletedTransactions, deletedBudgets (soft deleted, still restorable; SCRUM-125)
 *   Actions: updateTransactionCategory, addTransaction, updateTransaction, deleteTransaction, restoreTransaction,
 *            setBudgetLimit, removeBudget, restoreBudget, addCategory,
 *            addStatement, updateStatement, removeStatement, deleteStatement, saveProfile
 *
 * Transactions, import history and budgets are live from Firestore (onSnapshot).
 * Transactions are one top-level collection, transactions/{id}, for every user; the owner is
 * the userId field, and every query starts with where("userId", "==", uid) or the rules reject it
 * (SCRUM-117). Deleting a manual transaction or a budget is a soft delete: deletedAt, deletedBy and
 * purgeAfter are set and the server removes it for good later. The pages only see active items; the
 * soft-deleted ones are listed separately (deletedTransactions, deletedBudgets) so they can be restored.
 * Budgets are users/{uid}/budgets/{categoryId} = { categoryId, limit, updatedAt }.
 * A limit is monthly, so it applies to every month; a new user has none.
 * The profile (name, email, and the monthly income from Settings) is live from
 * users/{uid} (SCRUM-84); the name and email from Firebase Auth fill in until it loads. Categories the user makes are kept in
 * this browser (localStorage) until they move to Firestore too. The plan is to swap them for Firestore
 * here too; the pages won't need to change.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../lib/firebase";
import { FinanceContext } from "./FinanceContext";
import { cleanMerchant } from "../lib/merchantName";
import {
  ACCOUNTS,
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
    duplicateRowCount: x.duplicateRowCount ?? 0, // rows an earlier statement already saved (SCRUM-136)
    rowErrors: x.rowErrors ?? [], // [{ row, reason }]
    error: x.error ?? null, // user-facing message when status is "failed"
    size: x.sizeBytes ?? 0,
    storagePath: x.storagePath ?? null,
    fromServer: true, // a real import record (rows still uploading from this browser don't have this)
    uploadedAt: x.uploadedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    // Set when the statement was deleted (SCRUM-120); it can be restored until purgeAfter
    deletedAt: x.deletedAt?.toDate?.().toISOString() ?? null,
    purgeAfter: x.purgeAfter?.toDate?.().toISOString() ?? null,
  };
}

/**
 * Turns a Firestore transaction doc (transactions/{id}, written by the import
 * Cloud Function or by the manual form) into the shape the pages use.
 *   - date: stored as a Timestamp at 12:00 UTC; the pages want "YYYY-MM-DD"
 *   - merchant: cleaned for imported transactions (lib/merchantName.js); rawMerchant keeps the statement text
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
    // Imported transactions show a cleaned-up name ("Kwik Trip", not "KWIK TRIP #412").
    // Manual ones are shown exactly as the user typed them. The raw text stays in Firestore.
    merchant: x.source === "manual" ? (x.merchant ?? "") : cleanMerchant(x.merchant),
    rawMerchant: x.merchant ?? "",
    amount: x.amount ?? 0,
    category: x.category ?? "uncategorized",
    categoryConfidence: x.categoryConfidence ?? (corrected ? 1 : 0),
    isUserCorrected: corrected,
    accountId: x.accountId ?? null,
    sourceStatementId: x.sourceStatementId ?? null,
    source: x.source ?? "import", // "manual" = added by the user on the Transactions page (SCRUM-86)
    // Soft delete: null while active. purgeAfter is when the server may remove it for good.
    deletedAt: x.deletedAt?.toDate?.().toISOString() ?? null,
    purgeAfter: x.purgeAfter?.toDate?.().toISOString() ?? null,
  };
}

// How long a deleted manual transaction or budget stays recoverable before the server may purge it.
// Soft delete (data-model.md): the browser sets purgeAfter, the server removes the doc after it.
const PURGE_AFTER_DAYS = 30;

/** The three fields a soft delete sets (the Firestore rules check exactly these). */
function softDeleteFields(uid) {
  return {
    deletedAt: serverTimestamp(),
    deletedBy: uid,
    purgeAfter: Timestamp.fromMillis(Date.now() + PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000),
    updatedAt: serverTimestamp(),
  };
}

// Shown on the manual transaction form when a save fails
const SAVE_ERROR = "We couldn't save this transaction. Please try again.";

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
 * Transactions, imports, budgets and the profile come from Firestore.
 * Page components only talk to this provider, so swapping the data source later
 * won't touch the pages.
 */
export default function FinanceProvider({ children }) {
  const [serverTransactions, setServerTransactions] = useState(null); // null = still loading
  const [transactionsError, setTransactionsError] = useState(null);
  const [serverBudgets, setServerBudgets] = useState(null); // null = still loading
  const [serverDeletedBudgets, setServerDeletedBudgets] = useState([]); // soft deleted, restorable
  // Import history = uploads this browser is sending right now (pendingUploads)
  // + the server's import docs (serverImports, live from Firestore).
  const [pendingUploads, setPendingUploads] = useState([]);
  const [serverImports, setServerImports] = useState(null); // null = still loading
  const [statementsError, setStatementsError] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(PROFILE);
  const [customCategories, setCustomCategories] = useState([]);
  // Budgets the user removed (soft deleted). Not shown, but remembered so that setting a
  // limit on one restores it first.
  const deletedBudgetIds = useRef(new Set());

  /**
   * Sets the monthly limit for a category: creates the budget or changes it.
   * The live listener below puts it on screen right away.
   * Returns true when it worked and false when it didn't.
   */
  const setBudgetLimit = useCallback(
    async (categoryId, limit) => {
      if (!uid) return false;
      try {
        const ref = doc(db, "users", uid, "budgets", categoryId);
        // A removed budget is only soft deleted, and the rules won't let a new limit
        // quietly undo that, so restore it first.
        if (deletedBudgetIds.current.has(categoryId)) {
          await updateDoc(ref, { deletedAt: null, deletedBy: null, purgeAfter: null, updatedAt: serverTimestamp() });
          deletedBudgetIds.current.delete(categoryId);
        }
        await setDoc(ref, { categoryId, limit, updatedAt: serverTimestamp() });
        return true;
      } catch (err) {
        console.error("Could not save budget:", err.code, err.message);
        return false;
      }
    },
    [uid]
  );

  /** Removes a budget (a soft delete). Returns true when it worked and false when it didn't. */
  const removeBudget = useCallback(
    async (categoryId) => {
      if (!uid) return false;
      try {
        // Soft delete: the rules never allow a real delete from the browser
        await updateDoc(doc(db, "users", uid, "budgets", categoryId), softDeleteFields(uid));
        return true;
      } catch (err) {
        console.error("Could not remove budget:", err.code, err.message);
        return false;
      }
    },
    [uid]
  );

  /** Brings a removed budget back with the limit it had. */
  const restoreBudget = useCallback(
    async (categoryId) => {
      if (!uid) throw new Error("You need to be logged in.");
      try {
        await updateDoc(doc(db, "users", uid, "budgets", categoryId), {
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not restore budget:", err.code, err.message);
        throw new Error("We couldn't restore this budget. Please try again.");
      }
    },
    [uid]
  );

  // Live budgets from Firestore, in the shape the pages use. Limits are monthly,
  // so every budget is stamped with the current month.
  useEffect(() => {
    if (!uid) {
      setServerBudgets(null);
      setServerDeletedBudgets([]);
      return undefined;
    }
    setServerBudgets(null);
    setServerDeletedBudgets([]);
    return onSnapshot(
      collection(db, "users", uid, "budgets"),
      (snap) => {
        const active = snap.docs.filter((d) => d.data().deletedAt == null);
        const deleted = snap.docs.filter((d) => d.data().deletedAt != null);
        deletedBudgetIds.current = new Set(deleted.map((d) => d.id));
        setServerDeletedBudgets(
          deleted
            .map((d) => ({
              categoryId: d.data().categoryId ?? d.id,
              limit: Number(d.data().limit) || 0,
              deletedAt: d.data().deletedAt.toDate().toISOString(),
              purgeAfter: d.data().purgeAfter?.toDate?.().toISOString() ?? null,
            }))
            .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
        );
        setServerBudgets(
          active.map((d) => ({
            id: d.id,
            userId: uid,
            categoryId: d.data().categoryId ?? d.id,
            month: CURRENT_MONTH,
            limit: Number(d.data().limit) || 0,
          }))
        );
      },
      (err) => {
        console.error("Could not load budgets:", err.code, err.message);
        setServerBudgets([]);
      }
    );
  }, [uid]);

  // Live profile and settings from users/{uid} (SCRUM-84): the name and the monthly
  // income saved on Settings. Until it arrives, the name and email from Auth are used.
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const x = snap.data() ?? {};
        setProfile((p) => ({
          ...p,
          displayName: x.displayName || p.displayName,
          monthlyIncome: typeof x.monthlyIncome === "number" ? x.monthlyIncome : null,
        }));
      },
      (err) => console.error("Could not load profile:", err.code, err.message)
    );
  }, [uid]);

  /**
   * Saves the name and monthly income from Settings to users/{uid}, and the name
   * to the Firebase Auth profile too. monthlyIncome is dollars, or null to clear it.
   * The live listener above puts the new values on screen.
   * Throws an Error with a message that can be shown to the user.
   */
  const saveProfile = useCallback(
    async ({ displayName, monthlyIncome }) => {
      if (!uid) throw new Error("Please sign in again.");
      try {
        // merge: only these two fields change (the rules allow nothing else)
        await setDoc(doc(db, "users", uid), { displayName, monthlyIncome }, { merge: true });
        if (auth.currentUser && auth.currentUser.displayName !== displayName) {
          await updateProfile(auth.currentUser, { displayName });
        }
      } catch (err) {
        console.error("Could not save profile:", err.code, err.message);
        throw new Error("We couldn't save your settings. Please try again.");
      }
    },
    [uid]
  );

  const budgets = useMemo(() => serverBudgets ?? [], [serverBudgets]);
  const deletedBudgets = serverDeletedBudgets;
  const budgetsLoading = Boolean(uid) && serverBudgets === null;

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
        } else {
          setProfile(PROFILE); // signed out: forget the last user's settings
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
    // The rules reject any query that isn't limited to the caller's own userId. This one
    // filter needs no composite index; active and soft-deleted ones are split below.
    return onSnapshot(
      query(collection(db, "transactions"), where("userId", "==", uid)),
      (snap) => setServerTransactions(snap.docs.map(transactionFromDoc).filter((t) => t.date)),
      (err) => {
        console.error("Could not load transactions:", err.code, err.message);
        setTransactionsError("We couldn't load your transactions. Refresh the page to try again.");
        setServerTransactions([]);
      }
    );
  }, [uid]);

  // What the pages show: transactions that haven't been deleted
  const transactions = useMemo(() => (serverTransactions ?? []).filter((t) => !t.deletedAt), [serverTransactions]);
  // Soft-deleted manual transactions, newest deletion first (the Import page's "Recently deleted").
  // Imported ones are never soft deleted from the app; the server removes them with their statement.
  const deletedTransactions = useMemo(
    () =>
      (serverTransactions ?? [])
        .filter((t) => t.deletedAt && t.source === "manual")
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [serverTransactions]
  );
  const transactionsLoading = Boolean(uid) && serverTransactions === null;

  // Saves a category the user picked. The rules only allow category, categorySource
  // ("user") and updatedAt to change from the browser; the live listener above
  // updates the screen right away.
  // Throws an Error with a message that can be shown to the user if it can't be saved.
  const updateTransactionCategory = useCallback(
    async (id, category) => {
      if (!uid) throw new Error("Please sign in again.");
      try {
        await updateDoc(doc(db, "transactions", id), {
          category,
          categorySource: "user",
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not save category:", err.code, err.message);
        throw new Error("Couldn't save. Try again.");
      }
    },
    [uid]
  );

  // Manual transactions (SCRUM-86): the user's own entries, marked source "manual". The
  // Firestore rules only let the browser create/edit/soft-delete these, never imported ones.
  // Each throws an Error with a message that can be shown on the form.
  /** Adds a transaction typed in by the user. `date` is "YYYY-MM-DD"; amount < 0 = spending. */
  const addTransaction = useCallback(
    async ({ date, merchant, amount, category, accountId }) => {
      if (!uid) throw new Error("You need to be logged in.");
      try {
        await addDoc(collection(db, "transactions"), {
          userId: uid, // the owner; the rules only accept your own uid here
          // Noon UTC, same as imported transactions, so the day never shifts with time zones
          date: Timestamp.fromDate(new Date(`${date}T12:00:00Z`)),
          merchant,
          amount,
          category,
          categorySource: "user",
          categoryConfidence: 1,
          isUserCorrected: true,
          accountId: accountId ?? null,
          sourceStatementId: null,
          source: "manual",
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not add transaction:", err.code, err.message);
        throw new Error(SAVE_ERROR);
      }
    },
    [uid]
  );

  /** Changes a manual transaction. Same fields as addTransaction. */
  const updateTransaction = useCallback(
    async (id, { date, merchant, amount, category, accountId }) => {
      if (!uid) throw new Error("You need to be logged in.");
      try {
        await updateDoc(doc(db, "transactions", id), {
          date: Timestamp.fromDate(new Date(`${date}T12:00:00Z`)),
          merchant,
          amount,
          category,
          accountId: accountId ?? null,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not update transaction:", err.code, err.message);
        throw new Error(SAVE_ERROR);
      }
    },
    [uid]
  );

  /** Deletes a manual transaction (a soft delete: it is hidden now and purged by the server later). */
  const deleteTransaction = useCallback(
    async (id) => {
      if (!uid) return;
      try {
        await updateDoc(doc(db, "transactions", id), softDeleteFields(uid));
      } catch (err) {
        console.error("Could not delete transaction:", err.code, err.message);
        throw new Error("We couldn't delete this transaction. Please try again.");
      }
    },
    [uid]
  );

  /**
   * Brings a soft-deleted manual transaction back: clears the three delete fields
   * (the Firestore rules only allow exactly that). The live listener puts it back on screen.
   */
  const restoreTransaction = useCallback(
    async (id) => {
      if (!uid) throw new Error("You need to be logged in.");
      try {
        await updateDoc(doc(db, "transactions", id), {
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Could not restore transaction:", err.code, err.message);
        throw new Error("We couldn't restore this transaction. Please try again.");
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

  /**
   * Deletes a server import (SCRUM-120). It's a soft delete: the softDeleteImport
   * Cloud Function marks the import record and its transactions deleted and keeps the
   * file, so it can be restored for 30 days. The live listeners above then hide the
   * row and the transactions by themselves.
   * Throws an Error with a message that can be shown to the user.
   */
  const deleteStatement = useCallback(async (id) => {
    try {
      const { data } = await httpsCallable(functions, "softDeleteImport")({ importId: id });
      return data; // { deletedTransactions, purgeAfter }
    } catch (err) {
      console.error("Could not delete import:", err.code, err.message);
      // The function's own errors (not found, still importing...) have readable messages
      const readable = ["functions/not-found", "functions/failed-precondition", "functions/permission-denied", "functions/unauthenticated"];
      throw new Error(readable.includes(err.code) ? err.message : "We couldn't delete this statement. Please try again.");
    }
  }, []);

  const statements = useMemo(() => {
    const serverPaths = new Set((serverImports ?? []).map((s) => s.storagePath));
    // Hide a pending row once the server has its own doc for the same file
    const pending = pendingUploads.filter((p) => !p.storagePath || !serverPaths.has(p.storagePath));
    // Deleted statements are hidden (their transactions are too, since they carry deletedAt)
    const server = (serverImports ?? []).filter((s) => !dismissedIds.has(s.id) && !s.deletedAt);
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
      deletedTransactions,
      budgets,
      budgetsLoading,
      deletedBudgets,
      statements,
      statementsLoading,
      statementsError,
      profile,
      lastImport,
      updateTransactionCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      setBudgetLimit,
      removeBudget,
      restoreBudget,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
      deleteStatement,
      saveProfile,
    }),
    [
      categories,
      transactions,
      transactionsLoading,
      transactionsError,
      deletedTransactions,
      budgets,
      budgetsLoading,
      deletedBudgets,
      statements,
      statementsLoading,
      statementsError,
      profile,
      lastImport,
      updateTransactionCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      setBudgetLimit,
      removeBudget,
      restoreBudget,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
      deleteStatement,
      saveProfile,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
