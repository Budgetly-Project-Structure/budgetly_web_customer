/**
 * ManualTransactionForm.jsx (SCRUM-86)
 *
 * The form on the Transactions page for adding a transaction by hand, or
 * editing one that was added by hand. (Imported transactions can't be edited
 * here: the statement is the source of truth for those.)
 *
 * The user types the amount as a positive number and picks "Spending" or
 * "Income"; the sign is applied when saving (negative = spending, like the
 * rest of the app).
 *
 * @param {Object}   props
 * @param {Object}   [props.initial]   A transaction to edit. Leave out to add a new one.
 * @param {Object[]} props.categories  Options for the category dropdown
 * @param {Object[]} props.accounts    Options for the account dropdown
 * @param {(values: {date: string, merchant: string, amount: number, category: string, accountId: string|null}) => Promise<void>} props.onSave
 *        Saves it. Should throw an Error with a readable message if it fails.
 * @param {() => void} props.onCancel  Closes the form without saving
 */
import { useState } from "react";
import { Card, buttonStyles, inputStyles } from "./ui";

/** Today as "YYYY-MM-DD" in the user's own time zone (toISOString would use UTC). */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ManualTransactionForm({ initial, categories, accounts, onSave, onCancel }) {
  const editing = Boolean(initial);
  const [date, setDate] = useState(initial?.date ?? today());
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [type, setType] = useState(initial && initial.amount > 0 ? "income" : "spending");
  const [category, setCategory] = useState(initial?.category ?? "uncategorized");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const dollars = Math.round(Number(amount) * 100) / 100;
    // Check everything and say what's wrong, rather than silently doing nothing
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick a date.");
    if (!merchant.trim()) return setError("Enter a merchant or description.");
    if (!Number.isFinite(dollars) || dollars <= 0) return setError("Enter an amount greater than $0.");
    setError(null);
    setSaving(true);
    try {
      await onSave({
        date,
        merchant: merchant.trim().slice(0, 100),
        amount: type === "spending" ? -dollars : dollars,
        category,
        accountId: accountId || null,
      });
    } catch (err) {
      setError(err.message || "We couldn't save this transaction. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Card title={editing ? "Edit transaction" : "Add a transaction"} className="mb-4">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs text-textMuted">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${inputStyles} w-full mt-1`} />
        </label>
        <label className="text-xs text-textMuted">
          Merchant or description
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            maxLength={100}
            placeholder="e.g. Farmers market"
            required
            className={`${inputStyles} w-full mt-1`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-textMuted">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputStyles} w-full mt-1`}>
              <option value="spending">Spending</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label className="text-xs text-textMuted">
            Amount ($)
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className={`${inputStyles} w-full mt-1 font-mono`}
            />
          </label>
        </div>
        <label className="text-xs text-textMuted">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputStyles} w-full mt-1`}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-textMuted">
          Account (optional)
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputStyles} w-full mt-1`}>
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ••{a.last4}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={saving} className={buttonStyles.primary}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add transaction"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className={buttonStyles.secondary}>
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-3">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
