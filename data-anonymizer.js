/**
 * Data Anonymizer Service
 *
 * Handles all anonymization operations for research data exports.
 * Implements privacy-by-design principles with consistent hashing,
 * timestamp relativization, and PII removal.
 *
 * Data Classifications:
 * - KEEP: Field exported as-is (e.g., counts, scores)
 * - HASH: Consistent one-way hash (e.g., IDs)
 * - ANONYMIZE: Reduce to category (e.g., user_agent → platform)
 * - REMOVE: Field not exported (e.g., IP addresses)
 * - RELATIVIZE: Convert to offset (e.g., timestamps)
 */

import crypto from "crypto";

/**
 * User-Agent parser patterns for platform detection
 */
const PLATFORM_PATTERNS = {
  // Mobile platforms
  iOS: /iPhone|iPad|iPod/i,
  Android: /Android/i,

  // Desktop browsers
  Chrome: /Chrome(?!.*Edge)/i,
  Firefox: /Firefox/i,
  Safari: /Safari(?!.*Chrome)/i,
  Edge: /Edge|Edg\//i,

  // Desktop OS (fallback)
  Windows: /Windows/i,
  macOS: /Macintosh|Mac OS/i,
  Linux: /Linux(?!.*Android)/i,
};

/**
 * Client type detection patterns
 */
const CLIENT_TYPE_PATTERNS = {
  mobile: /mobile|android|iphone|ipad|ipod/i,
  tablet: /tablet|ipad/i,
  desktop: /windows|macintosh|linux/i,
};

export class DataAnonymizer {
  /**
   * Create a new DataAnonymizer instance
   *
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   * @param {Object} options - Configuration options
   * @param {string} [options.hashSalt] - Additional salt for hashing (optional, IDs have per-rotation salts)
   */
  constructor(pool, options = {}) {
    this.pool = pool;
    this.options = {
      hashSalt: options.hashSalt || process.env.RESEARCH_HASH_SALT || "",
      ...options,
    };

    // Cache for anonymous IDs to reduce DB queries
    this.alidCache = new Map();
  }

  // ============================================================
  // ALID MANAGEMENT
  // ============================================================

  /**
   * Get the anonymous learner ID for a user
   * Creates one if it doesn't exist
   *
   * @param {string} userId - The real user ID
   * @returns {Promise<string>} The anonymous learner ID (64-char hex)
   */
  async getAnonymousLearnerId(userId) {
    // Check cache first
    if (this.alidCache.has(userId)) {
      return this.alidCache.get(userId);
    }

    const result = await this.pool.query("SELECT get_or_create_alid($1)", [
      userId,
    ]);

    const anonymousId = result.rows[0].get_or_create_alid;
    this.alidCache.set(userId, anonymousId);

    return anonymousId;
  }

  /**
   * Preload ALIDs for a batch of users (optimization)
   *
   * @param {string[]} userIds - Array of user IDs to preload
   */
  async preloadALIDs(userIds) {
    if (!userIds || userIds.length === 0) return;

    // Filter out already cached
    const uncached = userIds.filter((id) => !this.alidCache.has(id));
    if (uncached.length === 0) return;

    const result = await this.pool.query(
      `SELECT user_id, anonymous_id
       FROM anonymous_learner_ids
       WHERE user_id = ANY($1) AND valid_until IS NULL`,
      [uncached]
    );

    for (const row of result.rows) {
      this.alidCache.set(row.user_id, row.anonymous_id);
    }

    // Create ALIDs for users that don't have one yet
    const stillUncached = uncached.filter((id) => !this.alidCache.has(id));
    for (const userId of stillUncached) {
      await this.getAnonymousLearnerId(userId);
    }
  }

  /**
   * Rotate all ALIDs (should be called quarterly)
   *
   * @returns {Promise<number>} Number of ALIDs rotated
   */
  async rotateALIDs() {
    const result = await this.pool.query("SELECT rotate_alids()");
    const rotatedCount = result.rows[0].rotate_alids;

    // Clear cache since all ALIDs have changed
    this.alidCache.clear();

    console.log(`[DataAnonymizer] Rotated ${rotatedCount} ALIDs`);
    return rotatedCount;
  }

