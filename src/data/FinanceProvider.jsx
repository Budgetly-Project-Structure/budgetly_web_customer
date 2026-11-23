/**
 * FinanceProvider.jsx
 *
 * The single place the web app's financial data lives. App.jsx wraps every
 * route in <FinanceProvider>, and pages read from it with useFinance().
 *
 * What it provides:
 *   Data:    categories, accounts, currentMonth, previousMonth,
 *            transactions, budgets, statements (import history), profile, lastImport,
 *            autoBudgetMonth (the month the budget set itself, SCRUM-137)
 *   Deleted: deletedTransactions, deletedBudgets (soft deleted, still restorable; SCRUM-125),
 *            deletedStatements (SCRUM-121)
 *   Actions: updateTransactionCategory, addTransaction, updateTransaction, deleteTransaction, restoreTransaction,
 *            setBudgetLimit, removeBudget, restoreBudget, saveMonthSavings, addCategory,
 *            addStatement, updateStatement, removeStatement, deleteStatement, restoreStatement, saveProfile
 *
 * Transactions, import history and budgets are live from Firestore (onSnapshot).
 * Transactions are one top-level collection, transactions/{id}, for every user; the owner is
 * the userId field, and every query starts with where("userId", "==", uid) or the rules reject it
 * (SCRUM-117). Deleting a manual transaction or a budget is a soft delete: deletedAt, deletedBy and
 * purgeAfter are set and the server removes it for good later. The pages only see active items; the
 * soft-deleted ones are listed separately (deletedTransactions, deletedBudgets) so they can be restored.
 * Budgets are users/{uid}/budgets/{categoryId} = { categoryId, limitCents, source, updatedAt }.
 * limitCents is whole cents (SCRUM-148); the pages work in dollars, converted in lib/money.js.
 * A limit is monthly, so it applies to every month; a new user has none. source is "auto"
 * when Auto budget set it and "user" when the user typed it in (older budgets have none = "user").
 * Each month the budget sets itself once (SCRUM-137, planMonthlyBudget in lib/finance.js):
 * users/{uid}/budgetMonths/{YYYY-MM} = { month, auto, savings, createdAt } records that it
 * happened (and the savings kept), so it runs only once per month even with two tabs open.
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
  deleteField,
  doc,
  getCountFromServer,
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
import { displayFileName, fileTypeFromPath } from "../lib/importFile";
import { carriedOverSavings, planMonthlyBudget } from "../lib/finance";
import { budgetLimitDollars, centsToDollars, dollarsToCents, txnCents } from "../lib/money";
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
 * The record doesn't copy anything it can get elsewhere (Sprint 5 #2): the file name and
 * type come from storagePath, the account type from the account, and the number of
 * transactions is counted from the transactions collection (transactionCount is added
 * later, see importCounts below).
 */
