/**
 * SettingsPage.jsx
 *
 * The "/settings" page:
 *   - Profile and income: your display name (email is read-only) and your monthly
 *     income, used as the budget for a month with no deposits (SCRUM-84). Saved
 *     to users/{uid} in Firestore and to your Firebase Auth name.
 *   - Accounts: the bank accounts you've imported, with masked numbers (•••• 4521)
 *   - Data permissions: switches for the same three permissions as the consent screen
 *   - Danger zone: "Delete my data" with a confirm step
 *
 * Still local only: the permission toggles and "Delete my data" (they need a saved
 * permissions field and a deleteUserData Cloud Function).
 */
import { useState } from "react";
import { Card, PageHeader, buttonStyles, inputStyles } from "../components/ui";
import { useToast } from "../components/ToastContext";
import { useFinance } from "../data/FinanceContext";
import { maskAccount } from "../lib/format";

// Mirrors the items on the consent screen so users can review/revoke them later.
const PERMISSIONS = [
  { key: "statementData", label: "Read uploaded bank statements", detail: "Needed to import transactions." },
  { key: "storage", label: "Store my transaction data", detail: "Encrypted at rest; account numbers masked." },
  { key: "aiCategorization", label: "AI categorization", detail: "Merchant, amount and date are sent to the AI model." },
];

/**
 * An on/off switch. role="switch" + aria-checked make screen readers
 * announce it as a switch that is on or off.
 *
 * @param {boolean} checked
 * @param {(value: boolean) => void} onChange
 * @param {string} label  Read aloud by screen readers
 */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${
        checked ? "bg-green border-green" : "bg-charcoal border-line"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all ${
          checked ? "left-[1.125rem] bg-charcoal" : "left-0.5 bg-textMuted"
        }`}
      />
    </button>
  );
}

/**
 * Profile and budget settings (SCRUM-84): name and monthly income, saved to
 * users/{uid} through saveProfile(). Keyed by the saved values in SettingsPage,
 * so the boxes refill when the saved profile arrives from Firestore. The save
 * status lives in SettingsPage so "Saved" survives that refill.
 *
 * @param {Object} profile  { displayName, email, monthlyIncome }
 * @param {(fields: {displayName: string, monthlyIncome: number|null}) => Promise<void>} onSave
 * @param {string|null} status    "saving", "saved", an error message, or null
 * @param {(status: string|null) => void} setStatus
 */
function ProfileForm({ profile, onSave, status, setStatus }) {
  const { showToast } = useToast();
  // What's typed in the boxes. Income is text so the box can be empty (= not set).
  const [name, setName] = useState(profile.displayName);
  const [income, setIncome] = useState(profile.monthlyIncome == null ? "" : String(profile.monthlyIncome));

  const trimmed = name.trim();
  const incomeValue = income.trim() === "" ? null : Number(income);
  // Same limits as the Firestore rules: a name of 1-60 characters, income 0 to 10 million
  const nameError = !trimmed ? "Enter your name." : trimmed.length > 60 ? "Keep your name under 60 characters." : "";
  const incomeError =
    incomeValue !== null && (!Number.isFinite(incomeValue) || incomeValue < 0 || incomeValue > 10000000)
      ? "Enter a dollar amount of $0 or more, or leave it empty."
      : "";
  // Only enabled when something actually changed and both values are valid
  const dirty = trimmed !== profile.displayName || incomeValue !== (profile.monthlyIncome ?? null);
  const canSave = dirty && !nameError && !incomeError && status !== "saving";

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSave) return;
        setStatus("saving");
        try {
          // Whole cents only
          await onSave({ displayName: trimmed, monthlyIncome: incomeValue === null ? null : Math.round(incomeValue * 100) / 100 });
          setStatus(null);
          showToast({ message: "Settings saved" });
        } catch (err) {
          setStatus(err.message);
        }
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-xs font-medium text-textMuted mb-1.5">Name</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={`${inputStyles} w-full`} />
          {nameError && dirty && <span className="block text-xs text-danger mt-1">{nameError}</span>}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-textMuted mb-1.5">Email</span>
          <input value={profile.email} disabled className={`${inputStyles} w-full opacity-60`} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-textMuted mb-1.5">Monthly income (after taxes)</span>
          <span className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textMuted">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Not set"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className={`${inputStyles} w-full pl-7 font-mono`}
              aria-invalid={Boolean(incomeError)}
              aria-describedby="income-help"
            />
          </span>
          {incomeError && <span className="block text-xs text-danger mt-1">{incomeError}</span>}
        </label>
        <p id="income-help" className="text-xs text-textMuted sm:pt-6">
          Your budget is normally the money that comes in each month. For a month with no deposits (for example if you
          only import a credit card statement), this amount is used instead. Leave it empty if you don't need it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSave} className={buttonStyles.primary}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status && status !== "saving" && (
          <span className="text-sm text-danger" role="alert">
            {status}
          </span>
        )}
      </div>
    </form>
  );
}

/** Settings page component. */
export default function SettingsPage() {
  const { profile, saveProfile, accounts } = useFinance();
  // perms = the three permission switches; confirmDelete = second step of the delete button
  const [perms, setPerms] = useState({ statementData: true, storage: true, aiCategorization: true });
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Profile save status: "saving" while it runs, "saved" for 2 seconds after, or an error message
  const [profileStatus, setProfileStatus] = useState(null);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Your profile, monthly income, accounts and data permissions." />

      <Card title="Profile and income">
        {/* key: start the form over with the saved values whenever they change in Firestore */}
        <ProfileForm
          key={`${profile.displayName}|${profile.monthlyIncome ?? ""}`}
          profile={profile}
          onSave={saveProfile}
          status={profileStatus}
          setStatus={setProfileStatus}
        />
      </Card>

      <Card title="Accounts" padded={false}>
        <ul className="divide-y divide-line border-t border-line">
          {accounts.map((a) => (
            <li key={a.id} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-textLight">{a.name}</span>
              <span className="font-mono text-sm text-textMuted">{maskAccount(a.last4)}</span>
            </li>
          ))}
        </ul>
        <p className="px-5 py-3 text-xs text-textMuted border-t border-line">
          Accounts are added automatically when you import a statement.
        </p>
      </Card>

      <Card title="Data permissions" padded={false}>
        <ul className="divide-y divide-line border-t border-line">
          {PERMISSIONS.map((p) => (
            <li key={p.key} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-textLight">{p.label}</p>
                <p className="text-xs text-textMuted mt-0.5">{p.detail}</p>
                {!perms[p.key] && (
                  <p className="text-xs text-warn mt-1">
                    Revoked — {p.key === "aiCategorization" ? "new transactions will be Uncategorized." : "imports are paused."}
                  </p>
                )}
              </div>
              <Toggle
                checked={perms[p.key]}
                label={p.label}
                onChange={(v) => setPerms((prev) => ({ ...prev, [p.key]: v }))}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Danger zone">
        <p className="text-sm text-textMuted mb-4">
          Permanently delete all imported statements, transactions and budgets. This can't be undone.
        </p>
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-danger">Are you sure?</span>
            <button
              onClick={() => setConfirmDelete(false) /* TODO: call deleteUserData Cloud Function */}
              className={buttonStyles.danger}
            >
              Yes, delete everything
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-textMuted hover:text-textLight">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonStyles.danger}>
            Delete my data
          </button>
        )}
      </Card>
    </div>
  );
}
