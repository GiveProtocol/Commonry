import { TimeOfDay, GreetingContext } from "../types";

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getGreeting(timeOfDay: TimeOfDay, name: string): string {
  const firstName = name.split(" ")[0];

  switch (timeOfDay) {
    case "morning":
      return `Good morning, ${firstName}!`;
    case "afternoon":
      return `Good afternoon, ${firstName}!`;
    case "evening":
      return `Good evening, ${firstName}!`;
    case "night":
      return `Burning the midnight oil, ${firstName}?`;
  }
}

export function getSubMessage(context: GreetingContext): string {
  const { currentStreak, lastStudyDate, isNewUser } = context;

  // New user
  if (isNewUser) {
    return "Ready to start your learning journey?";
  }

  // Returning after a break (no study in last 3+ days)
  if (lastStudyDate) {
    const daysSinceLastStudy = getDaysSince(lastStudyDate);
    if (daysSinceLastStudy >= 3) {
      return "Welcome back! Let's ease back in.";
    }
  }

  // Milestone streaks
  if (currentStreak === 7) {
    return "7 days strong! That's dedication.";
  }
  if (currentStreak === 14) {
    return "14 days strong! You're on fire.";
  }
  if (currentStreak === 30) {
    return "30 days strong! Incredible consistency.";
  }
  if (currentStreak === 60) {
    return "60 days! You're unstoppable.";
  }
  if (currentStreak === 100) {
    return "100 days! Legendary commitment.";
  }

  // Active streak (general)
  if (currentStreak > 0) {
    return "Keep that momentum going!";
  }

  // No streak, but has studied before
  if (lastStudyDate) {
    return "Ready to start fresh today?";
  }

  // Default fallback
  return "Let's grow some knowledge today.";
}

function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function isNewUser(
  lastStudyDate: string | null,
  cardsStudied: number,
): boolean {
  return !lastStudyDate && cardsStudied === 0;
}
