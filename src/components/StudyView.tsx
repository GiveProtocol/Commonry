import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Deck } from "../lib/srs-engine";
import { db } from "../storage/database";
import StudyCard from "./StudyCard";
import { useAuth } from "../contexts/AuthContext";
import { useSession } from "../contexts/SessionContext";
import { reviewEventCapture } from "../services/review-event-capture";
import { DeckId } from "../types/ids";

interface StudyViewProps {
  onBack: () => void;
  initialDeckId?: DeckId;
}

export function StudyView({ onBack, initialDeckId }: StudyViewProps) {
  const { isAuthenticated } = useAuth();
  const { startSession, endSession, recordCardCompleted } = useSession();
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<DeckId>("default" as DeckId);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    correct: 0,
    streak: 0,
  });
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());
  const sessionStartedRef = useRef(false);

  const loadStats = () => {
    // Load saved stats from localStorage
    const savedStats = localStorage.getItem("srs-stats");
    if (savedStats) {
      setSessionStats(JSON.parse(savedStats));
    }
  };

  const loadDecks = async () => {
    try {
      const allDecks = await db.getAllDecks();
      setDecks(allDecks);

      // Use initialDeckId if provided, otherwise use first deck
      if (initialDeckId) {
        setSelectedDeck(initialDeckId);
      } else if (allDecks.length > 0 && !selectedDeck) {
        setSelectedDeck(allDecks[0].id);
      }
    } catch (error) {
      console.error("Failed to load decks:", error);
    }
  };

  const loadCards = async () => {
    setIsLoading(true);
    try {
      // Check if we have any cards, if not, add sample cards
      const cardCount = await db.cards.count();
      if (cardCount === 0) {
        await db.addSampleCards();
      }

      // Get all cards and cards for review from selected deck
      const allCardsArray = await db.cards
        .where("deckId")
        .equals(selectedDeck)
        .toArray();
      const cardsForReview = await db.getCardsForReview(selectedDeck, 20);

      setAllCards(allCardsArray);
      setDueCards(cardsForReview);

      // Start session if authenticated and we have cards
      if (
        isAuthenticated &&
        cardsForReview.length > 0 &&
        !sessionStartedRef.current
      ) {
        sessionStartedRef.current = true;
        await startSession({
          sessionType: "regular",
          deckId: selectedDeck,
          cardsPlanned: cardsForReview.length,
        });
      }

      // Set current card and start review event
      const firstCard = cardsForReview[0] || null;
      setCurrentCard(firstCard);
      setCardStartTime(Date.now());

      // Start review event capture for the first card (fire-and-forget)
      if (firstCard && isAuthenticated) {
        reviewEventCapture.startCardReview(firstCard).catch((error) => {
          console.warn("[StudyView] Failed to start review event:", error);
        });
      }
    } catch (error) {
      console.error("Failed to load cards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
    loadCards();
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedDeck) {
      loadCards();
    }
  }, [selectedDeck]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" && currentCard) {
        e.preventDefault();
        const flipButton = document.querySelector("[data-flip-button]");
        if (flipButton) (flipButton as HTMLElement).click();
      }

      if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
        const rating = parseInt(e.code.replace("Digit", ""));
        const ratingButton = document.querySelector(
          `[data-rating="${rating}"]`,
        );
        if (ratingButton) (ratingButton as HTMLElement).click();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentCard]);

  // Cleanup: end session on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending review
      if (reviewEventCapture.hasActiveReview()) {
        reviewEventCapture.cancelReview();
      }

      // End session if active (will use beacon for reliability)
      if (sessionStartedRef.current) {
        endSession(true).catch(console.error);
        sessionStartedRef.current = false;
      }
    };
  }, [endSession]);

  // Handle card flip tracking
  const handleCardFlip = useCallback(() => {
    if (isAuthenticated && reviewEventCapture.hasActiveReview()) {
      reviewEventCapture.recordAnswerShown();
    }
  }, [isAuthenticated]);

  const handleRating = useCallback(
    async (rating: number) => {
      if (!currentCard) return;

      try {
        const duration = Date.now() - cardStartTime;
        const isNewCard = currentCard.status === "new";
        const typedRating = rating as 1 | 2 | 3 | 4;

        // Record review in local database
        const result = await db.recordReview(currentCard.id, rating, duration);
        console.log(
          `Card reviewed: ${rating}, next review in ${result.interval} days`,
        );

        // Complete the review event capture (non-blocking)
        if (isAuthenticated) {
          reviewEventCapture
            .completeReview(currentCard, typedRating)
            .then((success) => {
              if (success) {
                console.log("[StudyView] Review event captured successfully");
              }
            })
            .catch((error) => {
              console.warn(
                "[StudyView] Failed to capture review event:",
                error,
              );
            });

          // Record in session context
          recordCardCompleted(typedRating, duration, isNewCard);
        }

        // Update session stats
        const newStats = {
          reviewed: sessionStats.reviewed + 1,
          correct: sessionStats.correct + (rating >= 3 ? 1 : 0),
          streak: rating >= 3 ? sessionStats.streak + 1 : 0,
        };
        setSessionStats(newStats);
        localStorage.setItem("srs-stats", JSON.stringify(newStats));

        // Show success animation for good/easy ratings
        if (rating >= 3) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 1500);
        }

        // Move to next card
        const remainingDue = dueCards.slice(1);
        setDueCards(remainingDue);

        if (remainingDue.length > 0) {
          const nextCard = remainingDue[0];
          setTimeout(async () => {
            setCurrentCard(nextCard);
            setCardStartTime(Date.now());

            // Start review event for the next card (fire-and-forget)
            if (isAuthenticated && nextCard) {
              reviewEventCapture.startCardReview(nextCard).catch((error) => {
                console.warn(
                  "[StudyView] Failed to start review event:",
                  error,
                );
              });
            }
          }, 500);
        } else {
          // Session complete - end the session
          setTimeout(async () => {
            setCurrentCard(null);
            if (isAuthenticated && sessionStartedRef.current) {
              await endSession(false);
              sessionStartedRef.current = false;
            }
          }, 500);
        }
      } catch (error) {
        console.error("Failed to record review:", error);
      }
    },
    [
      currentCard,
      dueCards,
      sessionStats,
      cardStartTime,
      isAuthenticated,
      recordCardCompleted,
      endSession,
    ],
  );

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);

      // Placeholder: simulates import delay while Anki import is being built
      setTimeout(() => {
        setIsLoading(false);
        setShowImport(false);
        // Reload cards after import
        loadCards();
      }, 2000);
    },
    [],
  );

  const handleDeckChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedDeck(e.target.value as DeckId);
    },
    [],
  );

  const handleShowImport = useCallback(() => {
    setShowImport(true);
  }, []);

  const handleHideImport = useCallback(() => {
    setShowImport(false);
  }, []);

  const handleBackClick = useCallback(async () => {
    // Cancel any pending review event
    if (reviewEventCapture.hasActiveReview()) {
      reviewEventCapture.cancelReview();
    }

    // End the session (mark as interrupted since user left early)
    if (isAuthenticated && sessionStartedRef.current) {
      await endSession(true);
      sessionStartedRef.current = false;
    }

    onBack();
  }, [onBack, isAuthenticated, endSession]);

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (isLoading && sessionStats.reviewed === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-terminal-base">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-2 border-terminal-primary dark:border-cyan border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
            Loading cards...
          </p>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="bg-terminal-base p-8 h-full">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors border border-terminal-primary/30 dark:border-cyan/30 rounded px-4 py-2 font-mono hover:shadow-terminal-glow dark:hover:shadow-cyan-glow"
          >
            ← ./back
          </button>

          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold terminal-primary dark:text-cyan mb-3 font-mono text-shadow-terminal dark:[text-shadow:0_0_20px_rgba(0,217,255,0.5)]">
              COMMONRY
            </h1>
            <p className="text-terminal-muted dark:text-text-muted font-mono">
              $ ./study --mode=review
            </p>

            {/* Deck Selector */}
            {decks.length > 0 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <label
                  htmlFor="deck-selector-top"
                  className="text-terminal-muted dark:text-text-muted font-mono"
                >
                  --deck=
                </label>
                <select
                  id="deck-selector-top"
                  value={selectedDeck}
                  onChange={handleDeckChange}
                  className="px-4 py-2 bg-terminal-surface dark:bg-dark-surface border-2 border-terminal-primary/30 dark:border-cyan/30 rounded terminal-primary dark:text-cyan font-mono focus:outline-none focus:border-terminal-primary dark:focus:border-cyan focus:shadow-terminal-glow dark:focus:shadow-cyan-glow transition-all"
                >
                  {decks.map((deck) => (
                    <option
                      key={deck.id}
                      value={deck.id}
                      className="bg-terminal-surface dark:bg-dark terminal-primary dark:text-cyan"
                    >
                      {deck.name} ({deck.dueCount} due)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </motion.div>

          {/* Session Complete or No Cards */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-terminal-surface dark:bg-dark-surface border-2 border-terminal-primary dark:border-cyan rounded-lg p-12 text-center shadow-terminal-glow dark:shadow-[0_0_30px_rgba(0,217,255,0.3)]"
          >
            {sessionStats.reviewed > 0 ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <div className="w-20 h-20 terminal-primary dark:text-cyan mx-auto mb-6 text-7xl [text-shadow:0_0_20px_var(--terminal-green)] dark:[text-shadow:0_0_20px_#00d9ff]">
                    ✓
                  </div>
                </motion.div>
                <h2 className="text-3xl font-bold mb-4 terminal-primary dark:text-cyan font-mono text-shadow-terminal dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
                  SESSION_COMPLETE
                </h2>
                <div className="space-y-3 mb-8 font-mono">
                  <p className="text-xl text-terminal-base dark:text-text-primary">
                    <span className="text-terminal-muted dark:text-text-muted">
                      $ reviewed:
                    </span>{" "}
                    <span className="font-bold terminal-accent dark:text-amber">
                      {sessionStats.reviewed}
                    </span>{" "}
                    <span className="text-terminal-muted dark:text-text-muted">
                      cards
                    </span>
                  </p>
                  <p className="text-lg text-terminal-muted dark:text-text-muted">
                    <span className="text-terminal-muted dark:text-text-muted">
                      $ accuracy:
                    </span>{" "}
                    <span className="terminal-primary dark:text-cyan font-bold">
                      {Math.round(
                        (sessionStats.correct / sessionStats.reviewed) * 100,
                      )}
                      %
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 terminal-accent dark:text-amber mx-auto mb-6 text-7xl [text-shadow:0_0_20px_var(--terminal-orange)] dark:[text-shadow:0_0_20px_#fbbf24]">
                  ✓
                </div>
                <h2 className="text-3xl font-bold mb-4 terminal-accent dark:text-amber font-mono text-shadow-terminal-accent dark:[text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
                  ALL_CLEAR
                </h2>
                <p className="text-xl text-terminal-muted dark:text-text-muted mb-8 font-mono">
                  No cards due for review
                </p>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleShowImport}
                className="px-6 py-3 bg-terminal-accent dark:bg-amber hover:bg-terminal-accent/90 dark:hover:bg-amber-dark text-paper dark:text-dark rounded font-mono font-bold flex items-center justify-center gap-2 transition-all shadow-terminal-accent-glow dark:shadow-amber-glow border border-terminal-accent dark:border-amber"
              >
                ./import-deck
              </button>

              <button
                onClick={handleBackClick}
                className="px-6 py-3 bg-terminal-surface dark:bg-dark-surface border-2 border-terminal-primary/30 dark:border-cyan/30 hover:border-terminal-primary dark:hover:border-cyan rounded font-mono font-bold flex items-center justify-center gap-2 hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all terminal-primary dark:text-cyan"
              >
                ./browse-decks
              </button>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8"
          >
            <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-primary/30 dark:border-cyan/30 rounded-lg p-6 text-center hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all">
              <p className="text-3xl mb-2">📚</p>
              <p className="text-2xl font-bold terminal-primary dark:text-cyan font-mono">
                {allCards.length}
              </p>
              <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
                Total Cards
              </p>
            </div>

            <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-accent/30 dark:border-amber/30 rounded-lg p-6 text-center hover:border-terminal-accent dark:hover:border-amber hover:shadow-terminal-accent-glow dark:hover:shadow-amber-glow transition-all">
              <p className="text-3xl mb-2">🔥</p>
              <p className="text-2xl font-bold terminal-accent dark:text-amber font-mono">
                {sessionStats.streak}
              </p>
              <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
                Current Streak
              </p>
            </div>

            <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-primary/30 dark:border-cyan/30 rounded-lg p-6 text-center hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all">
              <p className="text-3xl mb-2">🎯</p>
              <p className="text-2xl font-bold terminal-primary dark:text-cyan font-mono">
                20
              </p>
              <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
                Daily Goal
              </p>
            </div>
          </motion.div>
        </div>

        {/* Import Modal */}
        <AnimatePresence>
          {showImport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={handleHideImport}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full"
                onClick={handleStopPropagation}
              >
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Import Anki Deck
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Select an .apkg file to import your Anki deck
                </p>

                <label className="block">
                  <input
                    type="file"
                    accept=".apkg"
                    onChange={handleFileImport}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-600 transition-colors">
                    {isLoading ? (
                      <div className="w-12 h-12 text-emerald-600 mx-auto text-5xl animate-spin">
                        ⟳
                      </div>
                    ) : (
                      <div className="w-12 h-12 text-gray-400 mx-auto mb-3 text-5xl">
                        ↑
                      </div>
                    )}
                    <p className="text-gray-600 dark:text-gray-300">
                      {isLoading ? "Importing..." : "Click to select file"}
                    </p>
                  </div>
                </label>

                <button
                  onClick={handleHideImport}
                  className="w-full mt-6 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-medium hover:shadow-lg transition-all"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {currentCard && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-cyan-50 dark:from-gray-900 dark:via-cyan-900/10 dark:to-cyan-900/10">
            {/* Header */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-10">
              <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                >
                  ← Back to Decks
                </button>
                <div className="text-center">
                  {decks.length > 0 && (
                    <>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {decks.find((d) => d.id === selectedDeck)?.name ||
                          "Study Deck"}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {dueCards.length} cards remaining
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                      {sessionStats.reviewed}/
                      {sessionStats.reviewed + dueCards.length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      cards reviewed
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-4xl mx-auto px-6 py-3">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-500"
                      style={{
                        width: `${(sessionStats.reviewed / (sessionStats.reviewed + dueCards.length)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(
                      (sessionStats.reviewed /
                        (sessionStats.reviewed + dueCards.length)) *
                        100,
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Study Card Component */}
            <StudyCard
              key={currentCard.id}
              card={currentCard}
              onRate={handleRating}
              onFlip={handleCardFlip}
              currentStreak={sessionStats.streak}
              totalReviewed={sessionStats.reviewed}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-green-500 text-9xl">✓</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator */}
      {currentCard && dueCards.length > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30">
          <div className="glass rounded-full px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {dueCards.length} cards remaining
            </span>
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-700 to-emerald-600"
                initial={{ width: 0 }}
                animate={{
                  width: `${(sessionStats.reviewed / (sessionStats.reviewed + dueCards.length)) * 100}%`,
                }}
                transition={{ type: "spring", stiffness: 100 }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
