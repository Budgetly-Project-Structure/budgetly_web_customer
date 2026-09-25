import { useState } from "react";
import AuthLayout from "./AuthLayout";

export default function Login({ onSubmit, onSwitchToSignup, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit?.({ email, password });
    } catch (err) {
      setError(err?.message || "Couldn't log you in. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back to your budget.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-textMuted mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-textMuted" htmlFor="password">
              Password
            </label>
            {onForgotPassword && (
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

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