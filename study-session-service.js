/**
 * Study Session Service
 *
 * Server-side service for managing study session lifecycle:
 * - Session start/complete
 * - Heartbeat processing
 * - Break tracking
 * - Statistics computation
 * - Abandonment detection
 */

import { ulid } from "ulid";

// ============================================================
// ULID GENERATION
// ============================================================

export function generateSessionId() {
  return `ses_${ulid()}`;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

const VALID_SESSION_TYPES = [
  "regular",
  "diagnostic",
  "cram",
  "speed_review",
  "learn_new",
];
const VALID_SESSION_STATES = [
  "in_progress",
  "completed",
  "abandoned",
  "interrupted",
];
const VALID_DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"];
const VALID_BREAK_REASONS = ["background", "pause", "idle", "manual"];

function validateEnum(value, allowed, defaultValue) {
  if (!value) return defaultValue;
  const normalized = String(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : defaultValue;
}

function safeInt(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ============================================================
// STUDY SESSION SERVICE
// ============================================================

export class StudySessionService {
  constructor(pool) {
    this.pool = pool;
    this.abandonmentCheckInterval = null;
    this.abandonmentTimeoutMinutes = 5;
  }

  /**
   * Start periodic abandonment checks
   * @param {number} intervalMs - Check interval in milliseconds (default: 60000)
   */
  startAbandonmentDetector(intervalMs = 60000) {
    if (this.abandonmentCheckInterval) return;

    console.log(
      `[StudySessionService] Starting abandonment detector (${intervalMs}ms interval, ${this.abandonmentTimeoutMinutes}min timeout)`
    );

    this.abandonmentCheckInterval = setInterval(async () => {
      try {
        const count = await this.markAbandonedSessions();
        if (count > 0) {
          console.log(
            `[StudySessionService] Marked ${count} session(s) as abandoned`
          );
        }
      } catch (err) {
        console.error("[StudySessionService] Abandonment check error:", err);
      }
    }, intervalMs);
  }

  /**
   * Stop abandonment detector
   */
  stopAbandonmentDetector() {
    if (this.abandonmentCheckInterval) {
      clearInterval(this.abandonmentCheckInterval);
      this.abandonmentCheckInterval = null;
      console.log("[StudySessionService] Stopped abandonment detector");
    }
  }

  // ============================================================
  // START SESSION
  // ============================================================

  /**
   * Start a new study session
   * @param {string} userId - User ID
   * @param {object} payload - Session configuration
   * @returns {Promise<object>} Result with sessionId and serverStartedAt
   */
  async startSession(userId, payload) {
    try {
      const sessionId = payload.sessionId || generateSessionId();

      // Validate session ID format
      if (!sessionId.startsWith("ses_")) {
        return {
          success: false,
          error: "Invalid session ID format",
          code: "INVALID_SESSION_ID",
        };
      }

      const result = await this.pool.query(
        `INSERT INTO session_tracking (
          session_id, user_id, session_type, deck_id,
          cards_planned, target_duration_minutes,
          device_type, client_version, platform, user_agent,
          local_hour_started, local_day_of_week, timezone_offset_minutes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13
        )
        RETURNING session_id, started_at`,
        [
          sessionId,
          userId,
          validateEnum(payload.sessionType, VALID_SESSION_TYPES, "regular"),
          payload.deckId || null,
          safeInt(payload.cardsPlanned),
          safeInt(payload.targetDurationMinutes),
          validateEnum(payload.deviceType, VALID_DEVICE_TYPES, "unknown"),
          payload.clientVersion || null,
          payload.platform || null,
          payload.userAgent || null,
          safeInt(payload.localHour),
          safeInt(payload.localDayOfWeek),
          safeInt(payload.timezoneOffsetMinutes),
        ]
      );

      return {
        success: true,
        sessionId: result.rows[0].session_id,
        serverStartedAt: result.rows[0].started_at,
      };
    } catch (err) {
      console.error("[StudySessionService] startSession error:", err);

      // Handle duplicate session ID
      if (err.code === "23505") {
        return {
          success: false,
          error: "Session already exists",
          code: "DUPLICATE_SESSION",
        };
      }

      return {
        success: false,
        error: "Failed to start session",
        code: "DB_ERROR",
      };
    }
  }

  // ============================================================
  // HEARTBEAT
  // ============================================================

  /**
   * Record a heartbeat for an active session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {object} payload - Heartbeat data
   * @returns {Promise<object>} Result with heartbeatReceivedAt
   */
  async recordHeartbeat(sessionId, userId, payload = {}) {
    try {
      const result = await this.pool.query(
        `UPDATE session_tracking
         SET
           last_heartbeat_at = CURRENT_TIMESTAMP,
           cards_completed = cards_completed + COALESCE($1, 0),
           cards_correct = cards_correct + COALESCE($2, 0),
           updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $3
           AND user_id = $4
           AND final_state = 'in_progress'
         RETURNING session_id, last_heartbeat_at`,
        [
          safeInt(payload.cardsCompletedSinceLastBeat),
          safeInt(payload.cardsCorrectSinceLastBeat),
          sessionId,
          userId,
        ]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Session not found or not active",
          code: "SESSION_NOT_FOUND",
        };
      }

      return {
        success: true,
        sessionId: result.rows[0].session_id,
        heartbeatReceivedAt: result.rows[0].last_heartbeat_at,
      };
    } catch (err) {
      console.error("[StudySessionService] recordHeartbeat error:", err);
      return {
        success: false,
        error: "Failed to record heartbeat",
        code: "DB_ERROR",
      };
    }
  }

  // ============================================================
  // BREAK TRACKING
  // ============================================================

  /**
   * Record a break start or end
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {object} payload - Break data
   * @returns {Promise<object>} Result
   */
  async recordBreak(sessionId, userId, payload) {
    try {
      const breakEvent = {
        action: payload.action,
        reason: validateEnum(
          payload.reason,
          VALID_BREAK_REASONS,
          "manual"
        ),
        timestampMs: payload.timestampMs || null,
        serverTimestamp: new Date().toISOString(),
      };

      const result = await this.pool.query(
        `UPDATE session_tracking
         SET
           breaks = breaks || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2
           AND user_id = $3
           AND final_state = 'in_progress'
         RETURNING session_id`,
        [JSON.stringify([breakEvent]), sessionId, userId]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Session not found or not active",
          code: "SESSION_NOT_FOUND",
        };
      }

      return { success: true, sessionId };
    } catch (err) {
      console.error("[StudySessionService] recordBreak error:", err);
      return {
        success: false,
        error: "Failed to record break",
        code: "DB_ERROR",
      };
    }
  }

  // ============================================================
  // COMPLETE SESSION
  // ============================================================

  /**
   * Complete a study session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {object} payload - Completion data
   * @returns {Promise<object>} Result with statistics
   */
  async completeSession(sessionId, userId, payload) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // First, compute statistics from review_events
      await client.query("SELECT compute_session_statistics($1)", [sessionId]);

      // Calculate response time trend if provided
      let responseTimeTrend = null;
      if (payload.responseTimes && payload.responseTimes.length >= 3) {
        responseTimeTrend = this.calculateTrend(payload.responseTimes);
      }

      // Then update with final data from client
      const result = await client.query(
        `UPDATE session_tracking
         SET
           final_state = $1::session_state,
           ended_at = CURRENT_TIMESTAMP,
           cards_completed = COALESCE($2, cards_completed),
           cards_correct = COALESCE($3, cards_correct),
           cards_again = COALESCE($4, cards_again),
           cards_hard = COALESCE($5, cards_hard),
           cards_good = COALESCE($6, cards_good),
           cards_easy = COALESCE($7, cards_easy),
           new_cards_completed = COALESCE($8, new_cards_completed),
           review_cards_completed = COALESCE($9, review_cards_completed),
           breaks = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb ELSE breaks END,
           total_break_time_ms = COALESCE($11, total_break_time_ms),
           total_active_time_ms = COALESCE($12, total_active_time_ms),
           response_time_trend = COALESCE($13::jsonb, response_time_trend),
           updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $14
           AND user_id = $15
           AND final_state = 'in_progress'
         RETURNING *`,
        [
          validateEnum(
            payload.finalState,
            ["completed", "interrupted"],
            "completed"
          ),
          safeInt(payload.cardsCompleted),
          safeInt(payload.cardsCorrect),
          safeInt(payload.cardsAgain),
          safeInt(payload.cardsHard),
          safeInt(payload.cardsGood),
          safeInt(payload.cardsEasy),
          safeInt(payload.newCardsCompleted),
          safeInt(payload.reviewCardsCompleted),
          payload.breaks ? JSON.stringify(payload.breaks) : null,
          safeInt(payload.totalBreakTimeMs),
          safeInt(payload.totalActiveTimeMs),
          responseTimeTrend ? JSON.stringify(responseTimeTrend) : null,
          sessionId,
          userId,
        ]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return {
          success: false,
          error: "Session not found or already completed",
          code: "SESSION_NOT_FOUND",
        };
      }

      await client.query("COMMIT");

      const session = result.rows[0];
      return {
        success: true,
        sessionId: session.session_id,
        finalState: session.final_state,
        statistics: {
          cardsCompleted: session.cards_completed,
          cardsCorrect: session.cards_correct,
          accuracyRate: session.accuracy_rate
            ? parseFloat(session.accuracy_rate)
            : null,
          avgResponseTimeMs: session.avg_response_time_ms,
          medianResponseTimeMs: session.median_response_time_ms,
          minResponseTimeMs: session.min_response_time_ms,
          maxResponseTimeMs: session.max_response_time_ms,
          responseTimeTrend: session.response_time_trend,
          fatigueScore: session.fatigue_score
            ? parseFloat(session.fatigue_score)
            : null,
          difficultyDistribution: session.difficulty_distribution,
          totalActiveTimeMs: session.total_active_time_ms,
          totalBreakTimeMs: session.total_break_time_ms,
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[StudySessionService] completeSession error:", err);
      return {
        success: false,
        error: "Failed to complete session",
        code: "DB_ERROR",
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calculate linear regression trend from response times
   * @param {number[]} responseTimes - Array of response times in ms
   * @returns {object|null} Trend data or null if insufficient data
   */
  calculateTrend(responseTimes) {
    if (!responseTimes || responseTimes.length < 3) return null;

    const n = responseTimes.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += responseTimes[i];
      sumXY += i * responseTimes[i];
      sumX2 += i * i;
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
      ssTotal += Math.pow(responseTimes[i] - meanY, 2);
      ssResidual += Math.pow(responseTimes[i] - predicted, 2);
    }

    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

    return {
      slope: Math.round(slope * 1000) / 1000,
      rSquared: Math.round(Math.max(0, Math.min(1, rSquared)) * 1000) / 1000,
      sampleCount: n,
    };
  }

  // ============================================================
  // ABANDONMENT DETECTION
  // ============================================================

  /**
   * Mark sessions as abandoned if no heartbeat received within timeout
   * @returns {Promise<number>} Number of sessions marked as abandoned
   */
  async markAbandonedSessions() {
    try {
      const result = await this.pool.query(
        "SELECT mark_abandoned_sessions($1)",
        [this.abandonmentTimeoutMinutes]
      );
      return result.rows[0].mark_abandoned_sessions;
    } catch (err) {
      console.error("[StudySessionService] markAbandonedSessions error:", err);
      return 0;
    }
  }

  // ============================================================
  // QUERY METHODS
  // ============================================================

  /**
   * Get the active session for a user (if any)
   * @param {string} userId - User ID
   * @returns {Promise<object>} Result with session or null
   */
  async getActiveSession(userId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM session_tracking
         WHERE user_id = $1
           AND final_state = 'in_progress'
         ORDER BY started_at DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rowCount === 0) {
        return { success: true, session: null };
      }

      return { success: true, session: this.formatSession(result.rows[0]) };
    } catch (err) {
      console.error("[StudySessionService] getActiveSession error:", err);
      return {
        success: false,
        error: "Failed to get active session",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Get a specific session by ID
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Result with session
   */
  async getSession(sessionId, userId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM session_tracking
         WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Session not found",
          code: "NOT_FOUND",
        };
      }

      return { success: true, session: this.formatSession(result.rows[0]) };
    } catch (err) {
      console.error("[StudySessionService] getSession error:", err);
      return {
        success: false,
        error: "Failed to get session",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Get recent sessions for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<object>} Result with sessions array
   */
  async getRecentSessions(userId, limit = 10) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM session_tracking
         WHERE user_id = $1
         ORDER BY started_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return {
        success: true,
        sessions: result.rows.map((row) => this.formatSession(row)),
      };
    } catch (err) {
      console.error("[StudySessionService] getRecentSessions error:", err);
      return {
        success: false,
        error: "Failed to get sessions",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Format a database row into a camelCase session object
   * @param {object} row - Database row
   * @returns {object} Formatted session
   */
  formatSession(row) {
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      totalActiveTimeMs: row.total_active_time_ms,
      sessionType: row.session_type,
      deckId: row.deck_id,
      cardsPlanned: row.cards_planned,
      targetDurationMinutes: row.target_duration_minutes,
      deviceType: row.device_type,
      clientVersion: row.client_version,
      platform: row.platform,
      userAgent: row.user_agent,
      localHourStarted: row.local_hour_started,
      localDayOfWeek: row.local_day_of_week,
      timezoneOffsetMinutes: row.timezone_offset_minutes,
      cardsCompleted: row.cards_completed,
      cardsCorrect: row.cards_correct,
      cardsAgain: row.cards_again,
      cardsHard: row.cards_hard,
      cardsGood: row.cards_good,
      cardsEasy: row.cards_easy,
      newCardsCompleted: row.new_cards_completed,
      reviewCardsCompleted: row.review_cards_completed,
      breaks: row.breaks || [],
      totalBreakTimeMs: row.total_break_time_ms,
      finalState: row.final_state,
      accuracyRate: row.accuracy_rate ? parseFloat(row.accuracy_rate) : null,
      avgResponseTimeMs: row.avg_response_time_ms,
      medianResponseTimeMs: row.median_response_time_ms,
      minResponseTimeMs: row.min_response_time_ms,
      maxResponseTimeMs: row.max_response_time_ms,
      responseTimeTrend: row.response_time_trend,
      fatigueScore: row.fatigue_score ? parseFloat(row.fatigue_score) : null,
      difficultyDistribution: row.difficulty_distribution,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default StudySessionService;
