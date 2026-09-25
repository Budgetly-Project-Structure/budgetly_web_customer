/**
 * Shared shell for auth screens: centered card on the dark theme background.
 * Usage: <AuthLayout title="Log in" subtitle="Welcome back">...form...</AuthLayout>
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-[Inter,system-ui,sans-serif] relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px circle at 50% 0%, rgba(57,214,122,0.08), transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="font-mono text-lg font-semibold text-green">Ledger</span>
        </div>

        <div className="bg-surface border border-line rounded-lg p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {title && (
            <h1 className="text-xl font-semibold text-textLight mb-1">{title}</h1>
          )}
          {subtitle && (
            <p className="text-sm text-textMuted mb-6">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}