/**
 * ImportPage.jsx
 *
 * The "Import statements" page. Users pick which bank account a statement
 * belongs to, then drag-and-drop or browse for CSV/PDF files to upload.
 *
 * Flow for each file:
 *   1. validateStatementFile() checks type, emptiness, and the 10 MB limit (SCRUM-21)
 *   2. A row is added to Import history immediately with status "uploading"
 *   3. uploadStatement() sends the file to Firebase Storage at
 *      users/{uid}/imports/{timestamp}_{fileName}, reporting progress (SCRUM-22)
 *   4. The row switches to "uploaded" on success, or "failed" with a message
 *   5. On the server, the onStatementUploaded Cloud Function sees the new file,
 *      creates an Import record in Firestore, parses the file, saves the
 *      transactions, and sets the record to "completed" or "failed".
 *
 * Delete: finished imports (completed, partly read, or failed) have a Delete
 * button. After a confirm dialog it calls deleteStatement() (the softDeleteImport
 * Cloud Function, SCRUM-120), which marks the import record and every transaction
 * from it deleted for 30 days; the live listeners then update every page.
 *
 * Recently deleted (SCRUM-125): manual transactions and budgets the user deleted stay
 * recoverable for 30 days (a soft delete). This section lists them with a Restore button,
 * and shows how many days are left before the server removes them for good.
 *
 * Import history is live: FinanceProvider listens to users/{uid}/imports in
 * Firestore, so status changes (processing, completed, failed) appear here
 * without a refresh, and the history survives a page reload. A row for a file
 * still being uploaded from this browser is shown until the server's record
 * for it arrives.
 *
 * Part of: Statement Import epic (SCRUM-20 UI, SCRUM-21 validation, SCRUM-22 upload + progress,
 * SCRUM-27 skipped-row reporting, SCRUM-29 failed / empty / loading states)
 *
 * @returns {JSX.Element}
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { useToast } from "../components/ToastContext";
import { Card, EmptyState, LoadingState, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { formatAmount, formatCurrency, formatDate, formatDateTime, maskAccount } from "../lib/format";
import { validateStatementFile } from "../lib/importValidation";
import { uploadStatement } from "../lib/uploads";

/**
 * How each import status looks in the history list.
 * Every status has a label and an icon, not just a color, so it stays
 * readable for color-blind users (see docs/ui-constraints.md).
 *
 * Lifecycle: uploading → uploaded → processing → completed
 *                     ↘ failed (at any step)
 * "uploading" only exists in this browser. The rest come from the Cloud Function.
 */
const STATUS = {
  uploading: { tone: "neutral", icon: "upload", label: "Uploading" },
  uploaded: { tone: "ok", icon: "check", label: "Uploaded" }, // file is in Storage; waiting for the parser
  processing: { tone: "warn", icon: "sparkle", label: "Processing" },
  completed: { tone: "ok", icon: "check", label: "Imported" },
  failed: { tone: "danger", icon: "x", label: "Failed" },
};

/**
 * Formats a byte count for display, e.g. 107 → "107 B", 52000 → "51 KB".
 *
 * @param {number} n  Size in bytes
 * @returns {string}
 */
/**
 * "Are you sure?" dialog for deleting a statement. Escape or Cancel closes it.
 *
 * @param {Object}  statement  The Import history row being deleted
 * @param {boolean} deleting   True while the delete is running (buttons disabled)
 * @param {string}  [error]    Shown if the delete failed
 * @param {() => void} onConfirm
 * @param {() => void} onCancel
 */
