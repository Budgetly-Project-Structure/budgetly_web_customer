import { useState } from "react";
import AuthLayout from "./AuthLayout";

export default function Signup({ onSubmit, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

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

    setLoading(true);
    try {
      await onSubmit?.({ name, email, password });
    } catch (err) {
      setError(err?.message || "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your spending in minutes.">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="At least 8 characters"
          />
        </div>

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

        {error && (
          <p className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green text-charcoal font-medium text-sm rounded-md py-2.5 hover:bg-green/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

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