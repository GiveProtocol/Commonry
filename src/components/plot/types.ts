import { AnalyticsProfile, UserAchievement } from "../../services/api";
import { DeckId } from "../../types/ids";

export interface PlotData {
  // Local DB (fast)
  totalDueCards: number;
  deckWithMostDue: {
    deckId: DeckId;
    name: string;
    dueCount: number;
  } | null;

  // From /api/statistics/user/:userId
  statistics: {
    currentStreak: number;
    lastStudyDate: string | null;
    cardsStudiedThisWeek: number;
  } | null;

  // From /api/analytics/users/:userId/profile
  analyticsProfile: AnalyticsProfile | null;

  // User's achievements for milestone progress
  achievements: UserAchievement[] | null;

  // Loading states
  isLoading: boolean;
  isLocalDataLoaded: boolean;
}

export interface DeckDueInfo {
  deckId: DeckId;
  name: string;
  dueCount: number;
}

export interface WeekDay {
  date: Date;
  studied: boolean;
  isToday: boolean;
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface GreetingContext {
  timeOfDay: TimeOfDay;
  userName: string;
  currentStreak: number;
  lastStudyDate: string | null;
  isNewUser: boolean;
}

export interface InsightData {
  weeklyMastered: number;
  preferredHour: number | null;
  sessionStyle: string | null;
  learnerType: string | null;
  trend: string | null;
}

export type InsightType =
  | "weekly_mastery"
  | "optimal_time"
  | "session_style"
  | "learner_type";

export interface Insight {
  type: InsightType;
  message: string;
  icon?: string;
}
