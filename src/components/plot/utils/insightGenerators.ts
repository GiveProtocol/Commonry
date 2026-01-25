import { InsightData, Insight, InsightType } from "../types";

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function getSessionStyleMessage(style: string): string | null {
  switch (style) {
    case "quick_bursts":
      return "Your quick burst sessions are effective!";
    case "focused_deep":
      return "Your focused sessions are paying off.";
    case "marathon":
      return "You thrive in longer study sessions.";
    case "balanced":
      return "Your balanced approach is working well.";
    default:
      return null;
  }
}

function getLearnerTypeMessage(type: string): string | null {
  switch (type) {
    case "consistent":
      return "Consistency is your superpower.";
    case "intensive":
      return "You excel with intensive practice.";
    case "sporadic":
      return "Every session counts, keep it up!";
    case "weekend_warrior":
      return "Your weekend dedication is admirable.";
    default:
      return null;
  }
}

export function generateInsights(data: InsightData): Insight[] {
  const insights: Insight[] = [];

  // Weekly mastery insight
  if (data.weeklyMastered > 0) {
    insights.push({
      type: "weekly_mastery",
      message: `You've mastered ${data.weeklyMastered} cards this week!`,
    });
  }

  // Optimal time insight
  if (data.preferredHour !== null) {
    insights.push({
      type: "optimal_time",
      message: `You seem to study best around ${formatHour(data.preferredHour)}.`,
    });
  }

  // Session style insight
  if (data.sessionStyle) {
    const message = getSessionStyleMessage(data.sessionStyle);
    if (message) {
      insights.push({
        type: "session_style",
        message,
      });
    }
  }

  // Learner type insight
  if (data.learnerType) {
    const message = getLearnerTypeMessage(data.learnerType);
    if (message) {
      insights.push({
        type: "learner_type",
        message,
      });
    }
  }

  return insights;
}

export function getDailyInsight(
  insights: Insight[],
  dayOfYear: number,
): Insight | null {
  if (insights.length === 0) return null;

  // Rotate insights based on day of year
  // Priority: weekly_mastery > optimal_time > session_style > learner_type
  const priorityOrder: InsightType[] = [
    "weekly_mastery",
    "optimal_time",
    "session_style",
    "learner_type",
  ];

  // Sort by priority
  const sorted = [...insights].sort((a, b) => {
    return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
  });

  // Cycle through available insights based on day
  const index = dayOfYear % sorted.length;
  return sorted[index];
}

export function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
