/**
 * API Service for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Request failed", ...data };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Network error" };
    }
  }

  // ==================== AUTH ENDPOINTS ====================

  async signup(
    username: string,
    email: string,
    password: string,
    displayName?: string,
  ) {
    return this.request<{ user: User; token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, email, password, displayName }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser() {
    return this.request<{ user: User }>("/api/auth/me");
  }

  // ==================== STUDY SESSION ENDPOINTS ====================

  async recordStudySession(session: {
    cardId: string;
    timeSpentMs: number;
    rating: number;
    difficultyRating?: number;
  }) {
    return this.request<{ success: boolean; session: StudySession }>(
      "/api/study-sessions",
      {
        method: "POST",
        body: JSON.stringify(session),
      },
    );
  }

  async recordStudySessionsBatch(
    sessions: Array<{
      cardId: string;
      timeSpentMs: number;
      rating: number;
      difficultyRating?: number;
    }>,
  ) {
    return this.request<{ success: boolean; count: number }>(
      "/api/study-sessions/batch",
      {
        method: "POST",
        body: JSON.stringify({ sessions }),
      },
    );
  }

  // ==================== STATISTICS ENDPOINTS ====================

  async getUserStatistics(
    userId: string,
    period: "today" | "week" | "month" | "all" = "all",
  ) {
    return this.request<{ stats: UserStatistics }>(
      `/api/statistics/user/${userId}?period=${period}`,
    );
  }

  async getDailyStatistics(
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    return this.request<{ dailyStats: DailyStatistics[] }>(
      `/api/statistics/daily/${userId}?${params.toString()}`,
    );
  }

  async getUserRank(userId: string, metric: LeaderboardMetric) {
    return this.request<{ metric: string; rank: number | null; value: number }>(
      `/api/statistics/rank/${userId}/${metric}`,
    );
  }

  // ==================== LEADERBOARD ENDPOINTS ====================

  async getLeaderboard(metric: LeaderboardMetric, limit = 100) {
    return this.request<{ metric: string; leaderboard: LeaderboardEntry[] }>(
      `/api/leaderboard/${metric}?limit=${limit}`,
    );
  }

  // ==================== PROFILE ENDPOINTS ====================

  async getProfile(username: string) {
    return this.request<{ profile: UserProfile; privacy: PrivacySettings }>(
      `/api/profile/${username}`,
    );
  }

  async updateProfile(profile: {
    displayName?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    avatarUrl?: string;
    learningTopics?: string[];
  }) {
    return this.request<{ profile: UserProfile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  }

  async getProfileStats(username: string) {
    return this.request<{ stats: ProfileStatistics }>(
      `/api/profile/${username}/stats`,
    );
  }

  async getPrivacySettings(username: string) {
    return this.request<{ privacy: PrivacySettings }>(
      `/api/profile/${username}/privacy`,
    );
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>) {
    return this.request<{ privacy: PrivacySettings }>("/api/profile/privacy", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async getAchievements() {
    return this.request<{ achievements: Achievement[] }>("/api/achievements");
  }

  async getUserAchievements(username: string) {
    return this.request<{ achievements: UserAchievement[] }>(
      `/api/profile/${username}/achievements`,
    );
  }

  async followUser(username: string) {
    return this.request<{ success: boolean; follow: any }>(
      `/api/profile/follow/${username}`,
      {
        method: "POST",
      },
    );
  }

  async unfollowUser(username: string) {
    return this.request<{ success: boolean }>(
      `/api/profile/follow/${username}`,
      {
        method: "DELETE",
      },
    );
  }

  async getFollowers(username: string) {
    return this.request<{ followers: FollowUser[] }>(
      `/api/profile/${username}/followers`,
    );
  }

  async getFollowing(username: string) {
    return this.request<{ following: FollowUser[] }>(
      `/api/profile/${username}/following`,
    );
  }
}

// ==================== TYPES ====================

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface StudySession {
  session_id: string;
  studied_at: string;
  was_correct: boolean;
}

export interface UserStatistics {
  cards_studied?: number;
  total_cards_studied?: number;
  unique_cards?: number;
  total_time_ms?: number;
  correct_answers?: number;
  total_correct?: number;
  total_answers?: number;
  total_attempts?: number;
  retention_rate: number;
  current_streak?: number;
  longest_streak?: number;
  last_study_date?: string;
}

export interface DailyStatistics {
  date: string;
  cards_studied: number;
  unique_cards: number;
  total_time_ms: number;
  correct_answers: number;
  total_answers: number;
  retention_rate: number;
}

export type LeaderboardMetric =
  | "total_cards"
  | "total_time"
  | "retention_rate"
  | "current_streak";

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  value: number;
  updated_at: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  pronouns?: string;
  location?: string;
  avatarUrl?: string;
  learningTopics?: string[];
  memberSince: string;
}

export interface PrivacySettings {
  settingId: string;
  userId: string;
  privacyPreset: string;
  showStatistics: boolean;
  showDecks: boolean;
  showForumActivity: boolean;
  showFollowers: boolean;
  showAchievements: boolean;
  showGoals: boolean;
}

export interface ProfileStatistics {
  statId: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: string;
  totalStudyDays: number;
  totalCardsReviewed: number;
  totalCardsMastered: number;
  activeDecksCount: number;
  newCardsThisWeek: number;
  newCardsThisMonth: number;
  totalStudyTimeMs: number;
  averageSessionTimeMs: number;
  topSubjects: any[];
  globalRank?: number;
  optedIntoLeaderboard: boolean;
}

export interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  category: string;
  badgeIcon: string;
  criteria: any;
  displayOrder: number;
  rarity: string;
}

export interface UserAchievement {
  userAchievementId: string;
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: string;
  achievementId: string;
  name: string;
  description: string;
  category: string;
  badgeIcon: string;
  criteria: any;
  rarity: string;
}

export interface FollowUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  followedAt: string;
}

// Export singleton instance
export const api = new ApiService(API_BASE_URL);
