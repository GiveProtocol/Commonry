import { motion } from "framer-motion";
import { useMemo } from "react";
import { UserAchievement } from "../../../services/api";

interface MilestoneProgressProps {
  achievements: UserAchievement[] | null;
  isLoading?: boolean;
}

interface ClosestMilestone {
  name: string;
  progress: number;
  target: number;
  remaining: number;
  percentComplete: number;
}

function findClosestMilestone(
  achievements: UserAchievement[],
): ClosestMilestone | null {
  // Filter for achievements that are not yet unlocked and have progress
  const inProgress = achievements.filter(
    (a) => !a.unlocked && a.progress > 0 && a.target > 0,
  );

  if (inProgress.length === 0) return null;

  // Calculate percentage complete for each
  const withPercent = inProgress.map((a) => ({
    ...a,
    percentComplete: (a.progress / a.target) * 100,
    remaining: a.target - a.progress,
  }));

  // Find the one closest to completion (within 20%)
  const closeToCompletion = withPercent.filter((a) => a.percentComplete >= 80);

  if (closeToCompletion.length === 0) return null;

  // Sort by closest to completion
  closeToCompletion.sort((a, b) => b.percentComplete - a.percentComplete);

  const closest = closeToCompletion[0];

  return {
    name: closest.name,
    progress: closest.progress,
    target: closest.target,
    remaining: closest.remaining,
    percentComplete: closest.percentComplete,
  };
}

export function MilestoneProgress({
  achievements,
  isLoading = false,
}: MilestoneProgressProps) {
  const milestone = useMemo(() => {
    if (!achievements || achievements.length === 0) return null;
    return findClosestMilestone(achievements);
  }, [achievements]);

  // Don't render if loading, no achievements, or no close milestones
  if (isLoading || !milestone) {
    return null;
  }

  const progressWidth = Math.min(milestone.percentComplete, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="border-2 border-cyan/30 hover:border-cyan rounded-lg p-4 hover:shadow-cyan-glow transition-all bg-dark-surface"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-cyan text-sm font-medium font-mono uppercase tracking-wider">
            Milestone
          </span>
          <span className="text-text-muted font-mono text-xs">
            {milestone.remaining} to go
          </span>
        </div>

        <p className="text-text-primary font-mono text-sm">
          {milestone.remaining} cards to "{milestone.name}"
        </p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-dark-lighter rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressWidth}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-cyan to-cyan/70 rounded-full"
            style={{
              boxShadow: "0 0 8px rgba(0,217,255,0.4)",
            }}
          />
        </div>

        <div className="flex justify-between text-text-muted/60 font-mono text-xs">
          <span>{milestone.progress}</span>
          <span>{milestone.target}</span>
        </div>
      </div>
    </motion.div>
  );
}
