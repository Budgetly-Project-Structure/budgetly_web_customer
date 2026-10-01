import { useState } from "react";
import { Card, PageHeader, StatusChip, buttonStyles, inputStyles } from "../components/ui";
import { useFinance } from "../data/FinanceContext";
import { maskAccount } from "../lib/format";

// Mirrors the items on the consent screen so users can review/revoke them later.
const PERMISSIONS = [
  { key: "statementData", label: "Read uploaded bank statements", detail: "Needed to import transactions." },
  { key: "storage", label: "Store my transaction data", detail: "Encrypted at rest; account numbers masked." },
  { key: "aiCategorization", label: "AI categorization", detail: "Merchant, amount and date are sent to the AI model." },
];

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

export default function SettingsPage() {
  const { profile, setProfile, accounts } = useFinance();
  const [name, setName] = useState(profile.displayName);
  const [saved, setSaved] = useState(false);
  const [perms, setPerms] = useState({ statementData: true, storage: true, aiCategorization: true });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = name.trim() !== profile.displayName;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Your profile, accounts and data permissions." />

      <Card title="Profile">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // TODO: updateProfile(auth.currentUser, { displayName }) + Firestore user doc
            setProfile({ ...profile, displayName: name.trim() });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-textMuted mb-1.5">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputStyles} w-full`} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-textMuted mb-1.5">Email</span>
              <input value={profile.email} disabled className={`${inputStyles} w-full opacity-60`} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!dirty || !name.trim()} className={buttonStyles.primary}>
              Save changes
            </button>
            {saved && (
              <StatusChip tone="ok" icon="check">
                Saved
              </StatusChip>
            )}
          </div>
        </form>
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