  /**
   * Clear the ALID cache (useful after rotation or for testing)
   */
  clearCache() {
    this.alidCache.clear();
  }

  // ============================================================
  // FIELD-LEVEL ANONYMIZATION
  // ============================================================

  /**
   * Create a consistent hash for an ID
   * Same input always produces same output (within salt context)
   *
   * @param {string} id - The ID to hash
   * @param {string} [salt] - Optional additional salt
   * @returns {string} 64-char hex hash
   */
  hashId(id, salt = "") {
    if (!id) return null;
    const fullSalt = salt + this.options.hashSalt;
    return crypto
      .createHash("sha256")
      .update(id + fullSalt)
      .digest("hex");
  }

  /**
   * Extract client type from client_info JSON
   *
   * @param {Object|string} clientInfo - Client info object or JSON string
   * @returns {string} 'mobile', 'tablet', 'desktop', or 'unknown'
   */
  anonymizeClientInfo(clientInfo) {
    if (!clientInfo) return "unknown";

    const info =
      typeof clientInfo === "string" ? JSON.parse(clientInfo) : clientInfo;
    const userAgent = info.userAgent || info.user_agent || "";

    if (CLIENT_TYPE_PATTERNS.tablet.test(userAgent)) return "tablet";
    if (CLIENT_TYPE_PATTERNS.mobile.test(userAgent)) return "mobile";
    if (CLIENT_TYPE_PATTERNS.desktop.test(userAgent)) return "desktop";

    return "unknown";
  }

  /**
   * Extract platform category from user agent string
   *
   * @param {string} userAgent - The user agent string
   * @returns {string} Platform name or 'Other'
   */
  anonymizeUserAgent(userAgent) {
    if (!userAgent) return "Unknown";

    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Other";
  }

  /**
   * Convert an absolute timestamp to a relative offset
   *
   * @param {Date|string} timestamp - The timestamp to relativize
   * @param {Date|string} baseTime - The reference timestamp (usually session start)
   * @param {string} [unit='ms'] - Output unit: 'ms', 'seconds', 'minutes'
   * @returns {number} Offset from base time
   */
  relativizeTimestamp(timestamp, baseTime, unit = "ms") {
    if (!timestamp || !baseTime) return null;

    const ts = new Date(timestamp).getTime();
    const base = new Date(baseTime).getTime();
    const diffMs = ts - base;

    switch (unit) {
      case "seconds":
        return Math.round(diffMs / 1000);
      case "minutes":
        return Math.round(diffMs / 60000);
      default:
        return diffMs;
    }
  }

  // ============================================================
  // RECORD-LEVEL PROCESSING
  // ============================================================

  /**
   * Anonymize a study session record
   *
   * @param {Object} session - Raw session from session_tracking table
   * @returns {Promise<Object>} Anonymized session object
   */
  async anonymizeSession(session) {
    const anonymousLearnerId = await this.getAnonymousLearnerId(session.user_id);

    return {
      // HASH: IDs
      anonymous_learner_id: anonymousLearnerId,
      anonymous_session_id: this.hashId(session.session_id, "session"),
      anonymous_deck_id: session.deck_id
        ? this.hashId(session.deck_id, "deck")
        : null,

      // RELATIVIZE: Timestamps
      session_start_offset: 0, // Always 0 for session start
      session_duration_seconds: session.ended_at && session.started_at
        ? this.relativizeTimestamp(session.ended_at, session.started_at, "seconds")
        : session.total_time_seconds || null,

      // KEEP: Metrics
      cards_studied: session.cards_studied,
      correct_count: session.correct_count,
      incorrect_count: session.incorrect_count,
      total_time_seconds: session.total_time_seconds,
      average_response_time_ms: session.average_response_time_ms,
      session_type: session.session_type,

      // ANONYMIZE: Client info
      client_type: this.anonymizeClientInfo(session.client_info),
      platform_category: this.anonymizeUserAgent(session.user_agent),

      // REMOVE: ip_address, user_agent (full), email, etc.
      // These fields are simply not included
    };
  }

