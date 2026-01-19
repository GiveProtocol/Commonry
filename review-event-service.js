/**
 * Review Event Capture Service
 *
 * Server-side service for capturing enriched review event data.
 * Handles the full lifecycle: start → interaction → complete
 *
 * Design principles:
 * - Fail gracefully: capture errors should never break the review experience
 * - Capture generously: accept partial data, enrich server-side
 * - Optimize for writes: use async patterns, batch when possible
 * - Validate but don't reject: log issues, store what we can
 */

import { ulid } from "ulid";

// ============================================================
// ULID GENERATION
// ============================================================

/**
 * Generate a prefixed ULID for review events
 * @param {string} prefix - Entity prefix (e.g., 'evt', 'ses')
 * @returns {string} Prefixed ULID
 */
export function generateULID(prefix) {
  return `${prefix}_${ulid()}`;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

const VALID_DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"];
const VALID_CARD_STATES = ["new", "learning", "review", "relearning"];
const VALID_RESPONSE_TYPES = [
  "self_rating",
  "typed_response",
  "multiple_choice",
  "cloze_fill",
];
const VALID_STATUSES = ["started", "interacting", "completed", "abandoned"];

/**
 * Validates and sanitizes a value against allowed options
 */
function validateEnum(value, allowed, defaultValue) {
  if (!value) return defaultValue;
  const normalized = String(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : defaultValue;
}

/**
 * Safely parses an integer, returning null if invalid
 */
function safeInt(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Safely parses a float, returning null if invalid
 */
function safeFloat(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Ensures a value is a valid array, returns empty array if not
 */
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Ensures a value is a valid JSONB-compatible object
 */
function safeJsonb(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

// ============================================================
// REVIEW EVENT SERVICE
// ============================================================

/**
 * Service for managing review event lifecycle
 */
export class ReviewEventService {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   */
  constructor(pool) {
    this.pool = pool;

    // Batch queue for async writes
    this.writeQueue = [];
    this.flushInterval = null;
    this.batchSize = 50;
    this.flushIntervalMs = 1000;
  }

  /**
   * Start periodic batch flushing
   */
  startBatchProcessor() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      this.flushWriteQueue().catch((err) => {
        console.error("[ReviewEventService] Batch flush error:", err);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Stop batch processor and flush remaining
   */
  async stopBatchProcessor() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushWriteQueue();
  }

  /**
   * Flush the write queue to database
   */
  async flushWriteQueue() {
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.splice(0, this.batchSize);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const op of batch) {
        try {
          await op.execute(client);
        } catch (err) {
          console.error(
            `[ReviewEventService] Write operation failed for ${op.eventId}:`,
            err.message,
          );
          // Continue with other operations - don't fail the batch
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[ReviewEventService] Batch transaction failed:", err);
      // Re-queue failed operations for retry (with limit)
      for (const op of batch) {
        if ((op.retryCount || 0) < 3) {
          op.retryCount = (op.retryCount || 0) + 1;
          this.writeQueue.push(op);
        }
      }
    } finally {
      client.release();
    }
  }

  // ============================================================
  // START REVIEW EVENT
  // ============================================================

  /**
   * Create a new review event when a review starts
   *
   * @param {string} userId - User ID
   * @param {object} payload - Start event payload
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async startReviewEvent(userId, payload) {
    try {
      // Generate event ID if not provided
      const eventId = payload.eventId || generateULID("evt");

      // Validate and sanitize inputs
      const sanitized = {
        event_id: eventId,
        user_id: userId,
        card_id: payload.cardId,
        deck_id: payload.deckId,
        session_id: payload.sessionId || null,
        status: "started",

        // Device context
        device_type: validateEnum(
          payload.deviceType,
          VALID_DEVICE_TYPES,
          "unknown",
        ),
        viewport_width: safeInt(payload.viewportWidth),
        viewport_height: safeInt(payload.viewportHeight),
        input_method: payload.inputMethod || null,
        platform: payload.platform || null,
        client_version: payload.clientVersion || null,
        user_agent: payload.userAgent || null,

        // Time context
        local_hour: safeInt(payload.localHour),
        local_day_of_week: safeInt(payload.localDayOfWeek),
        timezone_offset_minutes: safeInt(payload.timezoneOffsetMinutes),

        // Session context
        position_in_session: safeInt(payload.positionInSession),
        time_since_session_start_ms: safeInt(payload.timeSinceSessionStartMs),
        preceding_reviews: JSON.stringify(safeArray(payload.precedingReviews)),

        // Card state
        card_state_before: validateEnum(
          payload.cardStateBefore,
          VALID_CARD_STATES,
          null,
        ),
        response_type: validateEnum(
          payload.responseType,
          VALID_RESPONSE_TYPES,
          "self_rating",
        ),

        // FSRS predictions
        predicted_recall_probability: safeFloat(
          payload.predictedRecallProbability,
        ),
        actual_interval_days: safeFloat(payload.actualIntervalDays),
        scheduled_interval_days: safeFloat(payload.scheduledIntervalDays),
        overdue_days: safeFloat(payload.overdueDays),
        ease_factor_before: safeFloat(payload.easeFactorBefore),
        interval_before_days: safeFloat(payload.intervalBeforeDays),
        repetition_count: safeInt(payload.repetitionCount),
        lapse_count: safeInt(payload.lapseCount),

        // Content context
        front_content_length: safeInt(payload.frontContentLength),
        back_content_length: safeInt(payload.backContentLength),
        has_media: Boolean(payload.hasMedia),
        media_types: safeArray(payload.mediaTypes),
        card_tags: safeArray(payload.cardTags),

        // Timestamps
        client_created_at: payload.clientCreatedAt || null,
        client_request_id: payload.clientRequestId || null,
      };

      // Validate required fields
      if (!sanitized.card_id || !sanitized.deck_id) {
        return {
          success: false,
          error: "cardId and deckId are required",
          code: "MISSING_REQUIRED_FIELDS",
        };
      }

      const result = await this.pool.query(
        `INSERT INTO review_events (
          event_id, user_id, card_id, deck_id, session_id, status,
          device_type, viewport_width, viewport_height, input_method, platform, client_version, user_agent,
          local_hour, local_day_of_week, timezone_offset_minutes,
          position_in_session, time_since_session_start_ms, preceding_reviews,
          card_state_before, response_type,
          predicted_recall_probability, actual_interval_days, scheduled_interval_days, overdue_days,
          ease_factor_before, interval_before_days, repetition_count, lapse_count,
          front_content_length, back_content_length, has_media, media_types, card_tags,
          client_created_at, client_request_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21,
          $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33, $34,
          $35, $36
        )
        RETURNING event_id, server_received_at`,
        [
          sanitized.event_id,
          sanitized.user_id,
          sanitized.card_id,
          sanitized.deck_id,
          sanitized.session_id,
          sanitized.status,
          sanitized.device_type,
          sanitized.viewport_width,
          sanitized.viewport_height,
          sanitized.input_method,
          sanitized.platform,
          sanitized.client_version,
          sanitized.user_agent,
          sanitized.local_hour,
          sanitized.local_day_of_week,
          sanitized.timezone_offset_minutes,
          sanitized.position_in_session,
          sanitized.time_since_session_start_ms,
          sanitized.preceding_reviews,
          sanitized.card_state_before,
          sanitized.response_type,
          sanitized.predicted_recall_probability,
          sanitized.actual_interval_days,
          sanitized.scheduled_interval_days,
          sanitized.overdue_days,
          sanitized.ease_factor_before,
          sanitized.interval_before_days,
          sanitized.repetition_count,
          sanitized.lapse_count,
          sanitized.front_content_length,
          sanitized.back_content_length,
          sanitized.has_media,
          sanitized.media_types,
          sanitized.card_tags,
          sanitized.client_created_at,
          sanitized.client_request_id,
        ],
      );

      return {
        success: true,
        eventId: result.rows[0].event_id,
        serverReceivedAt: result.rows[0].server_received_at,
      };
    } catch (err) {
      console.error("[ReviewEventService] startReviewEvent error:", err);
      return {
        success: false,
        error: "Failed to start review event",
        code: "DB_ERROR",
      };
    }
  }

  // ============================================================
  // RECORD INTERACTION
  // ============================================================

  /**
   * Append interaction data to an in-progress review event
   *
   * @param {string} eventId - Review event ID
   * @param {string} userId - User ID (for validation)
   * @param {object} payload - Interaction payload
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async recordInteraction(eventId, userId, payload) {
    try {
      const interactions = safeArray(payload.interactions);

      if (interactions.length === 0) {
        return {
          success: true,
          eventId,
          interactionCount: 0,
        };
      }

      // Use the database function for efficient append
      const result = await this.pool.query(
        `UPDATE review_events
         SET
           interaction_log = COALESCE(interaction_log, '[]'::jsonb) || $1::jsonb,
           status = CASE
             WHEN status = 'started' THEN 'interacting'::review_event_status
             ELSE status
           END,
           time_to_first_interaction_ms = COALESCE(time_to_first_interaction_ms, $2),
           was_backgrounded = COALESCE(was_backgrounded, FALSE) OR $3,
           time_backgrounded_ms = COALESCE(time_backgrounded_ms, 0) + COALESCE($4, 0)
         WHERE event_id = $5
           AND user_id = $6
           AND status != 'completed'
         RETURNING event_id`,
        [
          JSON.stringify(interactions),
          safeInt(payload.timeToFirstInteractionMs),
          Boolean(payload.wasBackgrounded),
          safeInt(payload.timeBackgroundedMs),
          eventId,
          userId,
        ],
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Event not found or already completed",
          code: "EVENT_NOT_FOUND",
        };
      }

      return {
        success: true,
        eventId,
        interactionCount: interactions.length,
      };
    } catch (err) {
      console.error("[ReviewEventService] recordInteraction error:", err);
      return {
        success: false,
        error: "Failed to record interaction",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Queue an interaction for batch processing (fire-and-forget)
   * Use this for high-frequency updates where immediate consistency isn't required
   */
  queueInteraction(eventId, userId, payload) {
    this.writeQueue.push({
      eventId,
      execute: async (client) => {
        const interactions = safeArray(payload.interactions);
        if (interactions.length === 0) return;

        await client.query(
          `UPDATE review_events
           SET interaction_log = COALESCE(interaction_log, '[]'::jsonb) || $1::jsonb,
               status = CASE WHEN status = 'started' THEN 'interacting'::review_event_status ELSE status END
           WHERE event_id = $2 AND user_id = $3 AND status != 'completed'`,
          [JSON.stringify(interactions), eventId, userId],
        );
      },
    });

    // Trigger flush if queue is large
    if (this.writeQueue.length >= this.batchSize) {
      this.flushWriteQueue().catch((err) => {
        console.error("[ReviewEventService] Triggered flush error:", err);
      });
    }
  }

  // ============================================================
  // COMPLETE REVIEW EVENT
  // ============================================================

  /**
   * Complete a review event with final outcome data
   *
   * @param {string} eventId - Review event ID
   * @param {string} userId - User ID (for validation)
   * @param {object} payload - Completion payload
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async completeReviewEvent(eventId, userId, payload) {
    try {
      // Validate rating
      const rating = safeInt(payload.rating);
      if (rating === null || rating < 1 || rating > 4) {
        return {
          success: false,
          error: "Rating must be between 1 and 4",
          code: "INVALID_RATING",
        };
      }

      const totalDurationMs = safeInt(payload.totalDurationMs);
      if (totalDurationMs === null) {
        return {
          success: false,
          error: "totalDurationMs is required",
          code: "MISSING_DURATION",
        };
      }

      // Build completion data
      const completionData = {
        rating,
        was_correct: rating >= 3,
        total_duration_ms: totalDurationMs,
        status: "completed",

        // Timing
        time_to_first_interaction_ms: safeInt(payload.timeToFirstInteractionMs),
        time_to_answer_ms: safeInt(payload.timeToAnswerMs),
        hesitation_before_rating_ms: safeInt(payload.hesitationBeforeRatingMs),

        // Response data
        user_response_text: payload.userResponseText || null,
        expected_response_text: payload.expectedResponseText || null,
        response_similarity_score: safeFloat(payload.responseSimilarityScore),

        // Keystroke metrics
        keystroke_count: safeInt(payload.keystrokeCount),
        backspace_count: safeInt(payload.backspaceCount),
        paste_count: safeInt(payload.pasteCount),
        edit_count: safeInt(payload.editCount),

        // Multiple choice
        option_interactions: payload.optionInteractions
          ? JSON.stringify(payload.optionInteractions)
          : null,

        // Final interaction log
        interaction_log: payload.interactionLog
          ? JSON.stringify(payload.interactionLog)
          : null,

        // Background tracking
        was_backgrounded: Boolean(payload.wasBackgrounded),
        time_backgrounded_ms: safeInt(payload.timeBackgroundedMs),

        // Post-review state
        card_state_after: validateEnum(
          payload.cardStateAfter,
          VALID_CARD_STATES,
          null,
        ),
        ease_factor_after: safeFloat(payload.easeFactorAfter),
        interval_after_days: safeFloat(payload.intervalAfterDays),

        // Metadata
        legacy_session_id: payload.legacySessionId || null,
      };

      const result = await this.pool.query(
        `UPDATE review_events
         SET
           status = 'completed'::review_event_status,
           rating = $1,
           was_correct = $2,
           total_duration_ms = $3,
           completed_at = CURRENT_TIMESTAMP,
           time_to_first_interaction_ms = COALESCE($4, time_to_first_interaction_ms),
           time_to_answer_ms = COALESCE($5, time_to_answer_ms),
           hesitation_before_rating_ms = COALESCE($6, hesitation_before_rating_ms),
           user_response_text = COALESCE($7, user_response_text),
           expected_response_text = COALESCE($8, expected_response_text),
           response_similarity_score = COALESCE($9, response_similarity_score),
           keystroke_count = COALESCE($10, keystroke_count),
           backspace_count = COALESCE($11, backspace_count),
           paste_count = COALESCE($12, paste_count),
           edit_count = COALESCE($13, edit_count),
           option_interactions = COALESCE($14::jsonb, option_interactions),
           interaction_log = CASE
             WHEN $15::jsonb IS NOT NULL THEN $15::jsonb
             ELSE interaction_log
           END,
           was_backgrounded = COALESCE(was_backgrounded, FALSE) OR $16,
           time_backgrounded_ms = COALESCE(time_backgrounded_ms, 0) + COALESCE($17, 0),
           card_state_after = COALESCE($18, card_state_after),
           ease_factor_after = COALESCE($19, ease_factor_after),
           interval_after_days = COALESCE($20, interval_after_days),
           legacy_session_id = COALESCE($21, legacy_session_id)
         WHERE event_id = $22
           AND user_id = $23
           AND status != 'completed'
         RETURNING event_id, completed_at, was_correct`,
        [
          completionData.rating,
          completionData.was_correct,
          completionData.total_duration_ms,
          completionData.time_to_first_interaction_ms,
          completionData.time_to_answer_ms,
          completionData.hesitation_before_rating_ms,
          completionData.user_response_text,
          completionData.expected_response_text,
          completionData.response_similarity_score,
          completionData.keystroke_count,
          completionData.backspace_count,
          completionData.paste_count,
          completionData.edit_count,
          completionData.option_interactions,
          completionData.interaction_log,
          completionData.was_backgrounded,
          completionData.time_backgrounded_ms,
          completionData.card_state_after,
          completionData.ease_factor_after,
          completionData.interval_after_days,
          completionData.legacy_session_id,
          eventId,
          userId,
        ],
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Event not found or already completed",
          code: "EVENT_NOT_FOUND",
        };
      }

      return {
        success: true,
        eventId: result.rows[0].event_id,
        completedAt: result.rows[0].completed_at,
        wasCorrect: result.rows[0].was_correct,
      };
    } catch (err) {
      console.error("[ReviewEventService] completeReviewEvent error:", err);
      return {
        success: false,
        error: "Failed to complete review event",
        code: "DB_ERROR",
      };
    }
  }

  // ============================================================
  // ABANDON STALE EVENTS
  // ============================================================

  /**
   * Mark old incomplete events as abandoned
   * Run this periodically to clean up events where the user never completed
   *
   * @param {number} maxAgeMinutes - Events older than this are marked abandoned
   * @returns {Promise<number>} Number of events marked as abandoned
   */
  async markAbandonedEvents(maxAgeMinutes = 30) {
    try {
      const result = await this.pool.query(
        `UPDATE review_events
         SET status = 'abandoned'::review_event_status
         WHERE status IN ('started', 'interacting')
           AND server_received_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
         RETURNING event_id`,
      );

      return result.rowCount;
    } catch (err) {
      console.error("[ReviewEventService] markAbandonedEvents error:", err);
      return 0;
    }
  }

  // ============================================================
  // SINGLE-REQUEST CAPTURE (fallback for simple clients)
  // ============================================================

  /**
   * Record a complete review event in a single request
   * Use this when streaming isn't available or for backwards compatibility
   *
   * @param {string} userId - User ID
   * @param {object} payload - Complete event payload
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async recordCompleteEvent(userId, payload) {
    try {
      const eventId = payload.eventId || generateULID("evt");

      // Validate required fields
      if (!payload.cardId || !payload.deckId) {
        return {
          success: false,
          error: "cardId and deckId are required",
          code: "MISSING_REQUIRED_FIELDS",
        };
      }

      const rating = safeInt(payload.rating);
      if (rating === null || rating < 1 || rating > 4) {
        return {
          success: false,
          error: "Rating must be between 1 and 4",
          code: "INVALID_RATING",
        };
      }

      const result = await this.pool.query(
        `INSERT INTO review_events (
          event_id, user_id, card_id, deck_id, session_id,
          status, rating, was_correct, total_duration_ms, completed_at,
          time_to_first_interaction_ms, time_to_answer_ms, hesitation_before_rating_ms,
          position_in_session, time_since_session_start_ms,
          local_hour, local_day_of_week, timezone_offset_minutes, preceding_reviews,
          response_type, user_response_text, expected_response_text, response_similarity_score,
          keystroke_count, backspace_count, paste_count, edit_count, option_interactions, interaction_log,
          device_type, viewport_width, viewport_height, was_backgrounded, time_backgrounded_ms,
          input_method, client_version, platform, user_agent,
          card_state_before, card_state_after, predicted_recall_probability,
          actual_interval_days, scheduled_interval_days, overdue_days,
          ease_factor_before, ease_factor_after, interval_before_days, interval_after_days,
          repetition_count, lapse_count,
          front_content_length, back_content_length, has_media, media_types, card_tags,
          client_created_at, legacy_session_id, client_request_id
        ) VALUES (
          $1, $2, $3, $4, $5,
          'completed', $6, $7, $8, CURRENT_TIMESTAMP,
          $9, $10, $11,
          $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27,
          $28, $29, $30, $31, $32,
          $33, $34, $35, $36,
          $37, $38, $39,
          $40, $41, $42,
          $43, $44, $45, $46,
          $47, $48,
          $49, $50, $51, $52, $53,
          $54, $55, $56
        )
        RETURNING event_id, server_received_at, completed_at, was_correct`,
        [
          eventId,
          userId,
          payload.cardId,
          payload.deckId,
          payload.sessionId || null,
          rating,
          rating >= 3,
          safeInt(payload.totalDurationMs),
          safeInt(payload.timeToFirstInteractionMs),
          safeInt(payload.timeToAnswerMs),
          safeInt(payload.hesitationBeforeRatingMs),
          safeInt(payload.positionInSession),
          safeInt(payload.timeSinceSessionStartMs),
          safeInt(payload.localHour),
          safeInt(payload.localDayOfWeek),
          safeInt(payload.timezoneOffsetMinutes),
          JSON.stringify(safeArray(payload.precedingReviews)),
          validateEnum(
            payload.responseType,
            VALID_RESPONSE_TYPES,
            "self_rating",
          ),
          payload.userResponseText || null,
          payload.expectedResponseText || null,
          safeFloat(payload.responseSimilarityScore),
          safeInt(payload.keystrokeCount),
          safeInt(payload.backspaceCount),
          safeInt(payload.pasteCount),
          safeInt(payload.editCount),
          payload.optionInteractions
            ? JSON.stringify(payload.optionInteractions)
            : null,
          payload.interactionLog
            ? JSON.stringify(payload.interactionLog)
            : "[]",
          validateEnum(payload.deviceType, VALID_DEVICE_TYPES, "unknown"),
          safeInt(payload.viewportWidth),
          safeInt(payload.viewportHeight),
          Boolean(payload.wasBackgrounded),
          safeInt(payload.timeBackgroundedMs),
          payload.inputMethod || null,
          payload.clientVersion || null,
          payload.platform || null,
          payload.userAgent || null,
          validateEnum(payload.cardStateBefore, VALID_CARD_STATES, null),
          validateEnum(payload.cardStateAfter, VALID_CARD_STATES, null),
          safeFloat(payload.predictedRecallProbability),
          safeFloat(payload.actualIntervalDays),
          safeFloat(payload.scheduledIntervalDays),
          safeFloat(payload.overdueDays),
          safeFloat(payload.easeFactorBefore),
          safeFloat(payload.easeFactorAfter),
          safeFloat(payload.intervalBeforeDays),
          safeFloat(payload.intervalAfterDays),
          safeInt(payload.repetitionCount),
          safeInt(payload.lapseCount),
          safeInt(payload.frontContentLength),
          safeInt(payload.backContentLength),
          Boolean(payload.hasMedia),
          safeArray(payload.mediaTypes),
          safeArray(payload.cardTags),
          payload.clientCreatedAt || null,
          payload.legacySessionId || null,
          payload.clientRequestId || null,
        ],
      );

      return {
        success: true,
        eventId: result.rows[0].event_id,
        serverReceivedAt: result.rows[0].server_received_at,
        completedAt: result.rows[0].completed_at,
        wasCorrect: result.rows[0].was_correct,
      };
    } catch (err) {
      console.error("[ReviewEventService] recordCompleteEvent error:", err);
      return {
        success: false,
        error: "Failed to record review event",
        code: "DB_ERROR",
      };
    }
  }
}

export default ReviewEventService;
