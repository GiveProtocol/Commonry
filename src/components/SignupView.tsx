import { useState, useCallback, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { TerminalBorder } from "./ui/TerminalBorder";

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
    },
    [username, email, password, displayName],
  );

  const handleResendVerification = useCallback(async () => {
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
  }, [registeredEmail]);

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
      <div className="min-h-screen flex items-center justify-center bg-terminal-base px-4 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg opacity-30" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <TerminalBorder className="bg-terminal-surface dark:bg-dark-surface p-8 text-center">
            {/* Success indicator */}
            <div className="mb-6">
              <div className="inline-block bg-green-500/10 border-2 border-green-500/30 p-6">
                <div className="text-6xl font-mono terminal-accent dark:text-cyan text-shadow-terminal dark:[text-shadow:0_0_20px_rgba(0,217,255,0.5)]">
                  ✓
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-mono font-bold terminal-accent dark:text-amber mb-4 text-shadow-terminal-accent dark:[text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
              ACCOUNT CREATED
            </h2>

            <div className="bg-terminal-primary/10 dark:bg-cyan/10 border border-terminal-primary/30 dark:border-cyan/30 p-4 mb-6 text-left">
              <div className="font-mono text-sm space-y-2">
                <p className="terminal-primary dark:text-cyan">
                  <span className="text-terminal-muted dark:text-text-muted">
                    &gt;
                  </span>{" "}
                  VERIFICATION REQUIRED
                </p>
                <p className="text-terminal-muted dark:text-text-muted text-xs">
                  Email sent to:{" "}
                  <span className="terminal-primary dark:text-cyan">
                    {registeredEmail}
                  </span>
                </p>
                <p className="text-terminal-muted dark:text-text-muted text-xs">
                  Check your inbox and click the verification link to activate
                  your account.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onSwitchToLogin}
                className="w-full font-mono bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark font-bold py-3 px-4 border border-terminal-primary dark:border-cyan transition shadow-terminal-glow dark:shadow-cyan-glow"
              >
                ./login
              </button>

              {resendMessage && (
                <div
                  className={`text-sm p-3 font-mono border ${
                    resendMessage.includes("sent") ||
                    resendMessage.includes("Verification email")
                      ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  }`}
                >
                  {resendMessage}
                </div>
              )}

              <p className="text-xs font-mono text-terminal-muted dark:text-text-muted">
                No email?{" "}
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="terminal-accent dark:text-amber hover:text-terminal-accent/80 dark:hover:text-amber-light font-bold underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "[SENDING...]" : "./resend"}
                </button>
              </p>
            </div>
          </TerminalBorder>
        </motion.div>
      </div>
    );
  }

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
              :~$ ./register
            </div>
            <h1 className="text-3xl font-mono font-bold terminal-primary dark:text-cyan mb-2 text-shadow-terminal dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
              CREATE ACCOUNT
            </h1>
            <p className="font-mono text-terminal-muted dark:text-text-muted text-sm">
              &gt; Join the learning commons
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 font-mono text-sm">
                <span className="text-red-500">ERROR:</span> {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block font-mono text-sm font-medium text-terminal-muted dark:text-text-muted mb-2"
              >
                --username=
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className="w-full px-4 py-3 font-mono bg-terminal-surface dark:bg-dark border-2 border-terminal-primary/30 dark:border-cyan/30 terminal-primary dark:text-cyan focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all placeholder:text-terminal-muted/50 dark:placeholder:text-text-muted/50"
                placeholder="choose a username"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block font-mono text-sm font-medium text-terminal-muted dark:text-text-muted mb-2"
              >
                --email=
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                className="w-full px-4 py-3 font-mono bg-terminal-surface dark:bg-dark border-2 border-terminal-primary/30 dark:border-cyan/30 terminal-primary dark:text-cyan focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all placeholder:text-terminal-muted/50 dark:placeholder:text-text-muted/50"
                placeholder="your.email@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="block font-mono text-sm font-medium text-terminal-muted dark:text-text-muted mb-2"
              >
                --name= <span className="text-xs">(optional)</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={handleDisplayNameChange}
                className="w-full px-4 py-3 font-mono bg-terminal-surface dark:bg-dark border-2 border-terminal-primary/30 dark:border-cyan/30 terminal-primary dark:text-cyan focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all placeholder:text-terminal-muted/50 dark:placeholder:text-text-muted/50"
                placeholder="display name"
                autoComplete="name"
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
                placeholder="min. 6 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-mono bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark font-bold py-3 px-4 border border-terminal-primary dark:border-cyan transition disabled:opacity-50 disabled:cursor-not-allowed shadow-terminal-glow dark:shadow-cyan-glow"
            >
              {isLoading ? "[CREATING...]" : "./create-account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-mono text-terminal-muted dark:text-text-muted text-sm">
              &gt; Already registered?{" "}
              <button
                onClick={onSwitchToLogin}
                className="terminal-accent dark:text-amber hover:text-terminal-accent/80 dark:hover:text-amber-light font-bold underline"
              >
                ./login
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
