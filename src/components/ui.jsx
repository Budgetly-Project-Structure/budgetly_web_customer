/**
 * UI.jsx
 *
 * Shared building blocks used across the app's pages, so every screen looks
 * and behaves the same way. Change a style here and it updates everywhere.
 *
 * Components:
 *   - PageHeader:   title row at the top of each page
 *   - Card:         bordered panel for grouping content
 *   - CategoryIcon: small square icon tile for a spending category
 *   - StatusChip:   small colored badge (always icon and/or text, never color alone)
 *   - EmptyState:   placeholder for "no data yet" or "no results"
 *
 * Style constants (Tailwind class strings for plain HTML elements):
 *   - buttonStyles: primary / secondary / ghost / danger buttons
 *   - inputStyles:  text inputs and selects
 *
 * These follow docs/ui-constraints.md: muted palette, status never shown by
 * color alone, and empty states designed up front.
 *
 * @example
 * import { PageHeader, Card, StatusChip, EmptyState, buttonStyles } from "../components/UI";
 */
import Icon from "./Icon";
import { addMonths } from "../lib/finance";
import { formatMonth } from "../lib/format";

/**
 * Title row at the top of every page: a heading, an optional description,
 * and optional action buttons on the right.
 * On phones the actions stack under the title; from `sm` up they sit on the same row.
 *
 * @example
 * <PageHeader
 *   title="Transactions"
 *   description="Everything from your imported statements."
 *   actions={<Link to="/import" className={buttonStyles.primary}>Import</Link>}
 * />
 *
 * @param {Object}          props
 * @param {string}          props.title         Page heading, rendered as the page's <h1>.
 * @param {string}          [props.description] Muted line under the title.
 * @param {React.ReactNode} [props.actions]     Buttons or links shown on the right.
 */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-textLight">{title}</h1>
        {description && <p className="text-sm text-textMuted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * "< September 2026 >" arrows for stepping through months. "Next" is disabled
 * at `maxMonth` so the user can't go past today.
 *
 * @param {string} month      Shown month, "YYYY-MM"
 * @param {string} maxMonth   Latest month allowed (the real current month)
 * @param {(month: string) => void} onChange
 */
export function MonthSwitcher({ month, maxMonth, onChange }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        className="px-1.5 rounded hover:text-textLight"
        aria-label="Previous month"
      >
        &lt;
      </button>
      <span className="text-textLight">{formatMonth(month)}</span>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={month >= maxMonth}
        className="px-1.5 rounded hover:text-textLight disabled:opacity-30 disabled:hover:text-textMuted"
        aria-label="Next month"
      >
        &gt;
      </button>
    </span>
  );
}

/**
 * Bordered panel (a "card") for grouping related content.
 * If `title` or `action` is given, a header row is shown at the top.
 *
 * @example
 * <Card title="Recent transactions" action={<Link to="/transactions">View all</Link>}>
 *   <TransactionList />
 * </Card>
 *
 * @param {Object}          props
 * @param {string}          [props.title]         Heading in the card's header row.
 * @param {React.ReactNode} [props.action]        Element on the right side of the header row (for example, a link).
 * @param {React.ReactNode} props.children        The card's content.
 * @param {string}          [props.className=""]  Extra classes for the outer element (for example, grid spans).
 * @param {boolean}         [props.padded=true]   Adds inner padding. Set to false for content that
 *                                                should reach the edges, such as a full-width table.
 */
export function Card({ title, action, children, className = "", padded = true }) {
  return (
    // <section> gives screen readers a meaningful region instead of a plain div.
    <section className={`bg-surface border border-line rounded-lg ${className}`}>
      {/* Header row, only rendered when there's something to put in it. */}
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          {title && <h2 className="text-sm font-medium text-textLight">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? "px-5 pb-5" : ""}>{children}</div>
    </section>
  );
}

/**
 * Small square tile holding a category's icon. It is shown next to category
 * names in lists, tables, and budget rows.
 *
 * @example
 * <CategoryIcon category={{ name: "Dining Out", icon: "dining" }} />
 *
 * @param {Object}        props
 * @param {Object}        props.category      A category object. Only its `icon` field is used,
 *                                            and it must be a name from Icon.jsx's PATHS. A missing
 *                                            category or icon shows the "uncategorized" (?) icon.
 * @param {"sm" | "md"}   [props.size="md"]   "sm" = 28px tile (dense tables), "md" = 36px tile.
 */
