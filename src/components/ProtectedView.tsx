import { useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoginView from "./LoginView";
import SignupView from "./SignupView";

interface ProtectedViewProps {
  children: React.ReactNode;
}

export default function ProtectedView({ children }: ProtectedViewProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  const handleSwitchToLogin = useCallback(() => setShowSignup(false), []);
  const handleSwitchToSignup = useCallback(() => setShowSignup(true), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return showSignup ? (
      <SignupView onSwitchToLogin={handleSwitchToLogin} />
    ) : (
      <LoginView onSwitchToSignup={handleSwitchToSignup} />
    );
  }

  return children;
}
