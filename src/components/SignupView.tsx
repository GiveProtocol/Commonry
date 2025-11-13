import { useState, useCallback, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle } from "lucide-react";

// Signup view with email verification flow
interface SignupViewProps {
  onSwitchToLogin: () => void;
}

export default function SignupView({ onSwitchToLogin }: SignupViewProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password, displayName }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success! Show email verification message
        setRegisteredEmail(data.email);
        setShowSuccess(true);
      } else {
        setError(data.error || "Failed to create account");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Signup error:", err);
    }

    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage("");

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: registeredEmail }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setResendMessage(data.message || "Verification email sent!");
      } else {
        setResendMessage(
          data.error || "Failed to resend email. Please try again.",
        );
      }
    } catch (err) {
      setResendMessage("Network error. Please try again.");
      console.error("Resend verification error:", err);
    }

    setResendLoading(false);
  };

  const handleUsernameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setUsername(e.target.value);
    },
    [],
  );
  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);
  const handleDisplayNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setDisplayName(e.target.value);
    },
    [],
  );
  const handlePasswordChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
    },
    [],
  );

  // Show success message after registration
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle-gradient px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-card dark:card-border rounded-2xl card-shadow-deep p-8 w-full max-w-md text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-4">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Account Created! 🎉
          </h2>

          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-cyan-900 dark:text-cyan-100 mb-1">
                  Verify Your Email
                </p>
                <p className="text-sm text-cyan-700 dark:text-cyan-300">
                  We&apos;ve sent a verification link to{" "}
                  <span className="font-semibold">{registeredEmail}</span>
                </p>
                <p className="text-sm text-cyan-600 dark:text-cyan-400 mt-2">
                  Please check your inbox and click the link to activate your
                  account.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onSwitchToLogin}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Go to Login
            </button>

            {resendMessage && (
              <div
                className={`text-sm p-3 rounded-lg ${
                  resendMessage.includes("sent") ||
                  resendMessage.includes("Verification email")
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                }`}
              >
                {resendMessage}
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Didn&apos;t receive the email? Check your spam folder or{" "}
              <button
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? "Sending..." : "resend verification"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle-gradient px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-card dark:card-border rounded-2xl card-shadow-deep p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Account
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Start your learning journey today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="Choose a username"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="your.email@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Display Name (Optional)
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={handleDisplayNameChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="How should we call you?"
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
