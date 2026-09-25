import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card, EmptyState, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { formatDateTime, maskAccount } from "../lib/format";
import { validateStatementFile } from "../lib/importValidation";

const STATUS = {
  uploading: { tone: "neutral", icon: "upload", label: "Uploading" },
  processing: { tone: "warn", icon: "sparkle", label: "Processing" },
  completed: { tone: "ok", icon: "check", label: "Imported" },
  failed: { tone: "danger", icon: "x", label: "Failed" },
};

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportPage() {
  const { statements, accounts, addStatement, updateStatement, removeStatement } = useFinance();
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState({}); // statementId -> 0..100
  const inputRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearInterval), []);

  /**
   * Simulated upload → processing → completed.
   * TODO: replace with uploadBytesResumable() to Firebase Storage; the parse Cloud Function
   * then updates the statement doc's status, which we'll read with onSnapshot().
   */
  function startUpload(file) {
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
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 12 + Math.random() * 18);
      setProgress((p) => ({ ...p, [id]: pct }));
      if (pct >= 100) {
        clearInterval(timer);
        updateStatement(id, { status: "processing" });
        const done = setTimeout(() => {
          updateStatement(id, { status: "completed", transactionCount: 20 + Math.floor(Math.random() * 20) });
        }, 1800);
        timers.current.push(done);
      }
    }, 250);
    timers.current.push(timer);
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    const errs = [];
    for (const f of files) {
      const err = validateStatementFile(f);
      if (err) errs.push(err);
      else startUpload(f);
    }
    setErrors(errs);
  }

  const acctById = (id) => accounts.find((a) => a.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import statements"
        description="Upload a CSV or PDF statement from your bank. We'll pull out the transactions and categorize them."
      />

      <Card>
        <div className="pt-5 space-y-4">
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

                  {s.status === "uploading" && (
                    <div className="mt-3 ml-12 h-1.5 rounded-full bg-charcoal border border-line overflow-hidden">
                      <div
                        className="h-full bg-green transition-[width] duration-200"
                        style={{ width: `${progress[s.id] || 0}%` }}
                      />
                    </div>
                  )}
                  {s.status === "processing" && (
                    <p className="mt-2 ml-12 text-xs text-textMuted">Reading transactions and categorizing…</p>
                  )}
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
