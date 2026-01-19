/**
 * Study Session Types
 *
 * Type definitions for robust session tracking with heartbeat mechanism,
 * break tracking, and session-level analytics.
 *
 * Naming conventions:
 * - *Payload: Data sent from client to server
 * - *Response: Data returned from server to client
 * - *Record: Complete database record
 * - Client*: Client-side state
 */

import type { StudySessionId, UserId, DeckId } from "./ids";

// ============================================================
// ENUMS (match database)
// ============================================================

export type SessionType =
  | "regular"
  | "diagnostic"
  | "cram"
  | "speed_review"
  | "learn_new";
export type SessionState =
  | "in_progress"
  | "completed"
  | "abandoned"
  | "interrupted";
export type BreakReason = "background" | "pause" | "idle" | "manual";

// ============================================================
// JSONB COLUMN TYPES
// ============================================================

/**
 * A break period during a study session
 */
export interface SessionBreak {
  startMs: number; // Relative to session start
  endMs: number | null; // Null if break is ongoing
  reason: BreakReason;
}

/**
 * Response time trend analysis (linear regression)
 */
export interface ResponseTimeTrend {
  slope: number; // Negative = getting faster, positive = slowing down
  rSquared: number; // Goodness of fit (0-1)
  sampleCount: number; // Number of data points
}

/**
 * Difficulty distribution breakdown
 */
export interface DifficultyDistribution {
  new: number; // Percentage (0-1)
  learning: number;
  review: number;
  relearning: number;
}

// ============================================================
// API PAYLOADS - What the client sends
// ============================================================

/**
 * Payload for POST /api/sessions/start
 * Sent when user enters review mode
 */
export interface StartSessionPayload {
  // Client can pre-generate the session ID
  sessionId?: StudySessionId;

  // Session configuration
  sessionType: SessionType;
  deckId?: DeckId;
  cardsPlanned?: number;
  targetDurationMinutes?: number;

  // Device context (captured once at start)
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  clientVersion: string;
  platform: string;
  userAgent?: string;

  // Time context
  localHour: number;
  localDayOfWeek: number;
  timezoneOffsetMinutes: number;
}

/**
 * Payload for POST /api/sessions/:id/heartbeat
 * Sent every 30 seconds to indicate session is still active
 */
export interface HeartbeatPayload {
  // Incremental updates since last heartbeat
  cardsCompletedSinceLastBeat?: number;
  cardsCorrectSinceLastBeat?: number;

  // Current break status
  currentBreak?: SessionBreak | null;
  isBackgrounded?: boolean;
}

/**
 * Payload for POST /api/sessions/:id/break
 * Sent when user pauses or resumes
 */
export interface BreakPayload {
  action: "start" | "end";
  reason: BreakReason;
  timestampMs?: number; // Relative to session start
}

/**
 * Payload for POST /api/sessions/:id/complete
 * Sent when user finishes or closes the session
 */
export interface CompleteSessionPayload {
  finalState: "completed" | "interrupted";

  // Final counts (in case heartbeats were missed)
  cardsCompleted?: number;
  cardsCorrect?: number;
  cardsAgain?: number;
  cardsHard?: number;
  cardsGood?: number;
  cardsEasy?: number;
  newCardsCompleted?: number;
  reviewCardsCompleted?: number;

  // Break data
  breaks?: SessionBreak[];
  totalBreakTimeMs?: number;

  // Total active time (excluding breaks)
  totalActiveTimeMs?: number;

  // Response times for trend calculation
  responseTimes?: number[];
}

// ============================================================
// API RESPONSES - What the server returns
// ============================================================

export interface StartSessionResponse {
  success: true;
  sessionId: StudySessionId;
  serverStartedAt: string;
}

export interface HeartbeatResponse {
  success: true;
  sessionId: StudySessionId;
  heartbeatReceivedAt: string;
}

export interface BreakResponse {
  success: true;
  sessionId: StudySessionId;
}

export interface CompleteSessionResponse {
  success: true;
  sessionId: StudySessionId;
  finalState: SessionState;
  statistics: SessionStatistics;
}

export interface SessionErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type SessionResponse<T> = T | SessionErrorResponse;

// ============================================================
// SESSION STATISTICS (computed on close)
// ============================================================

export interface SessionStatistics {
  cardsCompleted: number;
  cardsCorrect: number;
  accuracyRate: number | null;
  avgResponseTimeMs: number | null;
  medianResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  responseTimeTrend: ResponseTimeTrend | null;
  fatigueScore: number | null;
  difficultyDistribution: DifficultyDistribution | null;
  totalActiveTimeMs: number;
  totalBreakTimeMs: number;
}

// ============================================================
// FULL SESSION RECORD (database entity)
// ============================================================

