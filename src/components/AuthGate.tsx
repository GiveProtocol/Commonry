import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoginView from "./LoginView";
import SignupView from "./SignupView";
import EmailVerificationView from "./EmailVerificationView";
import { motion } from "framer-motion";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Check URL for verification token on mount
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/verify-email\/([a-f0-9]+)/);
    if (match) {
      setVerificationToken(match[1]);
    }
  }, []);

  const handleEmailVerificationSuccess = useCallback(() => {
    setVerificationToken(null);
    window.history.pushState({}, "", "/");
  }, [setVerificationToken]);

  const handleSwitchToLogin = useCallback(() => {
    setShowSignup(false);
  }, [setShowSignup]);

  const handleSwitchToSignup = useCallback(() => {
    setShowSignup(true);
  }, [setShowSignup]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Handle email verification flow
  if (verificationToken) {
    return (
      <EmailVerificationView
        token={verificationToken}
        onSuccess={handleEmailVerificationSuccess}
      />
    );
  }

  if (!isAuthenticated) {
    return showSignup ? (
      <SignupView onSwitchToLogin={handleSwitchToLogin} />
    ) : (
      <LoginView onSwitchToSignup={handleSwitchToSignup} />
    );
  }

  return <>{children}</>;
}