  /**
   * Anonymize a review event record
   *
   * @param {Object} event - Raw event from review_events table
   * @param {Date|string} sessionStart - Session start time for relativization
   * @returns {Promise<Object>} Anonymized event object
   */
  async anonymizeReviewEvent(event, sessionStart) {
    const anonymousLearnerId = await this.getAnonymousLearnerId(event.user_id);

    return {
      // HASH: IDs
      anonymous_event_id: this.hashId(event.event_id, "event"),
      anonymous_session_id: this.hashId(event.session_id, "session"),
      anonymous_card_id: this.hashId(event.card_id, "card"),
      anonymous_learner_id: anonymousLearnerId,

      // RELATIVIZE: Timestamp
      event_offset_ms: this.relativizeTimestamp(
        event.created_at,
        sessionStart,
        "ms"
      ),

      // KEEP: Learning metrics
      response_quality: event.response_quality,
      response_time_ms: event.response_time_ms,
      ease_factor: event.ease_factor,
      interval_days: event.interval_days,
      review_type: event.review_type,
    };
  }

  /**
   * Anonymize user statistics record
   *
   * @param {Object} stats - Raw stats from user_statistics table
   * @returns {Promise<Object>} Anonymized statistics object
   */
  async anonymizeStatistics(stats) {
    const anonymousLearnerId = await this.getAnonymousLearnerId(stats.user_id);

    return {
      // HASH: ID
      anonymous_learner_id: anonymousLearnerId,

      // KEEP: Aggregate metrics
      total_reviews: stats.total_reviews,
      total_study_time_minutes: stats.total_study_time_minutes,
      current_streak_days: stats.current_streak_days,
      longest_streak_days: stats.longest_streak_days,
      average_accuracy: stats.average_accuracy,
      cards_mastered: stats.cards_mastered,

      // REMOVE: last_study_date (too identifying)
      // Not included in output
    };
  }

  /**
   * Anonymize card analysis record
   *
   * @param {Object} analysis - Raw analysis from card_analysis table
   * @returns {Object} Anonymized card analysis object (sync, no user data)
   */
  anonymizeCardAnalysis(analysis) {
    return {
      // HASH: Card ID
      anonymous_card_id: this.hashId(analysis.card_id, "card"),

      // KEEP: Content metrics (no user data)
      content_domain: analysis.detected_domain,
      complexity_level: analysis.complexity_level,
      language: analysis.detected_language,
      front_word_count: analysis.front_word_count,
      back_word_count: analysis.back_word_count,
    };
  }

  // ============================================================
  // BATCH PROCESSING
  // ============================================================

  /**
   * Anonymize a batch of records
   *
   * @param {Object[]} records - Array of raw records
   * @param {string} type - Record type: 'session', 'review', 'statistics', 'card_analysis'
   * @param {Object} [context] - Additional context (e.g., sessionStarts for reviews)
   * @returns {Promise<Object[]>} Array of anonymized records
   */
  async anonymizeBatch(records, type, context = {}) {
    if (!records || records.length === 0) return [];

    // Preload ALIDs for all users in batch (optimization)
    if (type !== "card_analysis") {
      const userIds = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
      await this.preloadALIDs(userIds);
    }

    const anonymized = [];

    for (const record of records) {
      try {
        let anonymizedRecord;

        switch (type) {
          case "session":
            anonymizedRecord = await this.anonymizeSession(record);
            break;

          case "review":
            const sessionStart =
              context.sessionStarts?.[record.session_id] || record.created_at;
            anonymizedRecord = await this.anonymizeReviewEvent(
              record,
              sessionStart
            );
            break;

          case "statistics":
            anonymizedRecord = await this.anonymizeStatistics(record);
            break;

          case "card_analysis":
            anonymizedRecord = this.anonymizeCardAnalysis(record);
            break;

          default:
            throw new Error(`Unknown record type: ${type}`);
        }

        anonymized.push(anonymizedRecord);
      } catch (error) {
        console.error(
          `[DataAnonymizer] Error anonymizing ${type} record:`,
          error.message
        );
        // Skip records that fail anonymization
      }
    }

    return anonymized;
  }
}

export default DataAnonymizer;
