/**
 * merchantName.js
 *
 * Turns the raw text a bank puts on a statement into a name a person would use:
 *
 *   "KWIK TRIP #412"            -> "Kwik Trip"
 *   "AMAZON.COM*2K4LP"          -> "Amazon"
 *   "DOORDASH*PANDA EXPRESS"    -> "Panda Express"
 *   "SQ *BLUE BOTTLE COFFEE"    -> "Blue Bottle Coffee"
 *   "WALMART SUPERCENTER"       -> "Walmart"
 *
 * Only the display changes. The raw statement text stays in Firestore, and the backend
 * still uses it to match merchants for the category cache. The web app shows the clean
 * name for imported transactions; manual ones are shown exactly as the user typed them.
 *
 * Pure functions with no imports, so they are easy to unit test.
 */

// Text some banks put in front of the real merchant: "POS DEBIT", "CHECKCARD 0412", "PURCHASE AUTHORIZED ON"
const BANK_PREFIX = /^(?:(?:pos|debit|credit|check\s?card|checkcard|purchase|recurring|ach)\b[\s-]*)+(?:authorized on\b\s*)?/i;
// Card processors and delivery apps that put their name in front of the merchant: "SQ *BLUE BOTTLE"
const PROCESSOR = /^(?:sq|tst|pp|sp|paypal|doordash|dd|grubhub|uber\s?eats|ubereats|ue)$/i;
// Words dropped from the END of a name ("Walmart Supercenter", "Chipotle Online", "Spotify USA")
const TRAILING_NOISE = new Set(["utility", "online", "usa", "us", "store", "supercenter", "restaurant", "inc", "llc", "ltd", "co", "com", "net", "org", "purchase", "pos"]);
// Two-letter state codes banks add at the end of a name: "STEAM PURCHASE WA", "SHELL OIL SPRINGFIELD MO" (SCRUM-168)
const STATE_CODES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
);
// State codes that are also everyday words ("PAY ME", "TRANSFER TO ME"): dropped only after a city
const WORD_STATE_CODES = new Set(["IN", "OR", "ME", "OK", "HI", "OH"]);
// Web address endings: "NETFLIX.COM", "AMAZON.COM"
const DOMAIN_ENDING = /\.(com|net|org|co|io|us)\b/gi;
// Kept in capitals
const ACRONYMS = new Set(["atm", "cvs", "bp", "usps", "ups", "irs", "dmv", "pnc", "hbo", "kfc", "ymca", "ikea", "ach", "pos", "tj", "ihop", "gnc", "at&t", "h&m"]);
// Small words kept in lower case inside a name: "Barnes and Noble", "Transfer to Savings"
const SMALL_WORDS = new Set(["and", "of", "the", "to", "for", "at", "in", "on", "a", "an"]);
// Names that title case gets wrong
const SPECIAL = {
  mcdonalds: "McDonald's",
  "trader joes": "Trader Joe's",
  "culvers": "Culver's",
  doordash: "DoorDash",
  youtube: "YouTube",
  "hy-vee": "Hy-Vee",
  hyvee: "Hy-Vee",
  paypal: "PayPal",
  venmo: "Venmo",
  "at&t": "AT&T",
  "wendys": "Wendy's",
  "arbys": "Arby's",
  "dominos": "Domino's",
  "lowes": "Lowe's",
  "kohls": "Kohl's",
  "macys": "Macy's",
  "sams club": "Sam's Club",
};

/** "kwik trip" -> "Kwik Trip", keeping acronyms ("CVS") and apostrophe names correct. */
function titleCase(text) {
  return text
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return word.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      // "o'brien" -> "O'Brien"; a hyphen, slash or & starts a new capital: "hy-vee" -> "Hy-Vee"
      return lower.replace(/(^|[-/&])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/**
 * The name to show for an imported transaction.
 * Falls back to the original text (title-cased) if cleaning would leave nothing.
 *
 * @param {string} raw  The merchant text from the statement
 * @returns {string}
 */
export function cleanMerchant(raw) {
  const original = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!original) return "";

  let text = original.replace(BANK_PREFIX, "");

  // "PREFIX*REST" and "NAME*CODE": keep the part that names the merchant
  if (text.includes("*")) {
    const [left, ...rest] = text.split("*");
    const right = rest.join("*").trim();
    text = PROCESSOR.test(left.trim()) && right ? right : left.trim() || right;
  }

  text = text
    .replace(DOMAIN_ENDING, "")
    .replace(/#\s*(?=\w)/g, "#") // "# 412" -> "#412", so it is dropped as one word below
    .split(" ")
    // Drop store numbers, reference codes and dates ("#412", "5744", "T-1123", "2K4LP", "09/12"),
    // but keep names that start with a digit: "7-ELEVEN"
    .filter((w) => !/\d/.test(w) || /^\d+-[a-z]{3,}$/i.test(w))
    .join(" ")
    .replace(/[^\p{L}\p{N}\s&'./-]/gu, " ") // leftover punctuation (keeps & ' . / -)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-./\s]+|[-./\s]+$/g, "");

  let words = text.split(" ").filter(Boolean);
  // A state code at the end ("... WA", "... MO"): only when it is written in capitals, as banks do,
  // and never when it would leave nothing. One that is also a word needs a city before it.
  const lastWord = words[words.length - 1];
  if (words.length > 1 && STATE_CODES.has(lastWord)) {
    const before = words[words.length - 2].toLowerCase();
    const looksLikeAWord = WORD_STATE_CODES.has(lastWord) && (words.length < 3 || SMALL_WORDS.has(before));
    if (!looksLikeAWord) words.pop();
  }
  // Drop noise words from the end, but never the whole name
  while (words.length > 1 && TRAILING_NOISE.has(words[words.length - 1].toLowerCase())) words.pop();
  // "SHELL OIL" -> "Shell": the word "oil" after a name adds nothing
  if (words.length > 1 && words[words.length - 1].toLowerCase() === "oil") words.pop();
  text = words.join(" ");

  if (!text) return titleCase(original.toLowerCase());
  const special = SPECIAL[text.toLowerCase()];
  return special ?? titleCase(text.toLowerCase());
}
