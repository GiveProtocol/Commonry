import { motion } from "framer-motion";
import { DeckDueInfo } from "../types";
import { PlotCardSkeleton } from "./PlotSkeleton";

interface TodaysFocusProps {
  dueCount: number;
  deckWithMostDue: DeckDueInfo | null;
  hasCards: boolean;
  isLoading?: boolean;
  onStartStudy: () => void;
  onBrowseDecks: () => void;
}

function getMessageForDueCount(
  dueCount: number,
  hasCards: boolean,
): { message: string; cta: string; ctaType: "study" | "browse" } {
  if (!hasCards) {
    return {
      message: "Ready to plant your first seeds?",
      cta: "Browse Decks",
      ctaType: "browse",
    };
  }

  if (dueCount === 0) {
    return {
      message: "All caught up! Your garden is thriving.",
      cta: "Browse Decks",
      ctaType: "browse",
    };
  }

  if (dueCount <= 5) {
    return {
      message: "Just a few cards waiting for you",
      cta: "Start Studying",
      ctaType: "study",
    };
  }

  if (dueCount <= 15) {
    return {
      message: `${dueCount} cards ready for review`,
      cta: "Start Studying",
      ctaType: "study",
    };
  }

  if (dueCount <= 30) {
    return {
      message: "A good batch waiting - take your time",
      cta: "Start Studying",
      ctaType: "study",
    };
  }

  if (dueCount <= 50) {
    return {
      message: "How about a 10-minute session?",
      cta: "Quick Session",
      ctaType: "study",
    };
  }

  return {
    message: "No pressure - start small",
    cta: "Quick Session",
    ctaType: "study",
  };
}

export function TodaysFocus({
  dueCount,
  deckWithMostDue,
  hasCards,
  isLoading = false,
  onStartStudy,
  onBrowseDecks,
}: TodaysFocusProps) {
  if (isLoading) {
    return <PlotCardSkeleton />;
  }

  const { message, cta, ctaType } = getMessageForDueCount(dueCount, hasCards);
  const handleClick = ctaType === "study" ? onStartStudy : onBrowseDecks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="border-2 border-cyan/30 hover:border-cyan rounded-lg p-6 hover:shadow-cyan-glow transition-all bg-dark-surface"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <span className="text-cyan text-sm font-medium font-mono uppercase tracking-wider">
          Today's Focus
        </span>

        {hasCards && dueCount > 0 ? (
          <div className="text-5xl font-bold text-cyan font-mono [text-shadow:0_0_20px_rgba(0,217,255,0.5)]">
            {dueCount}
          </div>
        ) : (
          <div className="text-3xl font-bold text-cyan font-mono">
            {dueCount === 0 && hasCards ? (
              <span role="img" aria-label="celebration">
                &#127793;
              </span>
            ) : (
              <span role="img" aria-label="seedling">
                &#127793;
              </span>
            )}
          </div>
        )}

        <p className="text-text-muted font-mono text-sm">{message}</p>

        {deckWithMostDue && dueCount > 0 && (
          <p className="text-text-muted/70 font-mono text-xs">
            Most due: {deckWithMostDue.name} ({deckWithMostDue.dueCount})
          </p>
        )}

        <button
          onClick={handleClick}
          className="w-full py-3 px-6 bg-cyan text-dark font-bold font-mono rounded-lg hover:shadow-cyan-glow transition-all hover:bg-cyan-dark focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2 focus:ring-offset-dark"
        >
          {cta}
        </button>
      </div>
    </motion.div>
  );
}
