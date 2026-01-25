import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { StudyView } from "./components/StudyView";
import { DeckBrowser } from "./components/DeckBrowser";
import { StatsView } from "./components/StatsView";
import { PlotView } from "./components/plot";
import { ProfileView } from "./components/ProfileView";
import { SquareView } from "./components/SquareView";
import { Footer } from "./components/Footer";
import { HeroSection } from "./components/sections/HeroSection";
import { FeaturesSection } from "./components/sections/FeaturesSection";
import { SharedNavigation } from "./components/layout/SharedNavigation";
import { ScanlineOverlay } from "./components/ui/ScanlineOverlay";
import { SkipToMain } from "./components/ui/SkipToMain";
import { CommonsView, CategoryDecksView } from "./components/commons";
import { db } from "./storage/database";
import { useTheme } from "./contexts/ThemeContext";
import { DeckId } from "./types/ids";
import ProtectedView from "./components/ProtectedView";
import { syncService } from "./services/sync-service";

type View =
  | "home"
  | "study"
  | "browse"
  | "commons"
  | "commons-category"
  | "plot"
  | "stats"
  | "square"
  | "profile";

/**
 * Get the initial view from the URL path
 */
const getInitialView = (): { view: View; categorySlug?: string } => {
  const path = window.location.pathname.slice(1); // Remove leading slash
  const validViews: View[] = [
    "home",
    "study",
    "browse",
    "commons",
    "plot",
    "stats",
    "square",
    "profile",
  ];

  // Handle /commons/:slug pattern
  if (path.startsWith("commons/")) {
    const categorySlug = path.slice("commons/".length);
    if (categorySlug) {
      return { view: "commons-category", categorySlug };
    }
    return { view: "commons" };
  }

  if (validViews.includes(path as View)) {
    return { view: path as View };
  }

  return { view: "home" };
};

function App() {
  const initialState = getInitialView();
  const [currentView, setCurrentView] = useState<View>(initialState.view);
  const [selectedDeckId, setSelectedDeckId] = useState<DeckId | undefined>(
    undefined,
  );
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<
    string | undefined
  >(initialState.categorySlug);
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Navigation wrapper that updates both state and URL
  const navigate = useCallback((view: View, slug?: string) => {
    setCurrentView(view);
    if (view === "commons-category" && slug) {
      setSelectedCategorySlug(slug);
      window.history.pushState({}, "", `/commons/${slug}`);
    } else {
      const path = view === "home" ? "/" : `/${view}`;
      window.history.pushState({}, "", path);
    }
  }, []);

  // All hooks must be called before any early returns
  const navigateToHome = useCallback(() => navigate("home"), [navigate]);
  const navigateToBrowse = useCallback(() => navigate("browse"), [navigate]);
  const navigateToCommons = useCallback(() => navigate("commons"), [navigate]);
  const navigateToCategory = useCallback(
    (slug: string) => navigate("commons-category", slug),
    [navigate],
  );

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await db.open();
        // Initialize sync service
        await syncService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize application:", error);
      }
    };

    initializeApp();

    // Cleanup sync service on unmount
    return () => {
      syncService.cleanup();
    };
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const state = getInitialView();
      setCurrentView(state.view);
      setSelectedCategorySlug(state.categorySlug);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleStartStudy = useCallback(
    (deckId?: DeckId) => {
      setSelectedDeckId(deckId);
      navigate("study");
    },
    [navigate],
  );

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
          <ProtectedView>
            <StudyView
              onBack={navigateToBrowse}
              initialDeckId={selectedDeckId}
            />
          </ProtectedView>
        );
      case "browse":
        return (
          <DeckBrowser
            onBack={navigateToHome}
            onStartStudy={handleStartStudy}
          />
        );
      case "commons":
        return (
          <CommonsView
            onBack={navigateToHome}
            onCategorySelect={navigateToCategory}
            onDeckSelect={(deckId) => {
              // For now, navigate to study with the deck ID
              // In future, could show a deck preview modal
              setSelectedDeckId(deckId as DeckId);
              navigate("study");
            }}
          />
        );
      case "commons-category":
        return selectedCategorySlug ? (
          <CategoryDecksView
            categorySlug={selectedCategorySlug}
            onBack={navigateToCommons}
            onDeckSelect={(deckId) => {
              setSelectedDeckId(deckId as DeckId);
              navigate("study");
            }}
          />
        ) : (
          <CommonsView
            onBack={navigateToHome}
            onCategorySelect={navigateToCategory}
          />
        );
      case "plot":
        return (
          <ProtectedView>
            <PlotView onBack={navigateToHome} onNavigate={navigate} />
          </ProtectedView>
        );
      case "stats":
        return (
          <ProtectedView>
            <StatsView onBack={navigateToHome} />
          </ProtectedView>
        );
      case "square":
        return (
          <ProtectedView>
            <SquareView onBack={navigateToHome} />
          </ProtectedView>
        );
      case "profile":
        return (
          <ProtectedView>
            <ProfileView onBack={navigateToHome} />
          </ProtectedView>
        );
      default:
        return <HomeView onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <SkipToMain />
      <ScanlineOverlay />

      {/* Shared Navigation Bar */}
      {currentView !== "home" && (
        <SharedNavigation currentView={currentView} onNavigate={navigate} />
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

      <Footer onNavigate={navigate} />
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

export default App;