export function CategoryIcon({ category, size = "md" }) {
  // Tile size and icon size for each option.
  const box = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const glyph = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span
      className={`${box} shrink-0 rounded-md bg-charcoal border border-line flex items-center justify-center text-textMuted`}
    >
      {/* `category?.icon` avoids a crash if category is undefined. Icon then falls back to "?". */}
      <Icon name={category?.icon} className={glyph} />
    </span>
  );
}

/**
 * Small colored status badge ("pill").
 *
 * Accessibility rule: always pass text as children, and ideally an icon too.
 * The color alone must never be the only way the status is shown.
 *
 * @example
 * <StatusChip tone="warn" icon="alert">Over budget</StatusChip>
 * <StatusChip tone="ok" icon="check">On track</StatusChip>
 *
 * @param {Object}                                  props
 * @param {"ok" | "warn" | "danger" | "neutral"}    [props.tone="ok"] Color scheme. A tone not in the
 *                                                                    list below gets no color classes.
 * @param {string}                                  [props.icon]      Icon name from Icon.jsx.
 * @param {React.ReactNode}                         props.children    The label text.
 */
export function StatusChip({ tone = "ok", icon, children }) {
  // Tailwind classes for each tone: tinted background, text color, border color.
  const tones = {
    ok: "bg-greenDim text-green border-green/40",       // good / on track / success
    warn: "bg-warn/10 text-warn border-warn/40",         // needs attention (for example, over budget)
    danger: "bg-danger/10 text-danger border-danger/40", // error / failed (for example, an import failed)
    neutral: "bg-charcoal text-textMuted border-line",   // informational / no status
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${tones[tone]}`}>
      {/* Thicker stroke so the tiny 12px icon stays legible. */}
      {icon && <Icon name={icon} className="w-3 h-3" strokeWidth={2.25} />}
      {children}
    </span>
  );
}

/**
 * Friendly placeholder for when there's nothing to show yet, such as a new
 * user with no imports, or a search with no results. Every list or table
 * should render one of these instead of an empty box.
 *
 * @example
 * <EmptyState
 *   icon="upload"
 *   title="No transactions yet"
 *   body="Import a bank statement to see your spending here."
 *   action={<Link to="/import" className={buttonStyles.primary}>Import a statement</Link>}
 * />
 *
 * @param {Object}          props
 * @param {string}          [props.icon="file"] Icon name from Icon.jsx, shown in a circle.
 * @param {string}          props.title         Short main message.
 * @param {string}          [props.body]        One or two sentences explaining what to do next.
 * @param {React.ReactNode} [props.action]      Optional button or link below the text.
 */
export function EmptyState({ icon = "file", title, body, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      {/* Circle holding the icon. */}
      <span className="w-11 h-11 rounded-full bg-charcoal border border-line flex items-center justify-center text-textMuted mb-4">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-textLight">{title}</p>
      {body && <p className="text-sm text-textMuted mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Tailwind class strings for buttons. They can be applied to <button> or <Link>
 * so both look identical.
 *
 *   primary:   solid green; the main action on a screen (use one per screen)
 *   secondary: outlined; other actions
 *   ghost:     text-only link style; low-emphasis actions such as "View all"
 *   danger:    red outline; destructive actions such as delete or revoke consent
 *
 * @example
 * <button className={buttonStyles.primary}>Save</button>
 * <Link to="/import" className={buttonStyles.secondary}>Import</Link>
 */
export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 bg-green text-charcoal font-medium text-sm rounded-md px-4 py-2 hover:bg-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
  secondary:
    "inline-flex items-center justify-center gap-2 bg-surface border border-line text-textLight text-sm rounded-md px-4 py-2 hover:border-textMuted transition-colors",
  ghost: "inline-flex items-center gap-1 text-sm text-green hover:underline",
  danger:
    "inline-flex items-center justify-center gap-2 border border-danger/50 text-danger text-sm rounded-md px-4 py-2 hover:bg-danger/10 transition-colors",
};

/**
 * Tailwind classes for text inputs and selects, matching the Login and Signup fields.
 * Doesn't set a width, so add `w-full` (or another width) where needed.
 *
 * @example
 * <input className={`w-full ${inputStyles}`} />
 */
export const inputStyles =
  "bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors";