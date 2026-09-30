/**
 * AuthLayout.jsx
 *
 * Shared page shell for every authentication and onboarding screen
 * (Login, Signup, ConsentScreen). It centers a single card on the dark
 * theme background, so all auth screens look the same and each screen
 * only has to supply its own form content.
 *
 * Part of: Account & Onboarding epic (Sprint 2)
 *
 * @example
 * <AuthLayout title="Log in" subtitle="Welcome back">
 *   <LoginForm />
 * </AuthLayout>
 *
 * @param {Object}          props
 * @param {string}          [props.title]    Heading shown at the top of the card. Omitted if not provided.
 * @param {string}          [props.subtitle] Smaller muted text under the heading. Omitted if not provided.
 * @param {React.ReactNode} props.children   The screen's content (form fields, buttons, etc.).
 * @returns {JSX.Element}
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    // Full-height page: centers the card both vertically and horizontally.
    // `relative overflow-hidden` contains the decorative glow layer below.
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans relative overflow-hidden">
      {/*
        Decorative background glow: a faint green radial gradient at the top
        center of the page. Purely visual, so:
          - pointer-events-none keeps it from blocking clicks on the card
          - aria-hidden hides it from screen readers
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px circle at 50% 0%, rgba(57,214,122,0.08), transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* Content column, capped at a narrow width so forms stay readable. */}
      <div className="w-full max-w-sm relative">
        {/* App wordmark shown above the card. */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="font-mono text-lg font-semibold text-green">Budgetly</span>
        </div>

        {/* The card itself. Each auth screen's content is rendered inside it. */}
        <div className="bg-surface border border-line rounded-lg p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Title and subtitle are optional; each renders only when it is passed in. */}
          {title && (
            <h1 className="text-xl font-semibold text-textLight mb-1">{title}</h1>
          )}
          {subtitle && (
            <p className="text-sm text-textMuted mb-6">{subtitle}</p>
          )}

          {/* Screen-specific content supplied by the parent component. */}
          {children}
        </div>
      </div>
    </div>
  );
}