import { motion } from "framer-motion";
import { useMemo } from "react";
import { InsightData } from "../types";
import {
  generateInsights,
  getDailyInsight,
  getDayOfYear,
} from "../utils/insightGenerators";

interface PersonalInsightProps {
  weeklyMastered: number;
  preferredHour: number | null;
  sessionStyle: string | null;
  learnerType: string | null;
  trend: string | null;
  isLoading?: boolean;
}

export function PersonalInsight({
  weeklyMastered,
  preferredHour,
  sessionStyle,
  learnerType,
  trend,
  isLoading = false,
}: PersonalInsightProps) {
  const insight = useMemo(() => {
    const data: InsightData = {
      weeklyMastered,
      preferredHour,
      sessionStyle,
      learnerType,
      trend,
    };

    const insights = generateInsights(data);
    return getDailyInsight(insights, getDayOfYear());
  }, [weeklyMastered, preferredHour, sessionStyle, learnerType, trend]);

  // Don't render if no insights or still loading
  if (isLoading) {
    return (
      <div className="border-2 border-amber/20 rounded-lg p-4">
        <div className="skeleton h-5 w-3/4 mx-auto rounded" />
      </div>
    );
  }

  if (!insight) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="border-2 border-amber/30 hover:border-amber rounded-lg p-4 hover:shadow-amber-glow transition-all bg-dark-surface"
    >
      <div className="flex items-center justify-center gap-3">
        <span className="text-amber text-lg" role="img" aria-hidden="true">
          &#128161;
        </span>
        <p className="text-text-primary font-mono text-sm md:text-base text-center">
          "{insight.message}"
        </p>
      </div>
    </motion.div>
  );
}
