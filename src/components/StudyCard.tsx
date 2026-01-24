"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "../lib/srs-engine";
import { getMediaUrl } from "../lib/anki-import";
import { SafeHtml } from "./SafeHtml";
import { Volume2, Clock, BarChart3 } from "lucide-react";

interface StudyCardProps {
  card: Card;
  onRate: (rating: number) => void;
  onFlip?: () => void;
  currentStreak: number;
  totalReviewed: number;
}

export default function StudyCard({
  card,
  onRate,
  onFlip,
  currentStreak,
  totalReviewed,
}: StudyCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [frontAudioUrl, setFrontAudioUrl] = useState<string | null>(null);
  const [backAudioUrl, setBackAudioUrl] = useState<string | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);

  // Load media URLs when card changes
  useEffect(() => {
    const loadMedia = async () => {
      // Load audio
      if (card.frontAudio) {
        const url = await getMediaUrl(card.frontAudio);
        setFrontAudioUrl(url);
      } else {
        setFrontAudioUrl(null);
      }

      if (card.backAudio) {
        const url = await getMediaUrl(card.backAudio);
        setBackAudioUrl(url);
      } else {
        setBackAudioUrl(null);
      }

      // Load images
      if (card.frontImage) {
        const url = await getMediaUrl(card.frontImage);
        setFrontImageUrl(url);
      } else {
        setFrontImageUrl(null);
      }

      if (card.backImage) {
        const url = await getMediaUrl(card.backImage);
        setBackImageUrl(url);
      } else {
        setBackImageUrl(null);
      }
    };
    loadMedia();
  }, [
    card.id,
    card.frontAudio,
    card.backAudio,
    card.frontImage,
    card.backImage,
  ]);

  const playAudio = (url: string | null) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch((e) => console.error("Error playing audio:", e));
  };

  const handleFrontAudioClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      playAudio(frontAudioUrl);
    },
    [frontAudioUrl],
  );

  const handleBackAudioClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      playAudio(backAudioUrl);
    },
    [backAudioUrl],
  );

  useEffect(() => {
    // Reset state for new card
    setIsFlipped(false);
    setShowRating(false);
    setStartTime(Date.now());
    setSelectedRating(null);
  }, [card.id]);

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      setTimeout(() => setShowRating(true), 300);
      // Notify parent that card was flipped (for review event tracking)
      onFlip?.();
    }
  };

  const handleRate = (rating: number) => {
    setSelectedRating(rating);

    // Add a satisfying delay before moving to next card
    setTimeout(() => {
      onRate(rating);
    }, 400);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFlip();
    }
  }, []);

  const handleRateClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rating = e.currentTarget.dataset.rating;
      if (rating) {
        handleRate(parseInt(rating));
      }
    },
    [],
  );

  // Rating buttons using terminal color palette
  // Semantic colors: Again=warning, Hard=caution, Good=primary, Easy=success
  const ratingButtons = [
    {
      value: 1,
      label: "Again",
      interval: "1 day",
      bgColor: "bg-red-500/10 dark:bg-red-500/20",
      hoverColor: "hover:bg-red-500/20 dark:hover:bg-red-500/30",
      textColor: "text-red-600 dark:text-red-400",
      borderColor: "border-red-500/40 dark:border-red-500/50",
    },
    {
      value: 2,
      label: "Hard",
      interval: "3 days",
      bgColor: "bg-amber/10 dark:bg-amber/20",
      hoverColor: "hover:bg-amber/20 dark:hover:bg-amber/30",
      textColor: "text-amber-dark dark:text-amber",
      borderColor: "border-amber/40 dark:border-amber/50",
    },
    {
      value: 3,
      label: "Good",
      interval: "10 days",
      bgColor: "bg-cyan/10 dark:bg-cyan/20",
      hoverColor: "hover:bg-cyan/20 dark:hover:bg-cyan/30",
      textColor: "text-cyan-dark dark:text-cyan",
      borderColor: "border-cyan/40 dark:border-cyan/50",
    },
    {
      value: 4,
      label: "Easy",
      interval: "20 days",
      bgColor: "bg-green/10 dark:bg-emerald-500/20",
      hoverColor: "hover:bg-green/20 dark:hover:bg-emerald-500/30",
      textColor: "text-green dark:text-emerald-400",
      borderColor: "border-green/40 dark:border-emerald-500/50",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
      {/* Card Container - Simple Reveal */}
      <div className="w-full max-w-2xl space-y-6">
        {/* Question Card */}
        <div
          onClick={!isFlipped ? handleFlip : undefined}
          onKeyDown={!isFlipped ? handleKeyDown : undefined}
          tabIndex={!isFlipped ? 0 : -1}
          role={!isFlipped ? "button" : undefined}
          aria-label={!isFlipped ? "Click to reveal answer" : undefined}
          className={`${!isFlipped ? "cursor-pointer hover:border-cyan dark:hover:border-cyan hover:shadow-[0_0_20px_rgba(0,217,255,0.2)]" : ""} bg-paper dark:bg-dark-surface rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center border-2 border-ink/10 dark:border-cyan/30 transition-all min-h-[200px]`}
        >
          {frontAudioUrl && (
            <button
              onClick={handleFrontAudioClick}
              className="absolute top-4 right-4 p-2 hover:bg-ink/5 dark:hover:bg-cyan/10 rounded transition-colors"
              title="Play audio"
            >
              <Volume2 className="w-5 h-5 text-cyan-dark dark:text-cyan" />
            </button>
          )}

          <div className="text-center w-full">
            <span className="inline-block px-3 py-1 bg-cyan/10 dark:bg-cyan/20 text-cyan-dark dark:text-cyan text-xs font-semibold font-mono rounded-full mb-4">
              [QUESTION]
            </span>
            {frontImageUrl && (
              <div className="mb-4">
                <img
                  src={frontImageUrl}
                  alt="Front card"
                  className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                />
              </div>
            )}
            {card.frontHtml ? (
              <SafeHtml
                html={card.frontHtml}
                className="text-lg text-ink dark:text-text-primary mb-4 anki-card-content"
              />
            ) : (
              <h3 className="text-3xl md:text-4xl font-bold text-ink dark:text-text-primary mb-4 whitespace-pre-line">
                {card.front}
              </h3>
            )}
            {!isFlipped && (
              <p className="text-ink-light dark:text-text-muted text-lg font-mono">
                &gt; Click to reveal answer
              </p>
            )}
          </div>
        </div>

        {/* Answer Card - Revealed Below */}
        <AnimatePresence>
          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-amber/5 to-amber/10 dark:from-amber/10 dark:to-amber/20 rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center border-2 border-amber/40 dark:border-amber/50 min-h-[200px] relative shadow-[0_0_30px_rgba(251,191,36,0.1)] dark:shadow-[0_0_30px_rgba(251,191,36,0.2)]"
            >
              {backAudioUrl && (
                <button
                  onClick={handleBackAudioClick}
                  className="absolute top-4 right-4 p-2 hover:bg-amber/10 dark:hover:bg-amber/20 rounded transition-colors"
                  title="Play audio"
                >
                  <Volume2 className="w-5 h-5 text-amber-dark dark:text-amber" />
                </button>
              )}

              <div className="text-center w-full">
                <span className="inline-block px-3 py-1 bg-amber/10 dark:bg-amber/20 text-amber-dark dark:text-amber text-xs font-semibold font-mono rounded-full mb-4">
                  [ANSWER]
                </span>
                {backImageUrl && (
                  <div className="mb-4">
                    <img
                      src={backImageUrl}
                      alt="Back card"
                      className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                    />
                  </div>
                )}
                {card.backHtml ? (
                  <SafeHtml
                    html={card.backHtml}
                    className="text-lg text-ink dark:text-text-primary mb-4 anki-card-content"
                  />
                ) : (
                  <h3 className="text-3xl md:text-4xl font-bold text-ink dark:text-text-primary mb-4 whitespace-pre-line">
                    {card.back}
                  </h3>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response Options */}
      <div className="w-full max-w-2xl mt-6">
        <AnimatePresence>
          {isFlipped && showRating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {ratingButtons.map((btn) => {
                const isSelected = selectedRating === btn.value;
                return (
                  <button
                    key={btn.value}
                    onClick={handleRateClick}
                    data-rating={btn.value}
                    disabled={selectedRating !== null}
                    className={`py-3 px-4 ${btn.bgColor} ${btn.hoverColor} ${btn.textColor} font-semibold rounded-lg transition-all border ${btn.borderColor} hover:shadow-lg ${
                      selectedRating !== null && !isSelected ? "opacity-30" : ""
                    }`}
                  >
                    <div className="text-sm">{btn.label}</div>
                    <div className="text-xs opacity-75">{btn.interval}</div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Study Stats */}
      <div className="w-full max-w-2xl mt-12 grid grid-cols-3 gap-4">
        <div className="bg-paper dark:bg-dark-surface rounded-xl p-4 border border-ink/10 dark:border-amber/30 shadow-sm hover:border-amber/40 dark:hover:border-amber/50 transition-colors">
          <div className="text-xs text-ink-light dark:text-text-muted font-semibold font-mono mb-2 flex items-center gap-2">
            <Clock size={16} className="text-amber-dark dark:text-amber" />
            TIME
          </div>
          <div className="text-2xl font-bold text-ink dark:text-text-primary font-mono">
            {Math.floor((Date.now() - startTime) / 1000 / 60)}m{" "}
            {Math.floor(((Date.now() - startTime) / 1000) % 60)}s
          </div>
        </div>
        <div className="bg-paper dark:bg-dark-surface rounded-xl p-4 border border-ink/10 dark:border-cyan/30 shadow-sm hover:border-cyan/40 dark:hover:border-cyan/50 transition-colors">
          <div className="text-xs text-ink-light dark:text-text-muted font-semibold font-mono mb-2 flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-dark dark:text-cyan" />
            STREAK
          </div>
          <div className="text-2xl font-bold text-ink dark:text-text-primary font-mono">
            {currentStreak} days
          </div>
        </div>
        <div className="bg-paper dark:bg-dark-surface rounded-xl p-4 border border-ink/10 dark:border-cyan/30 shadow-sm hover:border-cyan/40 dark:hover:border-cyan/50 transition-colors">
          <div className="text-xs text-ink-light dark:text-text-muted font-semibold font-mono mb-2 flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-dark dark:text-cyan" />
            REVIEWED
          </div>
          <div className="text-2xl font-bold text-ink dark:text-text-primary font-mono">
            {totalReviewed}
          </div>
        </div>
      </div>
    </div>
  );
}
