// Client-side checks before a statement is uploaded (the Cloud Function re-validates server-side).

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ["csv", "pdf"];

/**
 * Checks a file the user picked before uploading it. Order of checks:
 *   1. Extension must be .csv or .pdf
 *   2. File can't be empty
 *   3. File must be 10 MB or less (the Storage rules enforce the same limit)
 *
 * @param {File} file
 * @returns {string|null} An error message to show, or null if the file is OK.
 */
export function validateStatementFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED.includes(ext)) return `“${file.name}” isn't a CSV or PDF.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > MAX_BYTES) return `“${file.name}” is over 10 MB.`;
  return null;
}

