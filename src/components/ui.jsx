import Icon from "./Icon";

/** Title row at the top of every page. */
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

/** Bordered surface panel with an optional header row. */
export function Card({ title, action, children, className = "", padded = true }) {
  return (
    <section className={`bg-surface border border-line rounded-lg ${className}`}>
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

/** Round icon tile used next to category names. */
export function CategoryIcon({ category, size = "md" }) {
  const box = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const glyph = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span
      className={`${box} shrink-0 rounded-md bg-charcoal border border-line flex items-center justify-center text-textMuted`}
    >
      <Icon name={category?.icon} className={glyph} />
    </span>
  );
}

/** Colored status pill that always carries an icon + text (never color alone). */
export function StatusChip({ tone = "ok", icon, children }) {
  const tones = {
    ok: "bg-greenDim text-green border-green/40",
    warn: "bg-warn/10 text-warn border-warn/40",
    danger: "bg-danger/10 text-danger border-danger/40",
    neutral: "bg-charcoal text-textMuted border-line",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${tones[tone]}`}>
      {icon && <Icon name={icon} className="w-3 h-3" strokeWidth={2.25} />}
      {children}
    </span>
  );
}

/** Friendly placeholder for "no data yet" / "no results". */
export function EmptyState({ icon = "file", title, body, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <span className="w-11 h-11 rounded-full bg-charcoal border border-line flex items-center justify-center text-textMuted mb-4">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-textLight">{title}</p>
      {body && <p className="text-sm text-textMuted mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 bg-green text-charcoal font-medium text-sm rounded-md px-4 py-2 hover:bg-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
  secondary:
    "inline-flex items-center justify-center gap-2 bg-surface border border-line text-textLight text-sm rounded-md px-4 py-2 hover:border-textMuted transition-colors",
  ghost: "inline-flex items-center gap-1 text-sm text-green hover:underline",
  danger:
    "inline-flex items-center justify-center gap-2 border border-danger/50 text-danger text-sm rounded-md px-4 py-2 hover:bg-danger/10 transition-colors",
};

export const inputStyles =
  "bg-charcoal border border-line rounded-md px-3 py-2 text-sm text-textLight placeholder:text-textMuted focus:outline-none focus:border-green transition-colors";