function statementFromDoc(d) {
  const x = d.data();
  return {
    id: d.id,
    // Uploads are stored as "{timestamp}_{name}" so repeats don't collide; show just the name
    fileName: displayFileName(x.storagePath),
    fileType: fileTypeFromPath(x.storagePath),
    accountId: x.accountId ?? null,
    // What the import detected from the file (SCRUM-135)
    detectedAccountType: x.detectedAccountType ?? null,
    status: x.status ?? "uploaded", // uploaded → processing → completed | failed
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
    // Money is whole cents (SCRUM-150). `amount` is the same value in dollars, for the pages
    // that still show dollars; add up amountCents, never amount.
    amountCents: txnCents(x),
    amount: centsToDollars(txnCents(x)),
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
  // How many transactions each finished import saved: importId -> count, counted from the
  // transactions collection (the import record doesn't store it, Sprint 5 #2)
  const [importCounts, setImportCounts] = useState({ uid: null, counts: {} });
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(PROFILE);
  const [customCategories, setCustomCategories] = useState([]);
  // users/{uid}/budgetMonths: one record per month whose budget was set (SCRUM-137)
  const [monthMarkerState, setMonthMarkerState] = useState({ uid: null, list: [] });
  const monthMarkers = uid && monthMarkerState.uid === uid ? monthMarkerState.list : null; // null = loading
  // Budgets the user removed (soft deleted). Not shown, but remembered so that setting a
  // limit on one restores it first.
  const deletedBudgetIds = useRef(new Set());

  /**
   * Sets the monthly limit (in dollars) for a category: creates the budget or changes it.
   * It is saved as whole cents (limitCents, SCRUM-148).
   * source is "user" for a limit typed in, "auto" for one Auto budget chose (only
   * those are refreshed by the monthly budget, SCRUM-137).
   * The live listener below puts it on screen right away.
   * Returns true when it worked and false when it didn't.
   */
  const setBudgetLimit = useCallback(
    async (categoryId, limit, source = "user") => {
      if (!uid) return false;
      const limitCents = dollarsToCents(limit);
      if (!Number.isInteger(limitCents) || limitCents < 0) return false; // not a usable amount
      try {
        const ref = doc(db, "users", uid, "budgets", categoryId);
        // A removed budget is only soft deleted, and the rules won't let a new limit
        // quietly undo that, so restore it first.
        if (deletedBudgetIds.current.has(categoryId)) {
          await updateDoc(ref, { deletedAt: null, deletedBy: null, purgeAfter: null, updatedAt: serverTimestamp() });
          deletedBudgetIds.current.delete(categoryId);
        }
        await setDoc(ref, { categoryId, limitCents, source, updatedAt: serverTimestamp() });
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
              limit: budgetLimitDollars(d.data()),
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
            limit: budgetLimitDollars(d.data()),
            source: d.data().source ?? "user",
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

  // Live records of the months whose budget was set (SCRUM-137). Stored with the uid they
  // belong to, so after a sign-in change the old user's list reads as "still loading".
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      collection(db, "users", uid, "budgetMonths"),
      (snap) =>
        setMonthMarkerState({
          uid,
          list: snap.docs.map((d) => ({ month: d.id, auto: d.data().auto === true, savings: Number(d.data().savings) || 0 })),
        }),
      (err) => {
        console.error("Could not load budget months:", err.code, err.message);
        setMonthMarkerState({ uid, list: [] });
      }
    );
  }, [uid]);

  /**
   * Remembers the savings kept when the user applied Auto budget for a month, so next
   * month's budget keeps the same amount (SCRUM-137). Also marks that month as set.
   */
  const saveMonthSavings = useCallback(
    async (month, savings) => {
      if (!uid) return;
      const ref = doc(db, "users", uid, "budgetMonths", month);
      try {
        if (monthMarkers?.some((m) => m.month === month)) {
          await updateDoc(ref, { savings, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, { month, auto: false, savings, createdAt: serverTimestamp() });
        }
      } catch (err) {
        console.error("Could not save the month's savings:", err.code, err.message);
      }
    },
    [uid, monthMarkers]
  );
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

  /**
   * The budget sets itself at the start of each month (SCRUM-137). The first time the app
   * opens in a month that has no budget record yet, Auto budget runs on the recent spending
   * (planMonthlyBudget): it fills in categories with no budget and refreshes the ones it set
   * before, keeps last month's savings, and never touches a limit the user typed in or a
   * budget they removed. No scheduled job: it happens on the first visit.
   * The month's record is written first. Only one tab (or device) can create it (the rules
   * refuse a second one), so the budget is never set twice.
   */
  const autoBudgetKey = useRef(null); // what was last tried, so it doesn't retry on every render
  useEffect(() => {
    if (!uid || serverBudgets === null || serverTransactions === null || monthMarkers === null) return;
    if (monthMarkers.some((m) => m.month === CURRENT_MONTH)) return; // already set this month
    const key = `${uid}:${CURRENT_MONTH}:${transactions.length}`;
    if (autoBudgetKey.current === key) return;
    autoBudgetKey.current = key;

    const { writes, suggestion } = planMonthlyBudget({
      transactions,
      month: CURRENT_MONTH,
      categories,
      budgets: serverBudgets,
      deletedCategoryIds: [...deletedBudgetIds.current],
      monthlyIncome: profile.monthlyIncome,
      savings: carriedOverSavings(monthMarkers, CURRENT_MONTH),
    });
    if (writes.length === 0) return; // nothing to learn from yet; try again when data arrives

    (async () => {
      try {
        await setDoc(doc(db, "users", uid, "budgetMonths", CURRENT_MONTH), {
          month: CURRENT_MONTH,
          auto: true,
          savings: suggestion.savings,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        // Usually another tab got there first; either way, don't set it twice
        console.warn("Monthly budget already being set:", err.code);
        return;
      }
      for (const w of writes) await setBudgetLimit(w.categoryId, w.limit, "auto");
    })();
  }, [uid, serverBudgets, serverTransactions, monthMarkers, transactions, categories, profile.monthlyIncome, setBudgetLimit]);

  // The current month's record when the budget set itself, for the dashboard banner
  const autoBudgetMonth = monthMarkers?.find((m) => m.month === CURRENT_MONTH && m.auto) ?? null;
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
  /** Adds a transaction typed in by the user. `date` is "YYYY-MM-DD"; amountCents < 0 = spending. */
  const addTransaction = useCallback(
    async ({ date, merchant, amountCents, category, accountId }) => {
      if (!uid) throw new Error("You need to be logged in.");
      if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error("Enter an amount greater than $0.");
      try {
        await addDoc(collection(db, "transactions"), {
          userId: uid, // the owner; the rules only accept your own uid here
          // Noon UTC, same as imported transactions, so the day never shifts with time zones
          date: Timestamp.fromDate(new Date(`${date}T12:00:00Z`)),
          merchant,
          amountCents,
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
    async (id, { date, merchant, amountCents, category, accountId }) => {
      if (!uid) throw new Error("You need to be logged in.");
      if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error("Enter an amount greater than $0.");
      try {
        await updateDoc(doc(db, "transactions", id), {
          date: Timestamp.fromDate(new Date(`${date}T12:00:00Z`)),
          merchant,
          amountCents,
          amount: deleteField(), // an older transaction may still have the dollar field; cents replace it
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

  // Count each finished import's transactions once, with a count() query on the transactions
  // collection (one small read per import, not the transactions themselves). Imported
  // transactions can't be added to or removed one by one, so a finished import's count never
  // changes; deleting a statement only marks its transactions, so the count still holds.
  useEffect(() => {
    if (!uid || !serverImports) return;
    const known = importCounts.uid === uid ? importCounts.counts : {};
    const missing = serverImports.filter((s) => s.status === "completed" && !(s.id in known));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const found = {};
      await Promise.all(
        missing.map(async (s) => {
          try {
            const snap = await getCountFromServer(
              // The rules need the userId filter on every transactions query
              query(collection(db, "transactions"), where("userId", "==", uid), where("sourceStatementId", "==", s.id))
            );
            found[s.id] = snap.data().count;
          } catch (err) {
            console.error("Could not count an import's transactions:", err.code, err.message);
          }
        })
      );
      if (cancelled || Object.keys(found).length === 0) return;
      setImportCounts((prev) => ({ uid, counts: { ...(prev.uid === uid ? prev.counts : {}), ...found } }));
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, serverImports, importCounts]);

  // A server import with its count: a number once counted, 0 for an import that didn't
  // finish, null while it's still being counted
  const withCount = useCallback(
    (s) => {
      const counts = importCounts.uid === uid ? importCounts.counts : {};
      return { ...s, transactionCount: s.status === "completed" ? (counts[s.id] ?? null) : 0 };
    },
    [importCounts, uid]
  );

  const statements = useMemo(() => {
    const serverPaths = new Set((serverImports ?? []).map((s) => s.storagePath));
    // Hide a pending row once the server has its own doc for the same file
    const pending = pendingUploads.filter((p) => !p.storagePath || !serverPaths.has(p.storagePath));
    // Deleted statements are hidden (their transactions are too, since they carry deletedAt)
    const server = (serverImports ?? []).filter((s) => !dismissedIds.has(s.id) && !s.deletedAt).map(withCount);
    return [...pending, ...server];
  }, [pendingUploads, serverImports, dismissedIds, withCount]);

  const statementsLoading = Boolean(uid) && serverImports === null;

  // Deleted statements, newest deletion first (the Import page's "Recently deleted", SCRUM-121)
  const deletedStatements = useMemo(
    () =>
      (serverImports ?? [])
        .filter((s) => s.deletedAt)
        .map(withCount)
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [serverImports, withCount]
  );

  /**
   * Brings back a deleted statement and its transactions (SCRUM-121). The
   * restoreImport Cloud Function clears the delete fields; the live listeners then
   * put the row and the transactions back on every page.
   * Throws an Error with a message that can be shown to the user.
   */
  const restoreStatement = useCallback(async (id) => {
    try {
      const { data } = await httpsCallable(functions, "restoreImport")({ importId: id });
      return data; // { restoredTransactions }
    } catch (err) {
      console.error("Could not restore import:", err.code, err.message);
      // The function's own errors (too late, not deleted...) have readable messages
      const readable = ["functions/not-found", "functions/failed-precondition", "functions/permission-denied", "functions/unauthenticated"];
      throw new Error(readable.includes(err.code) ? err.message : "We couldn't restore this statement. Please try again.");
    }
  }, []);

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
      autoBudgetMonth,
      deletedStatements,
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
      saveMonthSavings,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
      deleteStatement,
      restoreStatement,
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
      autoBudgetMonth,
      deletedStatements,
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
      saveMonthSavings,
      addCategory,
      addStatement,
      updateStatement,
      removeStatement,
      deleteStatement,
      restoreStatement,
      saveProfile,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
