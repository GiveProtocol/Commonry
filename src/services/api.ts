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
        return { error: data.error || "Request failed" };
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

// Export singleton instance
export const api = new ApiService(API_BASE_URL);