export interface StudySessionRecord {
  sessionId: StudySessionId;
  userId: UserId;

  // Timing
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  totalActiveTimeMs: number;

  // Configuration
  sessionType: SessionType;
  deckId: DeckId | null;
  cardsPlanned: number | null;
  targetDurationMinutes: number | null;

  // Device context
  deviceType: string;
  clientVersion: string | null;
  platform: string | null;
  userAgent: string | null;
  localHourStarted: number | null;
  localDayOfWeek: number | null;
  timezoneOffsetMinutes: number | null;

  // Progress
  cardsCompleted: number;
  cardsCorrect: number;
  cardsAgain: number;
  cardsHard: number;
  cardsGood: number;
  cardsEasy: number;
  newCardsCompleted: number;
  reviewCardsCompleted: number;

  // Breaks
  breaks: SessionBreak[];
  totalBreakTimeMs: number;

  // Final state & statistics
  finalState: SessionState;
  accuracyRate: number | null;
  avgResponseTimeMs: number | null;
  medianResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  responseTimeTrend: ResponseTimeTrend | null;
  fatigueScore: number | null;
  difficultyDistribution: DifficultyDistribution | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CLIENT-SIDE STATE
// ============================================================

/**
 * Client-side session state tracked by SessionContext
 */
export interface ClientSessionState {
  sessionId: StudySessionId;
  startedAt: number; // Date.now() timestamp

  // Running totals
  cardsCompleted: number;
  cardsCorrect: number;
  cardsByRating: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  newCardsCompleted: number;
  reviewCardsCompleted: number;

  // Timing
  responseTimes: number[]; // For trend calculation
  totalActiveTimeMs: number;
  lastCardCompletedAt: number;

  // Break tracking
  breaks: SessionBreak[];
  currentBreak: SessionBreak | null;
  totalBreakTimeMs: number;

  // Status
  isActive: boolean;
  isPaused: boolean;
  isBackgrounded: boolean;

  // Heartbeat
  lastHeartbeatSentAt: number;
}

/**
 * Session configuration passed to startSession
 */
export interface SessionConfig {
  sessionType: SessionType;
  deckId?: DeckId;
  cardsPlanned?: number;
  targetDurationMinutes?: number;
}

/**
 * Quick session stats for UI display
 */
export interface SessionStats {
  cardsCompleted: number;
  cardsCorrect: number;
  accuracy: number;
  elapsedTimeMs: number;
  averageResponseTimeMs: number;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Type guard to check if a response is an error
 */
export function isSessionErrorResponse(
  response: SessionResponse<unknown>,
): response is SessionErrorResponse {
  return (response as SessionErrorResponse).success === false;
}

/**
 * Calculate linear regression for response time trend
 */
export function calculateResponseTimeTrend(
  responseTimes: number[],
): ResponseTimeTrend | null {
  if (responseTimes.length < 3) return null;

  const n = responseTimes.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = responseTimes[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  let ssTotal = 0;
  let ssResidual = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssTotal += (responseTimes[i] - meanY) ** 2;
    ssResidual += (responseTimes[i] - predicted) ** 2;
  }

  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return {
    slope,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    sampleCount: n,
  };
}

/**
 * Calculate fatigue score from response times and accuracy
 */
export function calculateFatigueScore(
  responseTimes: number[],
  correctAnswers: boolean[],
): number {
  if (responseTimes.length < 5) return 0;

  // Split into first half and second half
  const midpoint = Math.floor(responseTimes.length / 2);

  const firstHalfTimes = responseTimes.slice(0, midpoint);
  const secondHalfTimes = responseTimes.slice(midpoint);

  const firstHalfCorrect = correctAnswers.slice(0, midpoint);
  const secondHalfCorrect = correctAnswers.slice(midpoint);

  // Average response times
  const avgFirst =
    firstHalfTimes.reduce((a, b) => a + b, 0) / firstHalfTimes.length;
  const avgSecond =
    secondHalfTimes.reduce((a, b) => a + b, 0) / secondHalfTimes.length;

  // Accuracy rates
  const accFirst =
    firstHalfCorrect.filter(Boolean).length / firstHalfCorrect.length;
  const accSecond =
    secondHalfCorrect.filter(Boolean).length / secondHalfCorrect.length;

  // Fatigue indicators:
  // 1. Response time increase (slowing down)
  const timeSlowdown =
    avgFirst > 0 ? Math.max(0, (avgSecond - avgFirst) / avgFirst) : 0;

  // 2. Accuracy decline
  const accuracyDecline = Math.max(0, accFirst - accSecond);

  // Combined fatigue score (weighted average, capped at 1.0)
  const fatigueScore = Math.min(1, timeSlowdown * 0.6 + accuracyDecline * 0.4);

  return Math.round(fatigueScore * 1000) / 1000;
}
