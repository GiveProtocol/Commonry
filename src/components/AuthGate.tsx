import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoginView from "./LoginView";
import SignupView from "./SignupView";
import { motion } from "framer-motion";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return showSignup ? (
      <SignupView onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <LoginView onSwitchToSignup={() => setShowSignup(true)} />
    );
  }

  return <>{children}</>;
}
