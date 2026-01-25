import { motion } from "framer-motion";
import { useMemo } from "react";
import { WeekDay } from "../types";
import { PlotCardSkeleton } from "./PlotSkeleton";

interface MomentumCardProps {
  currentStreak: number;
  lastStudyDate: string | null;
  trend?: "accelerating" | "stable" | "decelerating" | null;
  isLoading?: boolean;
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start your streak today!";
  if (streak === 1) return "1-day streak!";
  if (streak < 7) return `${streak}-day streak!`;
  if (streak < 14) return `${streak}-day streak! Nice!`;
  if (streak < 30) return `${streak}-day streak! Amazing!`;
  return `${streak}-day streak! Incredible!`;
}

function getTrendMessage(
  trend: "accelerating" | "stable" | "decelerating" | null,
): string | null {
  switch (trend) {
    case "accelerating":
      return "Your pace is picking up!";
    case "stable":
      return "Steady and strong";
    case "decelerating":
      // Don't show negative messages - avoid guilt
      return null;
    default:
      return null;
  }
}

function getWeekDays(lastStudyDate: string | null): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: WeekDay[] = [];

  // Get the last 7 days (including today)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const isToday = i === 0;

    // For now, we only know if the user studied on their last study date
    // In a real implementation, we'd fetch the study history for the week
    let studied = false;
    if (lastStudyDate) {
      const studyDate = new Date(lastStudyDate);
      studyDate.setHours(0, 0, 0, 0);
      studied = date.getTime() === studyDate.getTime();
    }

    days.push({ date, studied, isToday });
  }

  return days;
}

function ConsistencyDot({ day }: { day: WeekDay }) {
  const baseClasses = "w-4 h-4 rounded-full transition-all";

  if (day.isToday && !day.studied) {
    // Pulsing dot for today (not yet studied)
    return (
      <motion.div
        className={`${baseClasses} bg-cyan/40 border-2 border-cyan`}
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        title="Today"
      />
    );
  }

  if (day.studied) {
    // Filled dot for studied days
    return (
      <div
        className={`${baseClasses} bg-cyan shadow-[0_0_8px_rgba(0,217,255,0.6)]`}
        title={day.date.toLocaleDateString()}
      />
    );
  }

  // Empty dot for missed days
  return (
    <div
      className={`${baseClasses} bg-dark-surface border-2 border-cyan/30`}
      title={day.date.toLocaleDateString()}
    />
  );
}

export function MomentumCard({
  currentStreak,
  lastStudyDate,
  trend,
  isLoading = false,
}: MomentumCardProps) {
  const weekDays = useMemo(() => getWeekDays(lastStudyDate), [lastStudyDate]);
  const streakMessage = getStreakMessage(currentStreak);
  const trendMessage = getTrendMessage(trend ?? null);

  if (isLoading) {
    return <PlotCardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="border-2 border-amber/30 hover:border-amber rounded-lg p-6 hover:shadow-amber-glow transition-all bg-dark-surface"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <span className="text-amber text-sm font-medium font-mono uppercase tracking-wider">
          Momentum
        </span>

        {currentStreak > 0 ? (
          <div className="text-5xl font-bold text-amber font-mono [text-shadow:0_0_20px_rgba(251,191,36,0.5)]">
            {currentStreak}
          </div>
        ) : (
          <div className="text-3xl font-bold text-amber/60 font-mono">
            <span role="img" aria-label="spark">
              &#10024;
            </span>
          </div>
        )}

        <p className="text-text-muted font-mono text-sm">{streakMessage}</p>

        {/* Weekly consistency dots */}
        <div className="flex gap-2 items-center justify-center pt-2">
          {weekDays.map((day, i) => (
            <ConsistencyDot key={i} day={day} />
          ))}
        </div>

        <p className="text-text-muted/60 font-mono text-xs">Last 7 days</p>

        {/* Trend message (only positive) */}
        {trendMessage && (
          <p className="text-amber/80 font-mono text-xs">{trendMessage}</p>
        )}
      </div>
    </motion.div>
  );
}
