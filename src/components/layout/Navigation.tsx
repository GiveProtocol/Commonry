import { useCallback } from "react";
import { TerminalButton } from "../ui/TerminalButton";
import { TypingCursor } from "../ui/TypingCursor";
import { Github } from "lucide-react";

type View = "home" | "study" | "browse" | "stats" | "square" | "profile";

interface NavigationProps {
  currentView?: View;
  onNavigate?: (view: View) => void;
  onSignIn?: () => void;
}

export function Navigation({
  currentView: _currentView,
  onNavigate,
  onSignIn,
}: NavigationProps) {
  const handleNavigateHome = useCallback(() => {
    onNavigate?.("home");
  }, [onNavigate]);

  return (
    <nav className="border-b-2 border-cyan bg-dark sticky top-0 z-50 shadow-[0_0_20px_rgba(0,217,255,0.3)]">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <button
            onClick={handleNavigateHome}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <div className="text-4xl">🏛️</div>
            <div className="font-mono">
              <div className="text-text-muted text-xs">$ whoami</div>
              <div className="text-cyan text-2xl font-bold flex items-center group-hover:[text-shadow:0_0_10px_#00d9ff] transition-all">
                COMMONRY
                <TypingCursor />
              </div>
            </div>
          </button>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://library.commonry.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-cyan font-mono text-sm transition-colors"
            >
              [Library]
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-cyan font-mono text-sm transition-colors flex items-center gap-2"
            >
              <Github size={16} />
              [GitHub]
            </a>
            <a
              href="https://bsky.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-cyan font-mono text-sm transition-colors"
            >
              [Bluesky]
            </a>
            {onSignIn && (
              <TerminalButton
                variant="cyan"
                onClick={onSignIn}
                className="px-4 py-2 text-xs"
              >
                ./sign-in
              </TerminalButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
