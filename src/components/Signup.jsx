/**
 * Signup.jsx
 *
 * The account creation screen: name, email, password, and confirm-password
 * fields inside the shared AuthLayout card.
 *
 * Like Login, this component handles only the UI: form state, validation,
 * the loading state, and errors. The parent's `onSubmit` does the real work
 * (for example, Firebase Auth's `createUserWithEmailAndPassword`, then
 * saving the display name and creating the user's Firestore document).
 * After signup succeeds, the user should be sent to the ConsentScreen.
 *
 * Part of: Account & Onboarding epic, signup/login UI (Sprint 2)
 *
 * @example
 * <Signup
 *   onSubmit={async ({ name, email, password }) => {
 *     const cred = await createUserWithEmailAndPassword(auth, email, password);
 *     await updateProfile(cred.user, { displayName: name });
 *     navigate("/consent");
 *   }}
 *   onSwitchToLogin={() => navigate("/login")}
 * />
 *
 * @param {Object}   props
 * @param {Function} props.onSubmit          Async function called with `{ name, email, password }`.
 *                                           It should throw an Error if signup fails; the
 *                                           error's message is shown to the user.
 * @param {Function} [props.onSwitchToLogin] Goes to the login screen. If omitted, the
 *                                           "Log in" link is hidden.
 * @returns {JSX.Element}
 */
import { useState } from "react";
import AuthLayout from "./AuthLayout";

export default function Signup({ onSubmit, onSwitchToLogin }) {
  // Controlled form fields.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Only used for validation. It is not sent to onSubmit.
  const [confirmPassword, setConfirmPassword] = useState("");

  // Error message shown above the submit button. An empty string means no error.
  const [error, setError] = useState("");

  // True while the account is being created. Disables the submit button.
  const [loading, setLoading] = useState(false);

  /**
   * Runs when the form is submitted.
   *
   * Checks the fields in order and stops at the first problem, so the user
   * sees one clear message at a time:
   *   1. Every field is filled in
   *   2. The password is at least 8 characters
   *   3. The two passwords match
   * If all checks pass, it calls the parent's onSubmit.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  async function handleSubmit(e) {
    e.preventDefault(); // stop the page from reloading
    setError("");

    // --- Client-side validation ---
    // These checks give quick feedback. Firebase still enforces its own rules
    // (for example, a minimum of 6 characters, or "email already in use").
    // TODO: Trim whitespace from name and email before checking and submitting.
    if (!name || !email || !password) {
      setError("Fill in all fields to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    // --- Create the account ---
    setLoading(true);
    try {
      await onSubmit?.({ name, email, password });
    } catch (err) {
      // TODO: Map Firebase error codes (for example, auth/email-already-in-use)
      // to friendly messages, as noted in Login.jsx.
      setError(err?.message || "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your spending in minutes.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ---------- Full name ---------- */}
        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="Jane Doe"
          />
        </div>

        {/* ---------- Email ----------
            The ids use a "signup-" prefix so they never clash with the ids on
            the Login screen. HTML ids must be unique on a page. */}
        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="you@example.com"
          />
        </div>

        {/* ---------- Password ---------- */}
        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"  // tells password managers to suggest a new strong password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="At least 8 characters"
          />
        </div>

        {/* ---------- Confirm password ---------- */}
        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="••••••••"
          />
        </div>

        {/* Error message. Only rendered when there is one. */}
        {error && (
          <p className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit button. Disabled and relabeled while the account is being created. */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green text-charcoal font-medium text-sm rounded-md py-2.5 hover:bg-green/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      {/* Link back to the login screen. Outside the <form>, so it can't submit it. */}
      {onSwitchToLogin && (
        <p className="text-sm text-textMuted text-center mt-6">
          Already have an account?{" "}
          <button onClick={onSwitchToLogin} className="text-green hover:underline">
            Log in
          </button>
        </p>
      )}
    </AuthLayout>
  );
}