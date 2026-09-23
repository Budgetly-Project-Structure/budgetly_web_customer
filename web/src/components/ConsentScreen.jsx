import { useState } from "react";
import AuthLayout from "./AuthLayout";

const CONSENT_ITEMS = [
  {
    key: "statementData",
    label: "Read the bank statements I upload",
    detail: "Used only to extract transactions for categorization and budgeting.",
  },
  {
    key: "storage",
    label: "Store my transaction data securely",
    detail: "Encrypted at rest. Account numbers are masked everywhere in the app.",
  },
  {
    key: "aiCategorization",
    label: "Send transaction details to an AI model for categorization",
    detail: "Merchant, amount, and date only — never your full account number.",
  },
];

export default function ConsentScreen({ onContinue, onDecline }) {
  const [checked, setChecked] = useState({});
  const allChecked = CONSENT_ITEMS.every((item) => checked[item.key]);

  function toggle(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <AuthLayout
      title="Before we get started"
      subtitle="Here's exactly what you're giving us permission to do."
    >
      <div className="space-y-3 mb-6">
        {CONSENT_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-3 bg-charcoal border border-line rounded-md p-3 cursor-pointer hover:border-green/40 transition-colors"
          >
            <input
              type="checkbox"
              checked={!!checked[item.key]}
              onChange={() => toggle(item.key)}
              className="mt-0.5 w-4 h-4 rounded border-line bg-charcoal accent-green shrink-0"
            />
            <span>
              <span className="block text-sm text-textLight font-medium">{item.label}</span>
              <span className="block text-xs text-textMuted mt-0.5">{item.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!allChecked}
        className="w-full bg-green text-charcoal font-medium text-sm rounded-md py-2.5 hover:bg-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Agree and continue
      </button>

      {onDecline && (
        <button
          onClick={onDecline}
          className="w-full text-textMuted text-sm text-center mt-3 hover:text-textLight transition-colors"
        >
          Not right now
        </button>
      )}

      <p className="text-xs text-textMuted text-center mt-5">
        You can review or revoke these permissions anytime in Settings.
      </p>
    </AuthLayout>
  );
}