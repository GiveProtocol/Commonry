import { motion } from "framer-motion";
import { useCallback, useMemo } from "react";
import { SyncStatusIndicator } from "../SyncStatusIndicator";

type View = "home" | "study" | "browse" | "commons" | "commons-category" | "plot" | "stats" | "square" | "profile";

interface NavigationProps {
  currentView?: View;
  onNavigate?: (view: View) => void;
  /** When true, external links open in same tab (for Discourse) */
  isExternal?: boolean;
}

/**
 * SharedNavigation component
 *
 * This navigation appears identically on both Commonry app and Discourse forum.
 * It uses the commons metaphor:
 * - Your Plot (personal study)
 * - The Commons (public decks)
 * - The Square (community forum)
 * - Profile
 *
 * Design principles:
 * - Clean, minimalist aesthetic with generous whitespace
 * - ADHD-friendly design
 * - Terminal-style aesthetic
 * - Works in both light and dark modes
 * - Accessible with keyboard navigation and ARIA labels
 */
export function SharedNavigation({
  currentView = "home",
  onNavigate,
  isExternal = false,
}: NavigationProps) {
  const handleNavigate = useCallback(
    (view: View, externalUrl?: string) => {
      if (isExternal && externalUrl) {
        // For Discourse, navigate to Commonry app
        window.location.href = externalUrl;
      } else if (onNavigate) {
        // For Commonry app, use state-based routing
        onNavigate(view);
      }
    },
    [isExternal, onNavigate],
  );

  const handleHomeClick = useCallback(
    () =>
      handleNavigate("home", isExternal ? "https://commonry.app" : undefined),
    [handleNavigate, isExternal],
  );

  const navItems = useMemo(
    () => [
      {
        view: "plot",
        label: "Your Plot",
        url: "https://commonry.app/plot",
        ariaLabel: "Navigate to Your Plot - Personal dashboard",
        onClick: () =>
          handleNavigate(
            "plot",
            isExternal ? "https://commonry.app/plot" : undefined,
          ),
      },
      {
        view: "browse",
        label: "My Decks",
        url: "https://commonry.app/browse",
        ariaLabel: "Navigate to My Decks - Manage your personal decks",
        onClick: () =>
          handleNavigate(
            "browse",
            isExternal ? "https://commonry.app/browse" : undefined,
          ),
      },
      {
        view: "commons",
        label: "The Commons",
        url: "https://commonry.app/commons",
        ariaLabel: "Navigate to The Commons - Browse public decks",
        onClick: () =>
          handleNavigate(
            "commons",
            isExternal ? "https://commonry.app/commons" : undefined,
          ),
      },
      {
        view: "square",
        label: "The Square",
        url: "https://forum.commonry.app/session/sso",
        ariaLabel: "Navigate to The Square - Community forum",
        onClick: () =>
          handleNavigate(
            "square",
            isExternal ? "https://forum.commonry.app/session/sso" : undefined,
          ),
      },
      {
        view: "profile",
        label: "Profile",
        url: "https://commonry.app/profile",
        ariaLabel: "Navigate to your profile",
        onClick: () =>
          handleNavigate(
            "profile",
            isExternal ? "https://commonry.app/profile" : undefined,
          ),
      },
    ],
    [handleNavigate, isExternal],
  );

  return (
    <nav
      className="border-b-2 border-terminal-primary dark:border-cyan bg-terminal-base dark:bg-dark sticky top-0 z-40 shadow-terminal-glow dark:shadow-cyan-glow"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="px-8 py-4">
        {/* Logo and Brand */}
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-4 group"
          aria-label="Go to Commonry home"
        >
          <div className="text-4xl" role="img" aria-label="Commonry logo">
            🏛️
          </div>
          <div className="font-mono">
            <div
              className="text-terminal-muted dark:text-text-muted text-xs"
              aria-hidden="true"
            >
              $ cd ~
            </div>
            <div className="terminal-primary dark:text-cyan text-2xl font-bold group-hover:text-shadow-terminal dark:group-hover:[text-shadow:0_0_20px_rgba(0,217,255,0.5)] transition-all">
              COMMONRY
            </div>
          </div>
        </button>

        {/* Navigation Links and Sync Status */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-6 font-mono text-sm"
            role="menubar"
          >
            {navItems.map((item, index) => (
              <>
                {index > 0 && (
                  <span
                    className="text-terminal-muted dark:text-text-muted"
                    aria-hidden="true"
                    key={`sep-${item.view}`}
                  >
                    |
                  </span>
                )}
                <button
                  key={item.view}
                  onClick={item.onClick}
                  className={`transition-colors hover:[text-shadow:0_0_8px_currentColor] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-primary dark:focus-visible:ring-cyan focus-visible:ring-offset-2 rounded px-2 py-1 ${
                    currentView === item.view
                      ? "terminal-primary dark:text-cyan font-bold text-shadow-terminal dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]"
                      : "text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan"
                  }`}
                  aria-label={item.ariaLabel}
                  aria-current={currentView === item.view ? "page" : undefined}
                  role="menuitem"
                >
                  [{item.label}]
                </button>
              </>
            ))}
          </div>

          {/* Sync Status Indicator (only show when not external) */}
          {!isExternal && <SyncStatusIndicator />}
        </div>
      </div>
    </nav>
  );
}

/**
 * Mobile Navigation Component
 *
 * Responsive hamburger menu for mobile devices
 */
interface MobileNavigationProps extends NavigationProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileNavigation({
  currentView = "home",
  onNavigate,
  isExternal = false,
  isOpen,
  onToggle,
}: MobileNavigationProps) {
  const handleNavigate = useCallback(
    (view: View, externalUrl?: string) => {
      onToggle(); // Close menu
      if (isExternal && externalUrl) {
        window.location.href = externalUrl;
      } else if (onNavigate) {
        onNavigate(view);
      }
    },
    [isExternal, onNavigate, onToggle],
  );

  const handleHomeClick = useCallback(
    () =>
      handleNavigate("home", isExternal ? "https://commonry.app" : undefined),
    [handleNavigate, isExternal],
  );

  const navItems = useMemo(
    () => [
      {
        view: "plot",
        label: "Your Plot",
        url: "https://commonry.app/plot",
        onClick: () =>
          handleNavigate(
            "plot",
            isExternal ? "https://commonry.app/plot" : undefined,
          ),
      },
      {
        view: "browse",
        label: "My Decks",
        url: "https://commonry.app/browse",
        onClick: () =>
          handleNavigate(
            "browse",
            isExternal ? "https://commonry.app/browse" : undefined,
          ),
      },
      {
        view: "commons",
        label: "The Commons",
        url: "https://commonry.app/commons",
        onClick: () =>
          handleNavigate(
            "commons",
            isExternal ? "https://commonry.app/commons" : undefined,
          ),
      },
      {
        view: "square",
        label: "The Square",
        url: "https://forum.commonry.app/session/sso",
        onClick: () =>
          handleNavigate(
            "square",
            isExternal ? "https://forum.commonry.app/session/sso" : undefined,
          ),
      },
      {
        view: "profile",
        label: "Profile",
        url: "https://commonry.app/profile",
        onClick: () =>
          handleNavigate(
            "profile",
            isExternal ? "https://commonry.app/profile" : undefined,
          ),
      },
    ],
    [handleNavigate, isExternal],
  );

  return (
    <nav
      className="md:hidden border-b-2 border-terminal-primary dark:border-cyan bg-terminal-base dark:bg-dark sticky top-0 z-40"
      aria-label="Mobile navigation"
    >
      <div className="px-4 py-3">
        {/* Header with logo and hamburger */}
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Go to Commonry home"
          >
            <div className="text-2xl">🏛️</div>
            <div className="font-mono terminal-primary dark:text-cyan text-xl font-bold">
              COMMONRY
            </div>
          </button>

          {/* Hamburger button */}
          <button
            onClick={onToggle}
            className="p-2 terminal-primary dark:text-cyan hover:bg-terminal-surface dark:hover:bg-dark-surface rounded transition-colors"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2 font-mono"
          >
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={item.onClick}
                className={`block w-full text-left px-4 py-2 rounded transition-colors ${
                  currentView === item.view
                    ? "terminal-primary dark:text-cyan font-bold bg-terminal-surface dark:bg-dark-surface"
                    : "text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan hover:bg-terminal-surface dark:hover:bg-dark-surface"
                }`}
                aria-current={currentView === item.view ? "page" : undefined}
              >
                [{item.label}]
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </nav>
  );
}
