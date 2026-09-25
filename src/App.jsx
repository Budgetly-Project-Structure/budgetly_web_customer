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

function LoginPage() {
  const navigate = useNavigate();
  return (
    <Login
      onSubmit={async ({ email, password }) => {
        // TODO: await signInWithEmailAndPassword(auth, email, password)
        console.log("login", email, password);
        navigate("/");
      }}
      onSwitchToSignup={() => navigate("/signup")}
    />
  );
}

function SignupPage() {
  const navigate = useNavigate();
  return (
    <Signup
      onSubmit={async ({ name, email, password }) => {
        // TODO: await createUserWithEmailAndPassword(auth, email, password)
        console.log("signup", name, email, password);
        navigate("/consent");
      }}
      onSwitchToLogin={() => navigate("/login")}
    />
  );
}

function ConsentPage() {
  const navigate = useNavigate();
  return (
    <ConsentScreen
      onContinue={() => {
        // TODO: write consentedAt timestamp to the user's Firestore profile
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
              TODO: wrap in a <RequireAuth> route once Firebase Auth is wired up. */}
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
