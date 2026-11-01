/**
 * RequireAuth.jsx
 *
 * Route guard for every signed-in page. Wrap it around the dashboard routes
 * in App.jsx:
 *   - Still checking whether someone is logged in → shows a loading message
 *   - Not logged in → redirects to /login
 *   - Logged in → renders the page (<Outlet />)
 *
 * Firebase restores the session on page refresh, but that takes a moment,
 * so `undefined` ("still checking") is kept separate from `null` ("logged out").
 * Otherwise a refresh would briefly kick a logged-in user to /login.
 *
 * Part of: Account & Onboarding epic
 */
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { LoadingState } from "./ui";

export default function RequireAuth() {
  // undefined = still checking, null = logged out, object = logged-in user
  const [user, setUser] = useState(undefined);
  const location = useLocation();

  // Listen for login/logout. The returned function stops listening when
  // this component goes away.
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <LoadingState label="Loading…" className="" />
      </div>
    );
  }

  if (user === null) {
    // Remember where they were going, so login can send them back later
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}