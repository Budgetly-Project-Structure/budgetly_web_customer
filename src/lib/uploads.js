/**
 * uploads.js
 *
 * Sends a bank statement file to Firebase Storage at
 *   users/{uid}/imports/{timestamp}_{fileName}
 * Once it lands there, the onStatementUploaded Cloud Function (SCRUM-23)
 * automatically creates an Import record in Firestore.
 *
 * Part of: Statement Import epic (SCRUM-22)
 */
import { ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "./firebase";

/** Turns Storage error codes into messages a user understands. */
function friendlyUploadError(err) {
  console.error("Upload error:", err.code, err.message); // real error, for debugging
  const messages = {
    "storage/unauthorized": "Upload was blocked. Make sure you're logged in and the file is a CSV or PDF under 10 MB.",
    "storage/canceled": "Upload was canceled.",
    "storage/retry-limit-exceeded": "Upload timed out. Check your connection and try again.",
  };
  return new Error(messages[err.code] || "Upload failed. Try again.");
}

/**
 * Uploads one statement file for the logged-in user.
 *
 * @param {File} file                 The CSV or PDF the user picked
 * @param {Object} [options]
 * @param {string} [options.accountId]  Which bank account this statement is for
 * @param {string} [options.accountType]  "checking" or "credit"; the import uses it to read
 *                                        card statements correctly
 * @param {(pct: number) => void} [options.onProgress]  Called with 0–100 as it uploads
 * @returns {Promise<string>} The Storage path of the uploaded file
 */
export function uploadStatement(file, { accountId, accountType, onProgress } = {}) {
  const user = auth.currentUser;
  if (!user) {
    return Promise.reject(new Error("You need to be logged in to upload."));
  }

  // Timestamp prefix so two uploads with the same name don't overwrite each other
  const path = `users/${user.uid}/imports/${Date.now()}_${file.name}`;

  // Set the type ourselves: on Windows, browsers often label .csv files as
  // "application/vnd.ms-excel", which our Storage rules would reject.
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  const metadata = {
    contentType: isPdf ? "application/pdf" : "text/csv",
    // The Cloud Function reads these (onStatementUploaded in budgetly_backend_nodejs)
    customMetadata: { accountId: accountId || "", accountType: accountType || "" },
  };

  const task = uploadBytesResumable(ref(storage, path), file, metadata);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(friendlyUploadError(err)),
      () => resolve(path)
    );
  });
}