import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

interface EmailVerificationViewProps {
  token: string;
  onSuccess: () => void;
}

export default function EmailVerificationView({
  token,
  onSuccess,
}: EmailVerificationViewProps) {
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "expired" | "already-verified"
  >("verifying");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/auth/verify-email/${token}`
        );
        const data = await response.json();

        if (response.ok) {
          if (data.alreadyVerified) {
            setStatus("already-verified");
            setMessage(data.message);
          } else {
            setStatus("success");
            setMessage(data.message);
            setUsername(data.username);
          }
        } else {
          if (data.expired) {
            setStatus("expired");
            setMessage(data.error);
            // Store email if provided for resend functionality
            if (data.email) {
              setUserEmail(data.email);
            }
          } else if (data.invalidToken) {
            // Token was already used or is invalid - might be already verified
            setStatus("already-verified");
            setMessage(data.error);
          } else {
            setStatus("error");
            setMessage(data.error || "Failed to verify email");
          }
        }
      } catch (error) {
        setStatus("error");
        setMessage("Network error. Please try again.");
        console.error("Verification error:", error);
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token]);

  const handleContinue = () => {
    if (status === "success" || status === "already-verified") {
      onSuccess();
    }
  };

  const handleResendVerification = async () => {
    if (!userEmail) {
      setMessage("Email address not available. Please try signing up again.");
      return;
    }

    setResending(true);
    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userEmail }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(
          "Verification email sent! Please check your inbox and spam folder."
        );
        setStatus("success");
      } else {
        setMessage(data.error || "Failed to resend verification email");
      }
    } catch (error) {
      setMessage("Network error. Please try again later.");
      console.error("Resend verification error:", error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle-gradient px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-card dark:card-border rounded-2xl card-shadow-deep p-8 w-full max-w-md text-center"
      >
        {status === "verifying" && (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 text-cyan-600 animate-spin mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Verifying Email...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we verify your email address.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-4">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Verified! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
              {username && (
                <p className="text-gray-500 dark:text-gray-500 mt-2">
                  Welcome, <span className="font-semibold">{username}</span>!
                </p>
              )}
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Continue to Login
            </button>
          </div>
        )}

        {status === "already-verified" && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-cyan-100 dark:bg-cyan-900/20 rounded-full p-4">
                <CheckCircle className="w-16 h-16 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Already Verified
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Go to Login
            </button>
          </div>
        )}

        {status === "expired" && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-full p-4">
                <Mail className="w-16 h-16 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Link Expired
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                {resending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {resending ? "Resending..." : "Resend Verification Email"}
              </button>
              <button
                onClick={onSuccess}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4">
                <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </div>
            <button
              onClick={onSuccess}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Back to Login
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
