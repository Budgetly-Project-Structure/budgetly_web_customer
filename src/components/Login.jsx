/**
 * Login.jsx
 *
 * The login screen: an email and password form inside the shared AuthLayout card.
 *
 * This component handles only the UI: form state, basic validation,
 * the loading state, and showing errors. It does NOT call Firebase itself.
 * The parent passes an `onSubmit` function that does the actual sign-in
 * (for example, Firebase Auth's `signInWithEmailAndPassword`). Keeping it
 * this way makes the screen easy to test and reuse.
 *
 * Part of: Account & Onboarding epic, signup/login UI (Sprint 2)
 *
 * @example
 * <Login
 *   onSubmit={({ email, password }) => signInWithEmailAndPassword(auth, email, password)}
 *   onSwitchToSignup={() => navigate("/signup")}
 *   onForgotPassword={() => navigate("/reset-password")}
 * />
 *
 * @param {Object}   props
 * @param {Function} props.onSubmit            Async function called with `{ email, password }`.
 *                                             It should throw an Error if login fails; the
 *                                             error's message is shown to the user.
 * @param {Function} [props.onSwitchToSignup]  Goes to the signup screen. If omitted, the
 *                                             "Create an account" link is hidden.
 * @param {Function} [props.onForgotPassword]  Goes to password reset. If omitted, the
 *                                             "Forgot?" link is hidden.
 * @returns {JSX.Element}
 */
import { useState } from "react";
import AuthLayout from "./AuthLayout";

export default function Login({ onSubmit, onSwitchToSignup, onForgotPassword }) {
  // Controlled form fields: React state holds the current value of each input.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Error message shown above the submit button. An empty string means no error.
  const [error, setError] = useState("");

  // True while the sign-in request is in progress. Disables the button so
  // the user can't submit twice.
  const [loading, setLoading] = useState(false);

  /**
   * Runs when the form is submitted, by clicking "Log in" or pressing Enter.
   *
   * Steps:
   *   1. Stop the browser from reloading the page (the default form behavior).
   *   2. Clear any old error.
   *   3. Check that both fields are filled in.
   *   4. Call the parent's onSubmit and show its error message if it throws.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side check only. Firebase does the real credential check.
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      // `?.` means: only call onSubmit if the parent actually passed one in.
      await onSubmit?.({ email, password });
    } catch (err) {
      // NOTE: Firebase error messages are technical
      // (for example, "Firebase: Error (auth/invalid-credential).").
      // TODO: Map common `err.code` values to friendly messages before showing them.
      setError(err?.message || "Couldn't log you in. Check your credentials and try again.");
    } finally {
      // Always turn loading off, whether login succeeded or failed.
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back to your budget.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ---------- Email field ---------- */}
        <div>
          {/* htmlFor links this label to the input with id="email", so clicking
              the label focuses the input and screen readers announce the label. */}
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"   // lets browsers and password managers autofill
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="you@example.com"
          />
        </div>

        {/* ---------- Password field ---------- */}
        <div>
          {/* Label row: "Password" on the left, optional "Forgot?" link on the right. */}
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-textMuted" htmlFor="password">
              Password
            </label>
            {onForgotPassword && (
              // type="button" keeps this from submitting the form.
              // (Buttons inside a <form> default to type="submit".)
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-green hover:underline"
              >
                Forgot?
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"  // tells password managers this is an existing password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        {/* Submit button. Its text changes and it is disabled while loading. */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green text-charcoal font-medium text-sm rounded-md py-2.5 hover:bg-green/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      {/* Link to the signup screen. Sits outside the <form>, so it can't submit it. */}
      {onSwitchToSignup && (
        <p className="text-sm text-textMuted text-center mt-6">
          New here?{" "}
          <button onClick={onSwitchToSignup} className="text-green hover:underline">
            Create an account
          </button>
        </p>
      )}
    </AuthLayout>
  );
}