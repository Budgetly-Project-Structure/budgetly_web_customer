/**
 * Icon.jsx
 *
 * A small built-in icon set, so the app doesn't need an icon library
 * dependency. Every icon is a single SVG path drawn with strokes on a
 * 24x24 grid, in the same line style as the Feather / Lucide icons.
 *
 * Icons take their color from the surrounding text color
 * (`stroke="currentColor"`), so you color them with Tailwind text classes
 * such as `text-green` or `text-textMuted`, and size them with width and
 * height classes such as `w-4 h-4`.
 *
 * Used by: Layout (sidebar and top bar), UI components (StatusChip,
 * CategoryIcon, EmptyState), and any screen that needs an icon.
 *
 * @example
 * // Decorative icon (hidden from screen readers)
 * <Icon name="home" className="w-4 h-4" />
 *
 * // Meaningful icon on its own (read aloud by screen readers)
 * <Icon name="alert" className="w-5 h-5 text-warn" title="Over budget" />
 */

/**
 * Map of icon name → SVG path data (the `d` attribute of a <path>).
 *
 * To add an icon:
 *   1. Draw or copy a 24x24 stroke icon (Lucide is a good source; its icons are ISC licensed).
 *   2. If it has several <path> elements, join their `d` values with spaces into one string.
 *   3. Add it here under a short camelCase name.
 */
const PATHS = {
  // ----- Navigation and app actions -----
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  transactions: "M4 7h13l-3-3M20 17H7l3 3",
  budget: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  insights: "M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M9 18h6M10 21h4M12 8a4 4 0 0 0-2.5 7.1V18h5v-2.9A4 4 0 0 0 12 8z",
  import: "M12 3v12M7 10l5 5 5-5M4 17v3h16v-3",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7",

  // ----- Status (pair with a text label; see StatusChip) -----
  check: "M5 12.5 10 17 19 7",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  x: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6",

  // ----- Arrows and chevrons (trends, expanding rows, links) -----
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",

  // ----- Editing, files, and AI -----
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",

  // ----- Spending categories -----
  // These names are what a category's `icon` field refers to (see CategoryIcon).
  // When a new category is added to the data model, add its icon here too.
  dining: "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9",
  groceries: "M3 4h2l2.5 11h10.5L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  transportation: "M5 17h14M6 17v2M18 17v2M4 13l2-6h12l2 6v4H4zM7.5 14.5h.01M16.5 14.5h.01",
  subscriptions: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  shopping: "M6 7h12l1 14H5zM9 7a3 3 0 0 1 6 0",
  utilities: "M13 2 4 14h7l-1 8 9-12h-7z",
  entertainment: "M4 5h16v14H4zM10 9l5 3-5 3z",
  health: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  income: "M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5s2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  // Question-mark circle. Also used as the fallback for unknown icon names (see below),
  // and matches the "Uncategorized" fallback when AI categorization fails.
  uncategorized: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
};

/**
 * Renders one icon from PATHS as an inline SVG.
 *
 * @param {Object} props
 * @param {string} props.name                 Key from PATHS (for example "home" or "dining").
 *                                            An unknown or missing name shows the "uncategorized"
 *                                            icon instead of crashing. Watch for typos, since they
 *                                            fail silently.
 * @param {string} [props.className="w-4 h-4"] Tailwind classes for size and color.
 * @param {number} [props.strokeWidth=1.75]   Line thickness. Use a thicker value (~2–2.25) for very small icons.
 * @param {string} [props.title]              Accessible label. Pass this only when the icon has
 *                                            meaning on its own (no visible text next to it).
 * @returns {JSX.Element}
 */
export default function Icon({ name, className = "w-4 h-4", strokeWidth = 1.75, title }) {
  // Look up the path, falling back to the "?" icon if the name isn't in PATHS.
  const d = PATHS[name] || PATHS.uncategorized;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"                // outline icons: no fill, stroke only
      stroke="currentColor"      // inherits the parent's text color
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Accessibility:
      // - No title: the icon is decorative (text beside it says the same thing),
      //   so hide it from screen readers.
      // - Title given: expose it as an image, labeled by the <title> below.
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}