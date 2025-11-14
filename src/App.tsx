import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { StudyView } from "./components/StudyView";
import { DeckBrowser } from "./components/DeckBrowser";
import { StatsView } from "./components/StatsView";
import { ProfileView } from "./components/ProfileView";
import { SquareView } from "./components/SquareView";
import { Footer } from "./components/Footer";
import { HeroSection } from "./components/sections/HeroSection";
import { FeaturesSection } from "./components/sections/FeaturesSection";
import { ScanlineOverlay } from "./components/ui/ScanlineOverlay";
import { SkipToMain } from "./components/ui/SkipToMain";
import { db } from "./storage/database";
import { useTheme } from "./contexts/ThemeContext";
import { DeckId } from "./types/ids";

type View = "home" | "study" | "browse" | "stats" | "square" | "profile";

function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedDeckId, setSelectedDeckId] = useState<DeckId | undefined>(
    undefined,
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // All hooks must be called before any early returns
  const navigateToHome = useCallback(() => setCurrentView("home"), []);
  const navigateToStudy = useCallback(() => setCurrentView("study"), []);
  const navigateToBrowse = useCallback(() => setCurrentView("browse"), []);
  const navigateToSquare = useCallback(() => setCurrentView("square"), []);
  const navigateToProfile = useCallback(() => setCurrentView("profile"), []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await db.open();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };

    initializeApp();
  }, []);

  const handleStartStudy = useCallback((deckId?: DeckId) => {
    setSelectedDeckId(deckId);
    setCurrentView("study");
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-terminal-base">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-2 border-terminal-primary border-t-transparent rounded-full mx-auto mb-4"
          />
          <div className="font-mono terminal-primary text-lg">
            <span className="text-terminal-muted">$ ./init</span>
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="ml-1"
            >
              _
            </motion.span>
          </div>
          <p className="text-terminal-muted text-sm mt-2">
            Initializing database...
          </p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "study":
        return (
          <StudyView onBack={navigateToHome} initialDeckId={selectedDeckId} />
        );
      case "browse":
        return (
          <DeckBrowser
            onBack={navigateToHome}
            onStartStudy={handleStartStudy}
          />
        );
      case "stats":
        return <StatsView onBack={navigateToHome} />;
      case "square":
        return <SquareView onBack={navigateToHome} />;
      case "profile":
        return <ProfileView onBack={navigateToHome} />;
      default:
        return <HomeView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <SkipToMain />
      <ScanlineOverlay />

      {/* Navigation Bar */}
      {currentView !== "home" && (
        <nav className="border-b-2 border-terminal-primary bg-terminal-base sticky top-0 z-40 shadow-terminal-glow">
          <div className="px-8 py-4">
            {/* Logo and Brand */}
            <button
              onClick={navigateToHome}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-4 group"
            >
              <div className="text-4xl">🏛️</div>
              <div className="font-mono">
                <div className="text-terminal-muted text-xs">$ cd ~</div>
                <div className="terminal-primary text-2xl font-bold group-hover:text-shadow-terminal transition-all">
                  COMMONRY
                </div>
              </div>
            </button>

            {/* Navigation Links - Second Row */}
            <div className="flex items-center gap-6 font-mono text-sm">
              <button
                onClick={navigateToStudy}
                className={`transition-colors hover:[text-shadow:0_0_8px_currentColor] ${
                  currentView === "study"
                    ? "terminal-primary font-bold text-shadow-terminal"
                    : "text-terminal-muted hover:terminal-primary"
                }`}
              >
                [Study]
              </button>
              <span className="text-terminal-muted">|</span>
              <button
                onClick={navigateToBrowse}
                className={`transition-colors hover:[text-shadow:0_0_8px_currentColor] ${
                  currentView === "browse"
                    ? "terminal-primary font-bold text-shadow-terminal"
                    : "text-terminal-muted hover:terminal-primary"
                }`}
              >
                [Commons]
              </button>
              <span className="text-terminal-muted">|</span>
              <button
                onClick={navigateToSquare}
                className={`transition-colors hover:[text-shadow:0_0_8px_currentColor] ${
                  currentView === "square"
                    ? "terminal-primary font-bold text-shadow-terminal"
                    : "text-terminal-muted hover:terminal-primary"
                }`}
              >
                [The Square]
              </button>
              <span className="text-terminal-muted">|</span>
              <button
                onClick={navigateToProfile}
                className={`transition-colors hover:[text-shadow:0_0_8px_currentColor] ${
                  currentView === "profile"
                    ? "terminal-primary font-bold text-shadow-terminal"
                    : "text-terminal-muted hover:terminal-primary"
                }`}
              >
                [Profile]
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-1.5 right-4 z-50 px-4 py-2 rounded-full bg-gray-100 dark:bg-white/10 backdrop-blur-lg border border-gray-200 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors text-sm font-medium"
        title={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <main id="main-content" className="flex-1 flex flex-col">
        {renderView()}
      </main>

      <Footer onNavigate={setCurrentView} />
    </div>
  );
}

interface HomeViewProps {
  onNavigate: (view: View) => void;
}

function HomeView({ onNavigate }: HomeViewProps) {
  return (
    <>
      <HeroSection onNavigate={onNavigate} />
      <FeaturesSection />
    </>
  );
}

interface PlaceholderViewProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

function PlaceholderView({ title, subtitle, onBack }: PlaceholderViewProps) {
  return (
    <div className="flex items-center justify-center flex-1 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative border-2 border-terminal-accent dark:border-amber rounded-lg p-8 shadow-terminal-accent-glow dark:shadow-[0_0_30px_rgba(251,191,36,0.3)] max-w-md w-full text-center bg-terminal-surface dark:bg-dark-surface overflow-hidden"
      >
        {/* Terminal header */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-terminal-muted dark:bg-dark-border border-b border-terminal-accent/30 dark:border-amber/30 flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-orange/50 dark:bg-amber/50" />
          <div className="w-3 h-3 rounded-full bg-green/50 dark:bg-cyan/50" />
        </div>

        <div className="mt-8">
          <div className="font-mono text-terminal-muted dark:text-text-muted text-sm mb-2">
            $ cat status.txt
          </div>
          <h1 className="text-3xl font-bold terminal-accent dark:text-amber mb-2 font-mono text-shadow-terminal-accent dark:[text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
            {title}
          </h1>
          <p className="text-terminal-muted dark:text-text-muted mb-8 font-mono">
            {subtitle}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark py-3 px-6 rounded border border-terminal-primary dark:border-cyan font-mono font-bold transition-all shadow-terminal-glow dark:shadow-cyan-glow"
          >
            ./back-to-home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
