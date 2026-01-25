import { useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { usePlotData } from "./hooks/usePlotData";
import { PlotGreeting } from "./components/PlotGreeting";
import { TodaysFocus } from "./components/TodaysFocus";
import { MomentumCard } from "./components/MomentumCard";
import { PersonalInsight } from "./components/PersonalInsight";
import { MilestoneProgress } from "./components/MilestoneProgress";
import { PlotSkeleton } from "./components/PlotSkeleton";

type View = "home" | "study" | "browse" | "commons" | "commons-category" | "plot" | "stats" | "square" | "profile";

interface PlotViewProps {
  onBack: () => void;
  onNavigate: (view: View, slug?: string) => void;
}

function EmptyState({ onBrowseDecks, onCreateCard }: { onBrowseDecks: () => void; onCreateCard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 space-y-6"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.4)]">
          Welcome to Your Plot
        </h2>
        <p className="text-text-muted font-mono text-sm max-w-md mx-auto">
          This is where you'll watch your knowledge grow.
          Start by adding your first deck!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onBrowseDecks}
          className="px-6 py-3 bg-cyan text-dark font-bold font-mono rounded-lg hover:shadow-cyan-glow transition-all"
        >
          Browse Decks
        </button>
        <button
          onClick={onCreateCard}
          className="px-6 py-3 border-2 border-cyan text-cyan font-bold font-mono rounded-lg hover:shadow-cyan-glow transition-all hover:bg-cyan/10"
        >
          Create Your Own
        </button>
      </div>
    </motion.div>
  );
}

export function PlotView({ onBack, onNavigate }: PlotViewProps) {
  const { user } = useAuth();
  const plotData = usePlotData();

  const handleStartStudy = useCallback(() => {
    onNavigate("study");
  }, [onNavigate]);

  const handleBrowseDecks = useCallback(() => {
    onNavigate("browse");
  }, [onNavigate]);

  const handleNavigateCommons = useCallback(() => {
    onNavigate("commons");
  }, [onNavigate]);

  // Show skeleton while loading
  if (plotData.isLoading && !plotData.isLocalDataLoaded) {
    return (
      <div className="bg-dark min-h-screen">
        <div className="flex items-center justify-between p-8 border-b-2 border-cyan shadow-[0_2px_20px_rgba(0,217,255,0.3)]">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-text-muted hover:text-cyan transition-colors font-mono hover:shadow-cyan-glow"
          >
            &larr; ./back
          </button>
          <h1 className="text-2xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
            [YOUR PLOT]
          </h1>
          <div />
        </div>

        <div className="p-8 max-w-4xl mx-auto">
          <PlotSkeleton />
        </div>
      </div>
    );
  }

  // Check if user is new (no cards, no study history)
  const hasCards = plotData.totalDueCards > 0 || plotData.deckWithMostDue !== null;
  const hasStudyHistory = plotData.statistics?.lastStudyDate !== null;
  const isNewUser = !hasCards && !hasStudyHistory;

  // Extract analytics data
  const analyticsVelocity = plotData.analyticsProfile?.velocity;
  const analyticsPatterns = plotData.analyticsProfile?.patterns;

  return (
    <div className="bg-dark min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b-2 border-cyan shadow-[0_2px_20px_rgba(0,217,255,0.3)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-muted hover:text-cyan transition-colors font-mono hover:shadow-cyan-glow"
        >
          &larr; ./back
        </button>

        <h1 className="text-2xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
          [YOUR PLOT]
        </h1>

        <button
          onClick={plotData.refetch}
          className="text-text-muted hover:text-cyan transition-colors font-mono text-sm"
          title="Refresh data"
        >
          &#8635;
        </button>
      </div>

      <div className="p-8 max-w-4xl mx-auto space-y-8">
        {isNewUser ? (
          <EmptyState onBrowseDecks={handleNavigateCommons} onCreateCard={handleBrowseDecks} />
        ) : (
          <>
            {/* Greeting */}
            <PlotGreeting
              userName={user?.displayName || user?.username || "there"}
              currentStreak={plotData.statistics?.currentStreak || 0}
              lastStudyDate={plotData.statistics?.lastStudyDate || null}
              cardsStudied={plotData.statistics?.cardsStudiedThisWeek || 0}
              isLoading={plotData.isLoading}
            />

            {/* Main cards row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TodaysFocus
                dueCount={plotData.totalDueCards}
                deckWithMostDue={plotData.deckWithMostDue}
                hasCards={hasCards || hasStudyHistory}
                isLoading={!plotData.isLocalDataLoaded}
                onStartStudy={handleStartStudy}
                onBrowseDecks={handleNavigateCommons}
              />

              <MomentumCard
                currentStreak={plotData.statistics?.currentStreak || 0}
                lastStudyDate={plotData.statistics?.lastStudyDate || null}
                trend={analyticsVelocity?.trend}
                isLoading={plotData.isLoading}
              />
            </div>

            {/* Personal Insight */}
            <PersonalInsight
              weeklyMastered={analyticsVelocity?.currentWeekMastered || 0}
              preferredHour={analyticsPatterns?.preferredHour ?? null}
              sessionStyle={analyticsPatterns?.sessionStyle ?? null}
              learnerType={analyticsPatterns?.learnerType ?? null}
              trend={analyticsVelocity?.trend ?? null}
              isLoading={plotData.isLoading}
            />

            {/* Milestone Progress (only shows if close to completing) */}
            <MilestoneProgress
              achievements={plotData.achievements}
              isLoading={plotData.isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default PlotView;
