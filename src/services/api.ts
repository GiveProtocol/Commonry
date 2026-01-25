/**
 * API Service for backend communication
 */

import type {
  StartReviewEventPayload,
  StartReviewEventResponse,
  InteractionPayload,
  InteractionResponse,
  CompleteReviewEventPayload,
  CompleteReviewEventResponse,
} from "../types/review-events";

import type {
  StartSessionPayload,
  StartSessionResponse,
  HeartbeatPayload,
  HeartbeatResponse,
  BreakPayload,
  BreakResponse,
  CompleteSessionPayload,
  CompleteSessionResponse,
  StudySessionRecord,
} from "../types/study-sessions";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Debug: Log the API URL being used
console.log("[API Service] Using API URL:", API_BASE_URL);
console.log(
  "[API Service] VITE_API_URL env var:",
  import.meta.env.VITE_API_URL,
);

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Service for making HTTP requests to the backend API, handling authentication tokens and response parsing.
 */
class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage
    this.token = localStorage.getItem("auth_token");
  }

  /**
   * Sets the authentication token and updates localStorage.
   * @param token - The token string or null to clear it.
   */
  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  /**
   * Retrieves the current authentication token.
   * @returns The stored token or null if not set.
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Sends an HTTP request to the specified endpoint.
   * @template T - The expected response data type.
   * @param endpoint - The API endpoint path.
   * @param options - Request initialization options.
   * @returns A promise resolving to the API response containing data or error.
   */
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
      return {
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  // ==================== AUTH ENDPOINTS ====================

  /**
   * Logs in a user with provided credentials.
   * @param username - The user's username.
   * @param password - The user's password.
   * @returns A promise resolving to the API response with user data and token.
   */
  async login(username: string, password: string) {
    return this.request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * Retrieves the currently authenticated user's information.
   * @returns A promise resolving to the API response with user data.
   */
  async getCurrentUser() {
    return this.request<{ user: User }>("/api/auth/me");
  }

  /**
   * Registers a new user.
   * @param username - The desired username.
   * @param email - The user's email address.
   * @param password - The user's password.
   * @param displayName - Optional display name.
   * @returns A promise resolving to the API response with user data and token.
   */
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

  // ==================== ANALYTICS ENDPOINTS ====================

  /**
   * Fetches the analytics learning profile for a user.
   * @param userId - The ID of the user.
   * @returns A promise resolving to the user's learning profile.
   */
  async getAnalyticsProfile(userId: string) {
    return this.request<AnalyticsProfile>(
      `/api/analytics/users/${userId}/profile`,
    );
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

  /**
   * Records multiple study sessions in a batch.
   * @param sessions - Array of study session objects to record.
   * @returns A promise resolving to the API response with success status and count.
   */
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

  // ==================== REVIEW EVENTS LIFECYCLE ENDPOINTS ====================

  /**
   * Starts a new review event when a card is shown.
   * @param payload - Initial event data with card/device/session context.
   * @returns Promise with event ID and server timestamp.
   */
  async startReviewEvent(payload: StartReviewEventPayload) {
    return this.request<StartReviewEventResponse>(
      "/api/reviews/events/start",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Appends interaction data to an in-progress review.
   * @param eventId - The review event ID.
   * @param payload - Interaction events to append.
   * @param async - If true, uses fire-and-forget mode.
   * @returns Promise with interaction count.
   */
  async recordReviewInteraction(
    eventId: string,
    payload: InteractionPayload,
    async = false,
  ) {
    const url = `/api/reviews/events/${eventId}/interaction${async ? "?async=true" : ""}`;
    return this.request<InteractionResponse>(url, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Completes a review event with final outcome data.
   * @param eventId - The review event ID.
   * @param payload - Completion data including rating and timing.
   * @returns Promise with completion confirmation.
   */
  async completeReviewEvent(eventId: string, payload: CompleteReviewEventPayload) {
    return this.request<CompleteReviewEventResponse>(
      `/api/reviews/events/${eventId}/complete`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Records a complete review event in a single request.
   * Use when streaming isn't available or for backwards compatibility.
   * @param payload - Complete event payload.
   * @returns Promise with event details.
   */
  async recordCompleteReviewEvent(payload: CompleteReviewEventPayload & StartReviewEventPayload) {
    return this.request<{
      success: boolean;
      eventId: string;
      serverReceivedAt: string;
      completedAt: string;
      wasCorrect: boolean;
    }>("/api/reviews/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Records multiple complete review events in a batch.
   * @param events - Array of complete event payloads.
   * @returns Promise with batch results.
   */
  async recordReviewEventsBatch(
    events: Array<CompleteReviewEventPayload & StartReviewEventPayload>,
  ) {
    return this.request<{
      success: boolean;
      total: number;
      successCount: number;
      errorCount: number;
      events: Array<{ success: boolean; eventId?: string; error?: string }>;
    }>("/api/reviews/events/batch", {
      method: "POST",
      body: JSON.stringify({ events }),
    });
  }

  // ==================== STUDY SESSION LIFECYCLE ENDPOINTS ====================

  /**
   * Starts a new study session when user enters review mode.
   * @param payload - Session configuration with device/time context.
   * @returns Promise with session ID and server timestamp.
   */
  async startStudySession(payload: StartSessionPayload) {
    return this.request<StartSessionResponse>("/api/sessions/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Sends a heartbeat to keep the session alive.
   * Called every 30 seconds during active study.
   * @param sessionId - The session ID.
   * @param payload - Heartbeat data with incremental counts.
   * @returns Promise with heartbeat confirmation.
   */
  async sendSessionHeartbeat(sessionId: string, payload: HeartbeatPayload = {}) {
    return this.request<HeartbeatResponse>(
      `/api/sessions/${sessionId}/heartbeat`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Records a break start or end during a session.
   * @param sessionId - The session ID.
   * @param payload - Break action and reason.
   * @returns Promise with break confirmation.
   */
  async recordSessionBreak(sessionId: string, payload: BreakPayload) {
    return this.request<BreakResponse>(`/api/sessions/${sessionId}/break`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Completes a study session with final statistics.
   * @param sessionId - The session ID.
   * @param payload - Completion data with final counts and state.
   * @returns Promise with session statistics.
   */
  async completeStudySession(sessionId: string, payload: CompleteSessionPayload) {
    return this.request<CompleteSessionResponse>(
      `/api/sessions/${sessionId}/complete`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Gets the current active session for the user (if any).
   * @returns Promise with active session or null.
   */
  async getActiveSession() {
    return this.request<{ success: boolean; session: StudySessionRecord | null }>(
      "/api/sessions/active",
    );
  }

  /**
   * Gets a specific session by ID.
   * @param sessionId - The session ID.
   * @returns Promise with session details.
   */
  async getSession(sessionId: string) {
    return this.request<{ success: boolean; session: StudySessionRecord }>(
      `/api/sessions/${sessionId}`,
    );
  }

  /**
   * Gets recent sessions for the user.
   * @param limit - Maximum number of sessions to return (default: 10, max: 50).
   * @returns Promise with sessions array.
   */
  async getRecentSessions(limit = 10) {
    return this.request<{ success: boolean; sessions: StudySessionRecord[] }>(
      `/api/sessions/recent?limit=${Math.min(limit, 50)}`,
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

  /**
   * Fetches daily statistics for a user within an optional date range.
   * @param userId - The ID of the user to fetch statistics for.
   * @param startDate - Optional start date (ISO string) to filter the statistics.
   * @param endDate - Optional end date (ISO string) to filter the statistics.
   * @returns A promise resolving to an object containing an array of daily statistics.
   */
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

  /**
   * Retrieves the rank of a user for a specific leaderboard metric.
   *
   * @param userId - The unique identifier of the user.
   * @param metric - The leaderboard metric to query.
   * @returns A promise resolving to an object containing the metric name, the user's rank (or null if unavailable), and the metric value.
   */
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

  /**
   * Updates the user's profile.
   *
   * @param {Object} profile - The profile fields to update.
   * @param {string} [profile.displayName] - The user's display name.
   * @param {string} [profile.bio] - The user's biography.
   * @param {string} [profile.pronouns] - The user's pronouns.
   * @param {string} [profile.location] - The user's location.
   * @param {string} [profile.avatarUrl] - The URL of the user's avatar.
   * @param {string[]} [profile.learningTopics] - The list of topics the user is learning.
   * @returns {Promise<{ profile: UserProfile }>} The updated user profile.
   */
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

  /**
   * Retrieves profile statistics for a given user.
   * @param username - The username of the profile to fetch stats for.
   * @returns A Promise resolving with an object containing profile statistics.
   */
  async getProfileStats(username: string) {
    return this.request<{ stats: ProfileStatistics }>(
      `/api/profile/${username}/stats`,
    );
  }

  /**
   * Retrieves the privacy settings for a given user.
   * @param username - The username whose privacy settings to fetch.
   * @returns A promise resolving to an object containing the user's privacy settings.
   */
  async getPrivacySettings(username: string) {
    return this.request<{ privacy: PrivacySettings }>(
      `/api/profile/${username}/privacy`,
    );
  }

  /**
   * Updates the user's privacy settings by sending a PUT request to the profile privacy endpoint.
   *
   * @param settings Partial<PrivacySettings> object containing the fields to update.
   * @returns A promise that resolves with an object containing the updated privacy settings.
   */
  async updatePrivacySettings(settings: Partial<PrivacySettings>) {
    return this.request<{ privacy: PrivacySettings }>("/api/profile/privacy", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  /**
   * Retrieves achievements from the API.
   *
   * @returns {Promise<{ achievements: Achievement[] }>} A promise that resolves with achievements data.
   */
  async getAchievements() {
    return this.request<{ achievements: Achievement[] }>("/api/achievements");
  }

  /**
   * Retrieves the achievements for a given user.
   * @param username - The username of the profile to fetch achievements for.
   * @returns A promise resolving to an object containing the user's achievements.
   */
  async getUserAchievements(username: string) {
    return this.request<{ achievements: UserAchievement[] }>(
      `/api/profile/${username}/achievements`,
    );
  }

  /**
   * Follows a user with the given username.
   *
   * @param username - The username of the user to follow.
   * @returns Promise<{ success: boolean; follow: unknown }> - The API response indicating success and follow data.
   */
  async followUser(username: string) {
    return this.request<{ success: boolean; follow: unknown }>(
      `/api/profile/follow/${username}`,
      {
        method: "POST",
      },
    );
  }

  /**
   * Unfollows a user by removing the follow relationship.
   *
   * @param username - The username of the user to unfollow.
   * @returns A promise that resolves with an object indicating success.
   */
  async unfollowUser(username: string) {
    return this.request<{ success: boolean }>(
      `/api/profile/follow/${username}`,
      {
        method: "DELETE",
      },
    );
  }

  /**
   * Retrieves followers for a user by username.
   * @param {string} username - The username for which to fetch followers.
   * @returns {Promise<{ followers: FollowUser[] }>} A promise resolving to an object containing an array of followers.
   */
  async getFollowers(username: string) {
    return this.request<{ followers: FollowUser[] }>(
      `/api/profile/${username}/followers`,
    );
  }

  /**
   * Retrieves the list of users that the specified user is following.
   * @param username - The username of the user whose following list is to be fetched.
   * @returns A promise resolving to an object containing the following array of FollowUser.
   */
  async getFollowing(username: string) {
    return this.request<{ following: FollowUser[] }>(
      `/api/profile/${username}/following`,
    );
  }

  // ==================== BROWSE ENDPOINTS (The Commons) ====================

  /**
   * Fetches all categories with deck counts.
   * @returns A promise resolving to an array of categories.
   */
  async getCategories() {
    return this.request<BrowseCategory[]>("/api/browse/categories");
  }

  /**
   * Fetches decks in a category with sorting and filtering.
   * @param slug - The category slug.
   * @param options - Sorting and filtering options.
   * @returns A promise resolving to category details and deck list.
   */
  async getCategoryDecks(
    slug: string,
    options: {
      sort?: string;
      tags?: string[];
      page?: number;
      limit?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (options.sort) params.append("sort", options.sort);
    if (options.tags && options.tags.length > 0) {
      params.append("tags", options.tags.join(","));
    }
    if (options.page) params.append("page", options.page.toString());
    if (options.limit) params.append("limit", options.limit.toString());

    const queryString = params.toString();
    return this.request<CategoryDecksResponse>(
      `/api/browse/categories/${slug}${queryString ? `?${queryString}` : ""}`,
    );
  }

  /**
   * Fetches featured decks, optionally filtered by category.
   * @param categorySlug - Optional category slug to filter by.
   * @returns A promise resolving to an array of featured decks.
   */
  async getFeaturedDecks(categorySlug?: string) {
    const params = new URLSearchParams();
    if (categorySlug) params.append("categorySlug", categorySlug);
    const queryString = params.toString();
    return this.request<BrowseDeck[]>(
      `/api/browse/featured${queryString ? `?${queryString}` : ""}`,
    );
  }

  /**
   * Fetches details for a public deck.
   * @param deckId - The deck ID.
   * @returns A promise resolving to the deck details.
   */
  async getPublicDeck(deckId: string) {
    return this.request<BrowseDeckDetail>(`/api/browse/decks/${deckId}`);
  }

  /**
   * Publishes a deck to The Commons.
   * @param deckId - The deck ID.
   * @param categoryId - The primary category ID.
   * @param tags - Optional array of tag names.
   * @returns A promise resolving to success status.
   */
  async publishDeck(deckId: string, categoryId: string, tags: string[] = []) {
    return this.request<{ success: boolean; message: string }>(
      `/api/decks/${deckId}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ categoryId, tags }),
      },
    );
  }

  /**
   * Subscribes to a public deck.
   * @param deckId - The deck ID.
   * @returns A promise resolving to success status.
   */
  async subscribeToDeck(deckId: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/decks/${deckId}/subscribe`,
      {
        method: "POST",
      },
    );
  }

  /**
   * Unsubscribes from a public deck.
   * @param deckId - The deck ID.
   * @returns A promise resolving to success status.
   */
  async unsubscribeFromDeck(deckId: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/decks/${deckId}/subscribe`,
      {
        method: "DELETE",
      },
    );
  }

  /**
   * Checks if the current user is subscribed to a deck.
   * @param deckId - The deck ID.
   * @returns A promise resolving to subscription status.
   */
  async checkSubscription(deckId: string) {
    return this.request<{ isSubscribed: boolean }>(
      `/api/decks/${deckId}/subscription`,
    );
  }

  /**
   * Flags a deck for inappropriate content.
   * @param deckId - The deck ID.
   * @param reason - The reason for flagging.
   * @returns A promise resolving to success status.
   */
  async flagDeck(deckId: string, reason: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/decks/${deckId}/flag`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
  }

  /**
   * Fetches the current user's subscribed decks.
   * @returns A promise resolving to an array of subscribed decks.
   */
  async getSubscribedDecks() {
    return this.request<BrowseDeck[]>("/api/browse/subscriptions");
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
  topSubjects: unknown[];
  globalRank?: number;
  optedIntoLeaderboard: boolean;
}

export interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  category: string;
  badgeIcon: string;
  criteria: unknown;
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
  criteria: unknown;
  rarity: string;
}

export interface FollowUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  followedAt: string;
}

// ==================== ANALYTICS TYPES ====================

export interface AnalyticsProfile {
  velocity: {
    currentWeekMastered: number;
    newCardsLearned: number;
    totalReviews: number;
    trend: 'accelerating' | 'stable' | 'decelerating' | null;
    rolling4WeekAvg: number;
    monthOverMonthChangePct: number | null;
  } | null;
  patterns: {
    preferredHour: number | null;
    preferredDay: string | null;
    activeHours: number[];
    avgSessionMinutes: number;
    avgCardsPerSession: number;
    consistencyRatio: number;
    totalStudyDays: number;
    totalSessions: number;
    sessionStyle: string | null;
    learnerType: string | null;
    deviceBreakdown: {
      mobile: number;
      desktop: number;
      tablet: number;
    };
  } | null;
  struggleMetrics: {
    totalStrugglingCards: number;
    highFailRateCards: number;
    repeatedLapseCards: number;
    gettingWorseCards: number;
    slowRecallCards: number;
    avgStruggleScore: number | null;
  };
}

// ==================== BROWSE TYPES ====================

export interface BrowseCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconEmoji?: string;
  displayOrder: number;
  deckCount: number;
}

export interface BrowseAuthor {
  username: string;
  displayName?: string;
}

export interface BrowseTag {
  id: string;
  name: string;
  slug: string;
  usageCount?: number;
}

export interface BrowseDeck {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  subscriberCount: number;
  averageRating?: number;
  lastActivityAt?: string;
  createdAt: string;
  trendingScore?: number;
  isFeatured: boolean;
  author: BrowseAuthor;
  isSubscribed?: boolean;
}

export interface BrowseDeckDetail extends BrowseDeck {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  }>;
  tags: BrowseTag[];
  sampleCards: Array<{
    id: string;
    frontContent: unknown;
    backContent: unknown;
  }>;
}

export interface CategoryDecksResponse {
  category: BrowseCategory;
  decks: BrowseDeck[];
  tags: BrowseTag[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Export singleton instance
export const api = new ApiService(API_BASE_URL);
