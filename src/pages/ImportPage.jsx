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
 *   5. On the server, the onStatementUploaded Cloud Function (SCRUM-23) sees the
 *      new file and creates an Import record in Firestore. This page doesn't
 *      need to do anything for that step.
 *
 * Current limitation:
 *   Import history is stored in local state (FinanceProvider), not Firestore,
 *   so it clears on page refresh. See the TODO in startUpload().
 *
 * Part of: Statement Import epic (SCRUM-20 UI, SCRUM-21 validation, SCRUM-22 upload + progress)
 *
 * @returns {JSX.Element}
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card, EmptyState, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { formatDateTime, maskAccount } from "../lib/format";
import { validateStatementFile } from "../lib/importValidation";
import { uploadStatement } from "../lib/uploads";

/**
 * How each import status looks in the history list.
 * Every status has a label and an icon, not just a color, so it stays
 * readable for color-blind users (see docs/ui-constraints.md).
 *
 * Lifecycle: uploading → uploaded → processing → completed
 *                     ↘ failed (at any step)
 * "processing" and "completed" will be set by the parser (SCRUM-24/25/26).
 */
const STATUS = {
  uploading: { tone: "neutral", icon: "upload", label: "Uploading" },
  uploaded: { tone: "ok", icon: "check", label: "Uploaded" }, // file is in Storage; parsing comes in SCRUM-24/25
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
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportPage() {
  // Shared app data. statements = the Import history rows shown below.
  const { statements, accounts, addStatement, updateStatement, removeStatement } = useFinance();

  // Which bank account the next upload is for. Defaults to the first account.
  const [accountId, setAccountId] = useState(accounts[0].id);

  // True while a file is being dragged over the drop zone (highlights it).
  const [dragging, setDragging] = useState(false);

  // Validation errors for files that were rejected before uploading.
  const [errors, setErrors] = useState([]);

  // Upload progress per history row: { [statementId]: 0..100 }
  const [progress, setProgress] = useState({});

  // The hidden <input type="file">. The "Browse files" button clicks it.
  const inputRef = useRef(null);

  /**
   * Uploads one file to Firebase Storage (SCRUM-22).
   *
   * Adds a row to Import history right away so the user sees instant feedback,
   * updates the progress bar while uploading, then marks the row "uploaded"
   * or "failed". The Cloud Function (SCRUM-23) creates the Firestore import
   * doc on its own once the file lands in Storage.
   *
   * TODO: read history from Firestore users/{uid}/imports with onSnapshot()
   * instead of local state, so it survives a page refresh and shows the
   * server's status updates.
   *
   * @param {File} file  A file that already passed validateStatementFile()
   */
  async function startUpload(file) {
    // Temporary local id for this history row (not the Firestore doc id)
    const id = `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
      await uploadStatement(file, {
        accountId,
        onProgress: (pct) => setProgress((p) => ({ ...p, [id]: pct })),
      });
      updateStatement(id, { status: "uploaded" });
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
        {statements.length === 0 ? (
          <EmptyState icon="file" title="No statements yet" body="Your uploaded statements will show up here." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {statements.map((s) => {
              const st = STATUS[s.status];
              const acct = acctById(s.accountId);
              return (
                <li key={s.id} className="px-5 py-4">
                  {/* ---------- Row summary: file name, details, status chip ---------- */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-charcoal border border-line flex items-center justify-center text-textMuted shrink-0">
                      <Icon name="file" className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-[12rem]">
                      <p className="text-sm text-textLight break-all">{s.fileName}</p>
                      <p className="text-xs text-textMuted">
                        {s.fileType.toUpperCase()}
                        {s.size ? ` · ${formatBytes(s.size)}` : ""} · {acct?.name} {maskAccount(acct?.last4)} ·{" "}
                        {formatDateTime(s.uploadedAt)}
                      </p>
                    </div>
                    {s.status === "completed" && (
                      <span className="text-xs text-textMuted">{s.transactionCount} transactions</span>
                    )}
                    <StatusChip tone={st.tone} icon={st.icon}>
                      {st.label}
                    </StatusChip>
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

                  {/* Uploaded: file is safely in Storage; parsing isn't built yet */}
                  {s.status === "uploaded" && (
                    <p className="mt-2 ml-12 text-xs text-textMuted">Saved. Transactions will appear once processing is added.</p>
                  )}

                  {/* Processing: the parser is reading the file (SCRUM-24/25) */}
                  {s.status === "processing" && (
                    <p className="mt-2 ml-12 text-xs text-textMuted">Reading transactions and categorizing…</p>
                  )}

                  {/* Failed: show the friendly error with options to retry or dismiss */}
                  {s.status === "failed" && (
                    <div className="mt-3 ml-12 text-sm bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                      <p className="text-danger">{s.error}</p>
                      <div className="flex gap-4 mt-2">
                        <button onClick={() => inputRef.current?.click()} className="text-xs text-textLight hover:underline">
                          Upload a different file
                        </button>
                        <button onClick={() => removeStatement(s.id)} className="text-xs text-textMuted hover:text-textLight">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Completed: transactions were saved (SCRUM-26) */}
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
    </div>
  );
}