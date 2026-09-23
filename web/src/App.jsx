import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardHome from "./components/DashboardHome";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ConsentScreen from "./components/ConsentScreen";

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

function DashboardPage() {
  return (
    <Layout activeNav="dashboard">
      <DashboardHome />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}