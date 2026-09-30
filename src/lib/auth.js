/**
 * auth.js
 *
 * All Firebase account actions in one place: signup, login, logout, consent.
 * UI components (Signup.jsx, Login.jsx, ConsentScreen.jsx) stay UI-only and
 * receive these functions as their onSubmit / onContinue props from App.jsx.
 *
 * Part of: Account & Onboarding epic (SCRUM-14, SCRUM-18)
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Turns Firebase error codes into messages a user understands.
 * The real error is logged to the browser console for debugging.
 */
function friendlyError(err) {
  console.error("Firebase error:", err.code, err.message); // real error, for debugging

  const messages = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "That email address isn't valid.",
    "auth/weak-password": "Password is too weak. Try a longer one.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/network-request-failed": "Can't reach the server. Check your connection.",
    "auth/operation-not-allowed": "Sign-up is currently disabled.",
    "permission-denied": "You don't have permission to do that.",
  };
  return new Error(messages[err.code] || "Something went wrong. Try again.");
}

/**
 * Creates a new account and the user's profile document.
 *
 * Steps:
 *   1. Create the login in Firebase Auth (email + password)
 *   2. Save their name on the Auth profile (shows up as user.displayName)
 *   3. Create users/{uid} in Firestore. This is where their app data lives.
 *
 * @param {{ name: string, email: string, password: string }} form
 */
export async function signUp({ name, email, password }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });

    // Field names must match the Firestore rules (SCRUM-15):
    // only email, displayName, createdAt, consentAcceptedAt are allowed.
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email,
      displayName: name.trim(),
      createdAt: serverTimestamp(),
    });

    return cred.user;
  } catch (err) {
    throw friendlyError(err);
  }
}

/** Signs in an existing user. */
export async function logIn({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    throw friendlyError(err);
  }
}

/** Signs the current user out. */
export function logOut() {
  return signOut(auth);
}

/**
 * Records that the user accepted the consent screen.
 * If consentAcceptedAt exists on the user doc, they've consented;
 * if it's missing, they haven't.
 */
export async function saveConsent() {
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      consentAcceptedAt: serverTimestamp(),
    });
  } catch (err) {
    throw friendlyError(err);
  }
}