function ConfirmDelete({ statement, deleting, error, onConfirm, onCancel }) {
  const n = statement.transactionCount;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onKeyDown={(e) => e.key === "Escape" && !deleting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="w-full max-w-md bg-surface border border-line rounded-lg p-5"
      >
        <h2 id="delete-title" className="text-base font-semibold text-textLight">
          Delete this statement?
        </h2>
        <p className="text-sm text-textMuted mt-2 break-words">
          This removes <span className="text-textLight">{statement.fileName}</span>
          {n > 0 ? ` and its ${n} ${n === 1 ? "transaction" : "transactions"}` : ""}. You can restore it within 30 days.
        </p>
        {error && (
          <p className="text-sm text-danger mt-3" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" autoFocus onClick={onCancel} disabled={deleting} className={buttonStyles.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 bg-danger text-charcoal font-medium text-sm rounded-md px-4 py-2 hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Whole days until the server may remove a soft-deleted item for good (null if unknown). */
function daysLeft(purgeAfter) {
  if (!purgeAfter) return null;
  return Math.max(0, Math.ceil((new Date(purgeAfter).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** "Removed for good in 29 days" */
function purgeNote(purgeAfter) {
  const n = daysLeft(purgeAfter);
  if (n === null) return "";
  if (n === 0) return "Removed for good today";
  return `Removed for good in ${n} ${n === 1 ? "day" : "days"}`;
}

/**
 * The "Recently deleted" list: manual transactions and budgets that were soft deleted.
 * Restore clears the delete fields; the live listeners then move the row back to its page.
 *
 * @param {Object[]} transactions  deletedTransactions from useFinance()
 * @param {Object[]} budgets       deletedBudgets from useFinance()
 * @param {Object[]} categories    to show category names
 * @param {(id: string) => Promise<void>} onRestoreTransaction
 * @param {(categoryId: string) => Promise<void>} onRestoreBudget
 */
function RecentlyDeleted({ transactions, budgets, categories, onRestoreTransaction, onRestoreBudget }) {
  // Which row is being restored (disables its button), and the error from the last try
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  async function run(key, restore, name) {
    setBusy(key);
    setError("");
    try {
      await restore();
      showToast({ message: `Restored ${name}` });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const categoryName = (id) => categories.find((c) => c.id === id)?.label ?? id;

  return (
    <Card title="Recently deleted" padded={false}>
      {error && (
        <p className="mx-5 mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-3 flex items-center gap-2" role="alert">
          <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {transactions.length === 0 && budgets.length === 0 ? (
        <EmptyState
          icon="trash"
          title="Nothing deleted recently"
          body="Transactions and budgets you delete stay here for 30 days, so you can bring them back."
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {transactions.map((t) => (
            <li key={t.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <p className="text-sm text-textLight break-words">
                  {t.merchant} <span className="text-textMuted">· {formatAmount(t.amount)}</span>
                </p>
                <p className="text-xs text-textMuted">
                  Transaction · {t.date ? formatDate(t.date) : ""} · {categoryName(t.category)} · {purgeNote(t.purgeAfter)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => run(`t-${t.id}`, () => onRestoreTransaction(t.id), `"${t.merchant}"`)}
                disabled={busy === `t-${t.id}`}
                className={buttonStyles.secondary}
                aria-label={`Restore ${t.merchant}`}
              >
                {busy === `t-${t.id}` ? "Restoring…" : "Restore"}
              </button>
            </li>
          ))}
          {budgets.map((b) => (
            <li key={b.categoryId} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <p className="text-sm text-textLight break-words">
                  {categoryName(b.categoryId)} <span className="text-textMuted">· {formatCurrency(b.limit)} / month</span>
                </p>
                <p className="text-xs text-textMuted">Budget · {purgeNote(b.purgeAfter)}</p>
              </div>
              <button
                type="button"
                onClick={() => run(`b-${b.categoryId}`, () => onRestoreBudget(b.categoryId), `the ${categoryName(b.categoryId)} budget`)}
                disabled={busy === `b-${b.categoryId}`}
                className={buttonStyles.secondary}
                aria-label={`Restore the ${categoryName(b.categoryId)} budget`}
              >
                {busy === `b-${b.categoryId}` ? "Restoring…" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportPage() {
  // Shared app data. statements = the Import history rows shown below.
  const {
    statements,
    statementsLoading,
    statementsError,
    accounts,
    categories,
    deletedTransactions,
    deletedBudgets,
    restoreTransaction,
    restoreBudget,
    addStatement,
    updateStatement,
    removeStatement,
    deleteStatement,
  } = useFinance();

  // Which bank account the next upload is for. Defaults to the first account.
  const [accountId, setAccountId] = useState(accounts[0].id);

  // True while a file is being dragged over the drop zone (highlights it).
  const [dragging, setDragging] = useState(false);

  // Validation errors for files that were rejected before uploading.
  const [errors, setErrors] = useState([]);

  // Upload progress per history row: { [statementId]: 0..100 }
  const [progress, setProgress] = useState({});

  // Delete: the row waiting for confirmation (null = dialog closed), whether the
  // delete is running, and the error to show if it failed
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteStatement(toDelete.id);
      setToDelete(null); // the live listener removes the row
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // The hidden <input type="file">. The "Browse files" button clicks it.
  const inputRef = useRef(null);

  /**
   * Uploads one file to Firebase Storage (SCRUM-22).
   *
   * Adds a row to Import history right away so the user sees instant feedback,
   * updates the progress bar while uploading, then marks the row "uploaded"
   * or "failed". The Cloud Function creates the Firestore import doc on its own
   * once the file lands in Storage; when that doc arrives (live, via
   * FinanceProvider) it replaces this temporary row. We remember the Storage
   * path so the provider can tell which server doc belongs to this row.
   *
   * @param {File} file  A file that already passed validateStatementFile()
   */
  async function startUpload(file) {
    // Temporary local id for this history row (not the Firestore doc id)
    const id = `stmt-${crypto.randomUUID()}`;

    addStatement({
      id,
      fileName: file.name,
      fileType: file.name.split(".").pop().toLowerCase(),
      accountId,
      uploadedAt: new Date().toISOString(),
      status: "uploading",
      transactionCount: 0,
      size: file.size,
    });

    try {
      const storagePath = await uploadStatement(file, {
        accountId,
        accountType: accounts.find((a) => a.id === accountId)?.type,
        onProgress: (pct) => setProgress((p) => ({ ...p, [id]: pct })),
      });
      updateStatement(id, { status: "uploaded", storagePath });
    } catch (err) {
      // err.message is already user-friendly (see friendlyUploadError in uploads.js)
      updateStatement(id, { status: "failed", error: err.message });
    }
  }

  /**
   * Handles files from either the drop zone or the file picker.
   * Valid files start uploading; invalid ones are listed in the error box.
   * Each file is handled on its own, so one bad file doesn't block the rest.
   *
   * @param {FileList|null} fileList
   */
  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    const errs = [];
    for (const f of files) {
      const err = validateStatementFile(f); // SCRUM-21: type + size checks before uploading
      if (err) errs.push(err);
      else startUpload(f);
    }
    setErrors(errs);
  }

  /** Looks up an account by id (for showing its name + masked number in history). */
  const acctById = (id) => accounts.find((a) => a.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import statements"
        description="Upload a CSV or PDF statement from your bank. We'll pull out the transactions and categorize them."
      />

      {/* ================= Upload card ================= */}
      <Card>
        <div className="pt-5 space-y-4">
          {/* ---------- Account picker ----------
              Account numbers are always masked (e.g. ••4821), never shown in full. */}
          <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
            <span className="text-textMuted">Which account is this statement for?</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputStyles}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {maskAccount(a.last4)}
                </option>
              ))}
            </select>
          </label>

          {/* ---------- Drop zone ----------
              preventDefault on dragOver/drop stops the browser from opening the
              file in a new tab instead of handing it to us. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragging ? "border-green bg-greenDim/40" : "border-line bg-charcoal"
            }`}
          >
            <span className="mx-auto w-12 h-12 rounded-full bg-surface border border-line flex items-center justify-center text-green mb-4">
              <Icon name="upload" className="w-5 h-5" />
            </span>
            <p className="text-sm text-textLight font-medium">Drag and drop statements here</p>
            <p className="text-xs text-textMuted mt-1">CSV or PDF · up to 10 MB each</p>
            <button onClick={() => inputRef.current?.click()} className={`${buttonStyles.secondary} mt-5`}>
              Browse files
            </button>

            {/* Hidden file picker. `accept` only filters the dialog; real checks
                happen in validateStatementFile(), Storage rules, and the Cloud Function.
                Resetting value lets the user pick the same file again. */}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* ---------- Validation errors ----------
              Only shown when at least one file was rejected. */}
          {errors.length > 0 && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-3" role="alert">
              <p className="flex items-center gap-2 font-medium">
                <Icon name="alert" className="w-4 h-4" /> Some files weren't uploaded
              </p>
              <ul className="mt-1 ml-6 list-disc text-danger/90">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-textMuted flex items-center gap-1.5">
            <Icon name="check" className="w-3.5 h-3.5 text-green" />
            Account numbers are masked on import. We never store your full account number.
          </p>
        </div>
      </Card>

      {/* ================= Import history ================= */}
      <Card title="Import history" padded={false}>
        {/* Couldn't read history from Firestore (permissions, offline, ...) */}
        {statementsError && (
          <p className="mx-5 mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-3 flex items-center gap-2" role="alert">
            <Icon name="alert" className="w-4 h-4 shrink-0" /> {statementsError}
          </p>
        )}

        {statementsLoading && statements.length === 0 ? (
          // Waiting for the first snapshot from Firestore: don't flash "No statements yet"
          <LoadingState label="Loading your imports…" className="py-8" />
        ) : statements.length === 0 ? (
          <EmptyState icon="file" title="No statements yet" body="Your uploaded statements will show up here." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {statements.map((s) => {
              const st = STATUS[s.status] ?? STATUS.uploaded;
              const acct = acctById(s.accountId);
              // Imports made outside the app may have no account: just leave it out
              const details = [
                s.fileType.toUpperCase() + (s.size ? ` · ${formatBytes(s.size)}` : ""),
                acct && `${acct.name} ${maskAccount(acct.last4)}`,
                formatDateTime(s.uploadedAt),
              ].filter(Boolean);
              return (
                <li key={s.id} className="px-5 py-4">
                  {/* ---------- Row summary: file name, details, status chip ---------- */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-charcoal border border-line flex items-center justify-center text-textMuted shrink-0">
                      <Icon name="file" className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-[12rem]">
                      <p className="text-sm text-textLight break-all">{s.fileName}</p>
                      <p className="text-xs text-textMuted">{details.join(" · ")}</p>
                    </div>
                    {s.status === "completed" && (
                      <span className="text-xs text-textMuted">
                        {s.transactionCount} {s.transactionCount === 1 ? "transaction" : "transactions"}
                        {s.skippedRowCount > 0 ? ` imported, ${s.skippedRowCount} skipped` : ""}
                        {s.duplicateRowCount > 0
                          ? `${s.skippedRowCount > 0 ? "," : " imported,"} ${s.duplicateRowCount} already imported`
                          : ""}
                      </span>
                    )}
                    <StatusChip tone={st.tone} icon={st.icon}>
                      {st.label}
                    </StatusChip>
                    {/* Only finished imports the server knows about can be deleted */}
                    {s.fromServer && (s.status === "completed" || s.status === "failed") && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setToDelete(s);
                        }}
                        className="p-1.5 rounded-md text-textMuted hover:text-danger hover:bg-raised"
                        aria-label={`Delete ${s.fileName}`}
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* ---------- Status-specific details (one shows at a time) ---------- */}

                  {/* Uploading: progress bar driven by uploadStatement's onProgress (SCRUM-22) */}
                  {s.status === "uploading" && (
                    <div className="mt-3 ml-12 h-1.5 rounded-full bg-charcoal border border-line overflow-hidden">
                      <div
                        className="h-full bg-green transition-[width] duration-200"
                        style={{ width: `${progress[s.id] || 0}%` }}
                      />
                    </div>
                  )}

                  {/* Uploaded: file is safely in Storage; the parser starts in a moment */}
                  {s.status === "uploaded" && (
                    <p className="mt-2 ml-12 text-xs text-textMuted">Saved. Starting the import…</p>
                  )}

                  {/* Processing: the parser is reading the file */}
                  {s.status === "processing" && (
                    <p className="mt-2 ml-12 text-xs text-textMuted">Reading your transactions…</p>
                  )}

                  {/* Failed: show the friendly error with options to retry or dismiss */}
                  {s.status === "failed" && (
                    <div className="mt-3 ml-12 text-sm bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                      <p className="text-danger">{s.error || "Something went wrong with this import. Try uploading it again."}</p>
                      <div className="flex gap-4 mt-2">
                        {/* Nothing new in the file: uploading it again would fail the same way */}
                        {!s.error?.startsWith("Every transaction in this file was already imported") && (
                          <button onClick={() => inputRef.current?.click()} className="text-xs text-textLight hover:underline">
                            Try again
                          </button>
                        )}
                        {/* Server imports have Delete above; a failed upload from this browser can only be hidden */}
                        {!s.fromServer && (
                          <button onClick={() => removeStatement(s.id)} className="text-xs text-textMuted hover:text-textLight">
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed with skipped rows: some lines couldn't be read (SCRUM-27).
                      Icon + text, not color alone. Details are tucked into a disclosure. */}
                  {s.status === "completed" && s.skippedRowCount > 0 && (
                    <details className="mt-2 ml-12 text-xs">
                      <summary className="cursor-pointer text-warn flex items-center gap-1.5">
                        <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
                        Some rows couldn't be read. See which ones
                      </summary>
                      <ul className="mt-2 ml-5 list-disc text-textMuted space-y-0.5">
                        {s.rowErrors.slice(0, 10).map((e) => (
                          <li key={e.row}>
                            Line {e.row}: {e.reason}
                          </li>
                        ))}
                      </ul>
                      {s.skippedRowCount > Math.min(s.rowErrors.length, 10) && (
                        <p className="mt-1 ml-5 text-textMuted">…and {s.skippedRowCount - Math.min(s.rowErrors.length, 10)} more</p>
                      )}
                    </details>
                  )}

                  {/* Completed: transactions were saved */}
                  {s.status === "completed" && (
                    <Link to="/transactions" className="mt-2 ml-12 text-xs text-green hover:underline inline-block">
                      View transactions
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ================= Recently deleted (SCRUM-125) ================= */}
      <RecentlyDeleted
        transactions={deletedTransactions}
        budgets={deletedBudgets}
        categories={categories}
        onRestoreTransaction={restoreTransaction}
        onRestoreBudget={restoreBudget}
      />

      {toDelete && (
        <ConfirmDelete
          statement={toDelete}
          deleting={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}