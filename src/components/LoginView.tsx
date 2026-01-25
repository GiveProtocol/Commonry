import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { TerminalBorder } from "./ui/TerminalBorder";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Check if we're returning from Discourse SSO
function getSsoReturnParam(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("sso_return") === "true";
}

interface LoginViewProps {
  onSwitchToSignup: () => void;
}

export default function LoginView({ onSwitchToSignup }: LoginViewProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [ssoReturn, setSsoReturn] = useState(false);

  // Check for SSO return on mount
  useEffect(() => {
    setSsoReturn(getSsoReturnParam());
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setEmailNotVerified(false);
      setResendMessage("");
      setIsLoading(true);

      const result = await login(username, password);

      if (result.error) {
        setError(result.error);
        if (result.emailNotVerified && result.email) {
          setEmailNotVerified(true);
          setUnverifiedEmail(result.email);
        }
        setIsLoading(false);
        return;
      }

      // If we're returning from Discourse SSO, complete the flow
      if (ssoReturn && result.token) {
        try {
          const ssoResponse = await fetch(
            `${API_BASE_URL}/api/discourse/complete-sso`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${result.token}`,
              },
              credentials: "include",
            },
          );

          const ssoData = await ssoResponse.json();

          if (ssoResponse.ok && ssoData.redirectUrl) {
            // Redirect to Discourse with SSO payload
            window.location.href = ssoData.redirectUrl;
            return;
          } else {
            console.error("SSO completion failed:", ssoData.error);
            // Login succeeded, but SSO failed - still logged in to Commonry
          }
        } catch (ssoError) {
          console.error("SSO completion error:", ssoError);
        }
      }

      setIsLoading(false);
    },
    [login, username, password, ssoReturn],
  );

  const handleResendVerification = useCallback(async () => {
    setResendLoading(true);
    setResendMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: unverifiedEmail }),
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
  }, [unverifiedEmail]);

  const handleUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUsername(e.target.value);
    },
    [],
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
    },
    [],
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-terminal-base px-4 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <TerminalBorder className="bg-terminal-surface dark:bg-dark-surface p-8">
          {/* Terminal Header */}
          <div className="mb-8">
            <div className="font-mono text-terminal-muted dark:text-text-muted text-sm mb-4">
              <span className="terminal-primary dark:text-cyan">
                commonry@localhost
              </span>
              :~$ ./login
            </div>
            <h1 className="text-3xl font-mono font-bold terminal-primary dark:text-cyan mb-2 text-shadow-terminal dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
              AUTHENTICATE
            </h1>
            <p className="font-mono text-terminal-muted dark:text-text-muted text-sm">
              &gt; Enter credentials to access your learning commons
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="space-y-3">
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 font-mono text-sm">
                  <span className="text-red-500">ERROR:</span> {error}
                </div>

                {emailNotVerified && (
                  <div className="bg-terminal-accent/10 dark:bg-amber/10 border border-terminal-accent/30 dark:border-amber/30 p-3 text-center">
                    <p className="text-sm font-mono text-terminal-muted dark:text-text-muted mb-3">
                      &gt; Email verification required
                    </p>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="font-mono text-sm bg-terminal-accent dark:bg-amber hover:bg-terminal-accent/90 dark:hover:bg-amber-dark text-paper dark:text-dark font-bold py-2 px-4 border border-terminal-accent dark:border-amber transition disabled:opacity-50 disabled:cursor-not-allowed shadow-terminal-accent-glow dark:shadow-amber-glow"
                    >
                      {resendLoading ? "[SENDING...]" : "./resend-verification"}
                    </button>

                    {resendMessage && (
                      <div
                        className={`mt-3 text-sm p-2 font-mono border ${
                          resendMessage.includes("sent") ||
                          resendMessage.includes("new verification")
                            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {resendMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block font-mono text-sm font-medium text-terminal-muted dark:text-text-muted mb-2"
              >
                --user=
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className="w-full px-4 py-3 font-mono bg-terminal-surface dark:bg-dark border-2 border-terminal-primary/30 dark:border-cyan/30 terminal-primary dark:text-cyan focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all placeholder:text-terminal-muted/50 dark:placeholder:text-text-muted/50"
                placeholder="username or email"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-sm font-medium text-terminal-muted dark:text-text-muted mb-2"
              >
                --password=
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full px-4 py-3 font-mono bg-terminal-surface dark:bg-dark border-2 border-terminal-primary/30 dark:border-cyan/30 terminal-primary dark:text-cyan focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all placeholder:text-terminal-muted/50 dark:placeholder:text-text-muted/50"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-mono bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark font-bold py-3 px-4 border border-terminal-primary dark:border-cyan transition disabled:opacity-50 disabled:cursor-not-allowed shadow-terminal-glow dark:shadow-cyan-glow"
            >
              {isLoading ? "[AUTHENTICATING...]" : "./sign-in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-mono text-terminal-muted dark:text-text-muted text-sm">
              &gt; No account?{" "}
              <button
                onClick={onSwitchToSignup}
                className="terminal-accent dark:text-amber hover:text-terminal-accent/80 dark:hover:text-amber-light font-bold underline"
              >
                ./register
              </button>
            </p>
          </div>
        </TerminalBorder>

        {/* Command hint */}
        <div className="mt-4 text-center font-mono text-terminal-muted dark:text-text-muted text-xs opacity-60">
          Press ENTER to execute
        </div>
      </motion.div>
    </div>
  );
}
