/**
 * accounts.js (SCRUM-167)
 *
 * Helpers for the user's accounts: users/{uid}'s checking accounts and credit cards, stored in
 * the top-level `accounts` collection (budgetly_contracts schemas/data-model.md). Only the
 * account document describes an account; transactions and statements keep just its id.
 * Pure functions, no Firebase.
 */

/** The limits the Firestore rules enforce */
export const INSTITUTION_MAX = 60;
export const NICKNAME_MAX = 40;

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking account" },
  { value: "credit", label: "Credit card" },
];

/** What the app shows for an account: the nickname, or "Chase checking" / "Chase card". */
export function accountName({ nickname, institution, type }) {
  if (nickname) return nickname;
  return `${institution} ${type === "credit" ? "card" : "checking"}`.trim();
}

/**
 * A Firestore account document, in the shape the pages use ({ id, name, type, last4 ... }).
 * A deleted account shows as "Deleted account", with no digits (data-model.md).
 */
export function toAccount(id, x) {
  const deleted = x.deletedAt != null;
  return {
    id,
    type: x.type,
    institution: x.institution ?? "",
    last4: deleted ? null : (x.last4 ?? null),
    nickname: x.nickname ?? null,
    name: deleted ? "Deleted account" : accountName(x),
    deleted,
    deletedAt: deleted ? (x.deletedAt.toDate?.().toISOString() ?? null) : null,
    purgeAfter: deleted ? (x.purgeAfter?.toDate?.().toISOString() ?? null) : null,
  };
}

/**
 * Checks what the user typed, with the same limits as the rules. Returns the cleaned values
 * (empty last4 and nickname become null) or an error message to show.
 *
 * @param {{type: string, institution: string, last4: string, nickname: string}} input
 * @returns {{ok: true, values: {type: string, institution: string, last4: string|null, nickname: string|null}} | {ok: false, error: string}}
 */
export function cleanAccountInput({ type, institution = "", last4 = "", nickname = "" }) {
  const inst = institution.trim();
  const nick = nickname.trim();
  const digits = last4.trim();
  if (type !== "checking" && type !== "credit") return { ok: false, error: "Choose checking account or credit card." };
  if (!inst) return { ok: false, error: "Enter the bank or card company, for example Chase." };
  if (inst.length > INSTITUTION_MAX) return { ok: false, error: `Keep the bank name under ${INSTITUTION_MAX} characters.` };
  // Only the last 4 digits, never the whole number
  if (digits && !/^[0-9]{4}$/.test(digits)) return { ok: false, error: "Enter only the last 4 digits of the account number, or leave it empty." };
  if (nick.length > NICKNAME_MAX) return { ok: false, error: `Keep the nickname under ${NICKNAME_MAX} characters.` };
  return { ok: true, values: { type, institution: inst, last4: digits || null, nickname: nick || null } };
}
