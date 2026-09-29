/**
 * ConsentScreen.jsx
 *
 * Shown after signup and before the app touches any financial data.
 * It lists each permission in plain language and requires the user to
 * check every box before "Agree and continue" is enabled.
 *
 * This implements the cross-platform rule "consent screen before any data
 * access" from docs/ui-constraints.md. The mobile app should present the
 * same three permissions with the same wording.
 *
 * Part of: Account & Onboarding epic (Sprint 2)
 *
 * NOTE: This component only tracks the checkboxes on screen. It does not
 * save anything. The parent's `onContinue` handler is responsible for
 * recording the consent (for example, writing a `consentGivenAt` timestamp
 * to the user's Firestore document) before sending the user to the dashboard.
 *
 * @example
 * <ConsentScreen
 *   onContinue={() => saveConsentAndGoToDashboard()}
 *   onDecline={() => signOut()}
 * />
 *
 * @param {Object}   props
 * @param {Function} props.onContinue  Called when the user agrees to all items.
 * @param {Function} [props.onDecline] Called when the user clicks "Not right now".
 *                                     If omitted, that button is not shown.
 * @returns {JSX.Element}
 */
import { useState } from "react";
import AuthLayout from "./AuthLayout";

/**
 * The permissions the user must agree to.
 *
 * Each item has:
 *   - key:    unique ID, used as the key in the `checked` state object
 *   - label:  the main line the user reads
 *   - detail: a short explanation of how the data is used
 *
 * To add or change a permission, edit this array. The UI and the
 * "all checked" requirement update automatically.
 * Keep the wording in sync with docs/ai-integration-plan.md
 * (the AI receives merchant, amount, and date only).
 */
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
  // Tracks which boxes are checked, keyed by item.key.
  // Example: { statementData: true, storage: false }
  // Starts empty, which means nothing is checked.
  const [checked, setChecked] = useState({});

  // True only when every consent item is checked. Controls whether the
  // "Agree and continue" button is enabled.
  const allChecked = CONSENT_ITEMS.every((item) => checked[item.key]);

  /**
   * Flips one checkbox between checked and unchecked.
   * Builds a new state object from the previous one instead of mutating it,
   * so React sees the change and re-renders.
   *
   * @param {string} key The `key` of the consent item that was clicked.
   */
  function toggle(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <AuthLayout
      title="Before we get started"
      subtitle="Here's exactly what you're giving us permission to do."
    >
      {/* One checkbox row per permission. */}
      <div className="space-y-3 mb-6">
        {CONSENT_ITEMS.map((item) => (
          // Wrapping the whole row in a <label> makes the entire row
          // clickable, not just the small checkbox. This is easier to use
          // and better for accessibility.
          <label
            key={item.key}
            className="flex items-start gap-3 bg-charcoal border border-line rounded-md p-3 cursor-pointer hover:border-green/40 transition-colors"
          >
            <input
              type="checkbox"
              // `!!` turns undefined (never clicked) into false, so the
              // input is always a controlled component.
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

      {/* Primary action. Disabled (and visually faded) until every item is checked. */}
      <button
        onClick={onContinue}
        disabled={!allChecked}
        className="w-full bg-green text-charcoal font-medium text-sm rounded-md py-2.5 hover:bg-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Agree and continue
      </button>

      {/* Secondary action. Only shown when the parent passes an onDecline handler. */}
      {onDecline && (
        <button
          onClick={onDecline}
          className="w-full text-textMuted text-sm text-center mt-3 hover:text-textLight transition-colors"
        >
          Not right now
        </button>
      )}

      {/* Reassurance that consent can be changed later.
          TODO: Build the Settings page that lets users review and revoke these permissions. */}
      <p className="text-xs text-textMuted text-center mt-5">
        You can review or revoke these permissions anytime in Settings.
      </p>
    </AuthLayout>
  );
}