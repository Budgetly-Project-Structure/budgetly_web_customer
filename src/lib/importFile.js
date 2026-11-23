/**
 * importFile.js (Sprint 5 #2)
 *
 * An import record no longer stores its file name and type: both come from its
 * storagePath, users/{uid}/imports/{timestamp}_{name}.{ext} (src/lib/uploads.js).
 * Same rules as budgetly_backend_nodejs functions/lib/importFile.js.
 */

/**
 * The name to show: the last part of the path without the upload's
 * "{13-digit timestamp}_" prefix, e.g. "checking_sept.csv".
 * @param {string|null|undefined} storagePath
 * @returns {string} "Statement" when there's no path
 */
export function displayFileName(storagePath) {
  const name = typeof storagePath === "string" ? storagePath.split("/").pop() : "";
  return name ? name.replace(/^\d{13}_/, "") : "Statement";
}

/**
 * The file's extension in lower case, e.g. "csv" or "pdf".
 * @param {string|null|undefined} storagePath
 * @returns {string} "csv" when it can't be told (the default the app used before)
 */
export function fileTypeFromPath(storagePath) {
  const name = typeof storagePath === "string" ? storagePath.split("/").pop() : "";
  return name && name.includes(".") ? name.split(".").pop().toLowerCase() : "csv";
}
