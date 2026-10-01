// Client-side checks before a statement is uploaded (the Cloud Function re-validates server-side).

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ["csv", "pdf"];

/** Returns an error string, or null if the file is OK. */
export function validateStatementFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED.includes(ext)) return `“${file.name}” isn't a CSV or PDF.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > MAX_BYTES) return `“${file.name}” is over 10 MB.`;
  return null;
}

