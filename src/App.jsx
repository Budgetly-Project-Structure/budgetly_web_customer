import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ConsentScreen from "./components/ConsentScreen";
import FinanceProvider from "./data/FinanceProvider";
import HomePage from "./pages/HomePage";
import TransactionsPage from "./pages/TransactionsPage";
import BudgetPage from "./pages/BudgetPage";
import InsightsPage from "./pages/InsightsPage";
import ImportPage from "./pages/ImportPage";
import SettingsPage from "./pages/SettingsPage";
import { signUp, logIn, saveConsent } from "./lib/auth";

/**
 * Login route. Signs the user in with Firebase Auth, then goes to the dashboard.
 * If logIn throws, Login.jsx catches it and shows the error message.
 */
function LoginPage() {
  const navigate = useNavigate();
  return (
    <Login
      onSubmit={async ({ email, password }) => {
        await logIn({ email, password });
        navigate("/");
      }}
      onSwitchToSignup={() => navigate("/signup")}
    />
  );
}

/**
 * Signup route. Creates the Firebase Auth account and the users/{uid}
 * Firestore document, then sends the new user to the consent screen.
 */
function SignupPage() {
  const navigate = useNavigate();
  return (
    <Signup
      onSubmit={async (form) => {
        await signUp(form);
        navigate("/consent");
      }}
      onSwitchToLogin={() => navigate("/login")}
    />
  );
}

/**
 * Consent route. Saves consentGiven: true and a timestamp to the
 * user's Firestore profile, then goes to the dashboard.
 */
function ConsentPage() {
  const navigate = useNavigate();
  return (
    <ConsentScreen
      onContinue={async () => {
        await saveConsent();
        navigate("/");
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FinanceProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/consent" element={<ConsentPage />} />

          {/* Everything inside the dashboard shell (sidebar + top bar).
              TODO: wrap in a <RequireAuth> route so logged-out users are sent to /login. */}
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="budget" element={<BudgetPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FinanceProvider>
    </BrowserRouter>
  );
}