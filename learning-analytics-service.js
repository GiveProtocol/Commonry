/**
 * Learning Analytics Service
 *
 * Backend service for detecting patterns that predict learning success or struggle.
 * Leverages the rich instrumentation in review_events and session_tracking tables.
 *
 * Key insights:
 * - User learning velocity and trends
 * - Session patterns and optimal study times
 * - Struggling cards needing intervention
 * - Content difficulty (universal vs user-specific)
 * - Pattern detection (interference, prerequisites, fatigue, circadian)
 */

// ============================================================
// LEARNING ANALYTICS SERVICE
// ============================================================

export class LearningAnalyticsService {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  // ============================================================
  // USER PROFILE
  // ============================================================

  /**
   * Get comprehensive learning profile for a user
   *
   * @param {string} userId - User ID
   * @returns {Promise<{velocity: object, patterns: object, struggleMetrics: object}>}
   */
  async getUserLearningProfile(userId) {
    try {
      // Run queries in parallel
      const [velocityResult, patternsResult, struggleResult] = await Promise.all([
        this.pool.query(
          `SELECT *
           FROM v_user_learning_velocity
           WHERE user_id = $1
           ORDER BY week_start DESC
           LIMIT 1`,
          [userId]
        ),
        this.pool.query(
          `SELECT *
           FROM v_user_session_patterns
           WHERE user_id = $1`,
          [userId]
        ),
        this.pool.query(
          `SELECT
             COUNT(*) AS total_struggling_cards,
             COUNT(*) FILTER (WHERE struggle_type = 'high_fail_rate') AS high_fail_rate_cards,
             COUNT(*) FILTER (WHERE struggle_type = 'repeated_lapses') AS repeated_lapse_cards,
             COUNT(*) FILTER (WHERE struggle_type = 'getting_worse') AS getting_worse_cards,
             COUNT(*) FILTER (WHERE struggle_type = 'slow_recall') AS slow_recall_cards,
             AVG(struggle_score) AS avg_struggle_score
           FROM v_user_struggle_indicators
           WHERE user_id = $1`,
          [userId]
        ),
      ]);

      const velocity = velocityResult.rows[0] || null;
      const patterns = patternsResult.rows[0] || null;
      const struggleMetrics = struggleResult.rows[0] || {
        total_struggling_cards: 0,
        high_fail_rate_cards: 0,
        repeated_lapse_cards: 0,
        getting_worse_cards: 0,
        slow_recall_cards: 0,
        avg_struggle_score: null,
      };

      return {
        velocity: velocity
          ? {
              currentWeekMastered: parseInt(velocity.cards_mastered, 10) || 0,
              newCardsLearned: parseInt(velocity.new_cards_learned, 10) || 0,
              totalReviews: parseInt(velocity.total_reviews, 10) || 0,
              trend: velocity.velocity_trend,
              rolling4WeekAvg: parseFloat(velocity.rolling_4week_avg) || 0,
              monthOverMonthChangePct: velocity.month_over_month_change_pct
                ? parseFloat(velocity.month_over_month_change_pct)
                : null,
            }
          : null,
        patterns: patterns
          ? {
              preferredHour: patterns.preferred_hour,
              preferredDay: patterns.preferred_day,
              activeHours: patterns.active_hours || [],
              avgSessionMinutes: parseFloat(patterns.avg_session_minutes) || 0,
              avgCardsPerSession: parseFloat(patterns.avg_cards_per_session) || 0,
              consistencyRatio: parseFloat(patterns.consistency_ratio) || 0,
              totalStudyDays: parseInt(patterns.total_study_days, 10) || 0,
              totalSessions: parseInt(patterns.total_sessions, 10) || 0,
              sessionStyle: patterns.session_style,
              learnerType: patterns.learner_type,
              deviceBreakdown: {
                mobile: parseInt(patterns.mobile_sessions, 10) || 0,
                desktop: parseInt(patterns.desktop_sessions, 10) || 0,
                tablet: parseInt(patterns.tablet_sessions, 10) || 0,
              },
            }
          : null,
        struggleMetrics: {
          totalStrugglingCards: parseInt(struggleMetrics.total_struggling_cards, 10) || 0,
          highFailRateCards: parseInt(struggleMetrics.high_fail_rate_cards, 10) || 0,
          repeatedLapseCards: parseInt(struggleMetrics.repeated_lapse_cards, 10) || 0,
          gettingWorseCards: parseInt(struggleMetrics.getting_worse_cards, 10) || 0,
          slowRecallCards: parseInt(struggleMetrics.slow_recall_cards, 10) || 0,
          avgStruggleScore: struggleMetrics.avg_struggle_score
            ? parseFloat(struggleMetrics.avg_struggle_score)
            : null,
        },
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] getUserLearningProfile error:", err);
      throw err;
    }
  }

  /**
   * Get velocity history for charting
   *
   * @param {string} userId - User ID
   * @param {number} weeks - Number of weeks to retrieve (default 12)
   * @returns {Promise<Array>} Weekly velocity data
   */
  async getUserVelocityHistory(userId, weeks = 12) {
    try {
      const result = await this.pool.query(
        `SELECT
           week_start,
           cards_mastered,
           new_cards_learned,
           total_reviews,
           correct_reviews,
           rolling_4week_avg,
           velocity_trend,
           month_over_month_change_pct
         FROM v_user_learning_velocity
         WHERE user_id = $1
         ORDER BY week_start DESC
         LIMIT $2`,
        [userId, weeks]
      );

      return result.rows.map((row) => ({
        weekStart: row.week_start,
        cardsMastered: parseInt(row.cards_mastered, 10) || 0,
        newCardsLearned: parseInt(row.new_cards_learned, 10) || 0,
        totalReviews: parseInt(row.total_reviews, 10) || 0,
        correctReviews: parseInt(row.correct_reviews, 10) || 0,
        rolling4WeekAvg: parseFloat(row.rolling_4week_avg) || 0,
        velocityTrend: row.velocity_trend,
        monthOverMonthChangePct: row.month_over_month_change_pct
          ? parseFloat(row.month_over_month_change_pct)
          : null,
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] getUserVelocityHistory error:", err);
      throw err;
    }
  }

  // ============================================================
  // CARD DIFFICULTY
  // ============================================================

  /**
   * Get difficulty metrics for a specific card
   *
   * @param {string} cardId - Card ID
   * @param {string|null} userId - Optional user ID for comparison
   * @returns {Promise<object>} Card difficulty metrics
   */
  async getCardDifficultyMetrics(cardId, userId = null) {
    try {
      // Get global difficulty metrics
      const globalResult = await this.pool.query(
        `SELECT *
         FROM v_card_difficulty_metrics
         WHERE card_id = $1`,
        [cardId]
      );

      const global = globalResult.rows[0] || null;

      // Get user-specific metrics if userId provided
      let userSpecific = null;
      if (userId) {
        const userResult = await this.pool.query(
          `SELECT
             COUNT(*) AS review_count,
             AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) AS user_success_rate,
             AVG(total_duration_ms) AS user_avg_time_ms
           FROM review_events
           WHERE card_id = $1 AND user_id = $2 AND status = 'completed'`,
          [cardId, userId]
        );

        if (userResult.rows[0] && parseInt(userResult.rows[0].review_count, 10) > 0) {
          userSpecific = {
            reviewCount: parseInt(userResult.rows[0].review_count, 10),
            userSuccessRate: parseFloat(userResult.rows[0].user_success_rate) || 0,
            userAvgTimeMs: parseFloat(userResult.rows[0].user_avg_time_ms) || 0,
          };
        }
      }

      if (!global) {
        return {
          global: null,
          userSpecific,
          comparison: null,
        };
      }

      // Calculate comparison if both exist
      let comparison = null;
      if (userSpecific && global) {
        const successDiff = userSpecific.userSuccessRate - parseFloat(global.global_success_rate);
        comparison = {
          performanceVsGlobal: successDiff > 0.1 ? "above_average" : successDiff < -0.1 ? "below_average" : "average",
          successRateDifference: Math.round(successDiff * 100) / 100,
        };
      }

      return {
        global: {
          uniqueUsers: parseInt(global.unique_users, 10),
          totalReviews: parseInt(global.total_reviews, 10),
          globalSuccessRate: parseFloat(global.global_success_rate),
          successRateVariance: parseFloat(global.success_rate_variance) || 0,
          avgResponseTimeMs: parseInt(global.avg_response_time_ms, 10),
          medianResponseMs: parseInt(global.median_response_ms, 10),
          difficultyPercentile: parseFloat(global.difficulty_percentile),
          difficultyClass: global.difficulty_class,
          consistencyClass: global.consistency_class,
        },
        userSpecific,
        comparison,
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] getCardDifficultyMetrics error:", err);
      throw err;
    }
  }

  /**
   * Get hardest cards in a deck by global success rate
   *
   * @param {string} deckId - Deck ID
   * @param {number} limit - Maximum number of cards to return
   * @returns {Promise<Array>} Hardest cards
   */
  async getDeckHardestCards(deckId, limit = 10) {
    try {
      const result = await this.pool.query(
        `SELECT cdm.*
         FROM v_card_difficulty_metrics cdm
         INNER JOIN (
           SELECT DISTINCT card_id
           FROM review_events
           WHERE deck_id = $1 AND status = 'completed'
         ) deck_cards ON cdm.card_id = deck_cards.card_id
         ORDER BY cdm.global_success_rate ASC
         LIMIT $2`,
        [deckId, limit]
      );

      return result.rows.map((row) => ({
        cardId: row.card_id,
        globalSuccessRate: parseFloat(row.global_success_rate),
        difficultyClass: row.difficulty_class,
        uniqueUsers: parseInt(row.unique_users, 10),
        totalReviews: parseInt(row.total_reviews, 10),
        avgResponseTimeMs: parseInt(row.avg_response_time_ms, 10),
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] getDeckHardestCards error:", err);
      throw err;
    }
  }

  // ============================================================
  // SESSION HEALTH
  // ============================================================

  /**
   * Get session health indicators
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} Session health data
   */
  async getSessionHealthIndicators(sessionId) {
    try {
      const result = await this.pool.query(
        `SELECT *
         FROM v_session_health_indicators
         WHERE session_id = $1`,
        [sessionId]
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        sessionId: row.session_id,
        cardsCompleted: parseInt(row.cards_completed, 10),
        finalAccuracy: parseFloat(row.final_accuracy),
        fatigueScore: parseFloat(row.fatigue_score),
        q1Accuracy: parseFloat(row.q1_accuracy),
        q4Accuracy: parseFloat(row.q4_accuracy),
        accuracyDecay: parseFloat(row.accuracy_decay),
        paceDecayPct: parseFloat(row.pace_decay_pct),
        sessionHealth: row.session_health,
        recommendations: this._getSessionRecommendations(row),
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] getSessionHealthIndicators error:", err);
      throw err;
    }
  }

  /**
   * Get real-time health for an active session
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Live session health
   */
  async getLiveSessionHealth(sessionId) {
    try {
      // Get current session stats
      const result = await this.pool.query(
        `WITH session_events AS (
           SELECT
             position_in_session,
             was_correct,
             total_duration_ms,
             NTILE(4) OVER (ORDER BY position_in_session) AS quarter
           FROM review_events
           WHERE session_id = $1 AND status = 'completed'
           ORDER BY position_in_session
         ),
         quarter_stats AS (
           SELECT
             quarter,
             AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) AS accuracy,
             AVG(total_duration_ms) AS avg_time
           FROM session_events
           GROUP BY quarter
         )
         SELECT
           (SELECT COUNT(*) FROM session_events) AS cards_completed,
           (SELECT AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) FROM session_events) AS current_accuracy,
           (SELECT AVG(total_duration_ms) FROM session_events) AS avg_response_time,
           (SELECT accuracy FROM quarter_stats WHERE quarter = 1) AS q1_accuracy,
           (SELECT accuracy FROM quarter_stats WHERE quarter = (SELECT MAX(quarter) FROM quarter_stats)) AS latest_quarter_accuracy,
           (SELECT avg_time FROM quarter_stats WHERE quarter = 1) AS q1_avg_time,
           (SELECT avg_time FROM quarter_stats WHERE quarter = (SELECT MAX(quarter) FROM quarter_stats)) AS latest_quarter_time`,
        [sessionId]
      );

      const row = result.rows[0];
      if (!row || parseInt(row.cards_completed, 10) < 4) {
        return {
          sessionId,
          cardsCompleted: parseInt(row?.cards_completed, 10) || 0,
          status: "insufficient_data",
          message: "Need at least 4 reviews for health analysis",
        };
      }

      const q1Accuracy = parseFloat(row.q1_accuracy) || 0;
      const latestAccuracy = parseFloat(row.latest_quarter_accuracy) || 0;
      const q1Time = parseFloat(row.q1_avg_time) || 1;
      const latestTime = parseFloat(row.latest_quarter_time) || 1;

      const accuracyDecay = q1Accuracy - latestAccuracy;
      const paceDecay = (latestTime - q1Time) / q1Time;

      let health = "healthy";
      if (accuracyDecay > 0.15 || paceDecay > 0.3) {
        health = "fatigued";
      } else if (accuracyDecay > 0.1 || paceDecay > 0.2) {
        health = "declining";
      } else if (accuracyDecay > 0.05 || paceDecay > 0.1) {
        health = "slowing";
      }

      return {
        sessionId,
        cardsCompleted: parseInt(row.cards_completed, 10),
        currentAccuracy: parseFloat(row.current_accuracy),
        avgResponseTimeMs: Math.round(parseFloat(row.avg_response_time)),
        accuracyDecay: Math.round(accuracyDecay * 1000) / 1000,
        paceDecayPct: Math.round(paceDecay * 100),
        health,
        recommendation: health === "fatigued" || health === "declining"
          ? "Consider taking a break or ending the session"
          : null,
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] getLiveSessionHealth error:", err);
      throw err;
    }
  }

  /**
   * Generate session recommendations based on health indicators
   * @private
   */
  _getSessionRecommendations(row) {
    const recommendations = [];
    const fatigueScore = parseFloat(row.fatigue_score) || 0;
    const accuracyDecay = parseFloat(row.accuracy_decay) || 0;
    const paceDecayPct = parseFloat(row.pace_decay_pct) || 0;

    if (fatigueScore > 0.5) {
      recommendations.push("High fatigue detected. Consider shorter sessions.");
    }
    if (accuracyDecay > 0.15) {
      recommendations.push("Significant accuracy decline. Take breaks every 15-20 cards.");
    }
    if (paceDecayPct > 30) {
      recommendations.push("Response time increased significantly. You may be losing focus.");
    }
    if (recommendations.length === 0) {
      recommendations.push("Good session! Your performance was consistent throughout.");
    }

    return recommendations;
  }

  // ============================================================
  // STRUGGLING CARDS
  // ============================================================

  /**
   * Get struggling cards for a user
   *
   * @param {string} userId - User ID
   * @param {number} threshold - Minimum struggle score (0-1, default 0.4)
   * @param {number} limit - Maximum cards to return
   * @returns {Promise<Array>} Struggling cards
   */
  async getStrugglingCards(userId, threshold = 0.4, limit = 20) {
    try {
      const result = await this.pool.query(
        `SELECT *
         FROM v_user_struggle_indicators
         WHERE user_id = $1 AND struggle_score >= $2
         ORDER BY struggle_score DESC
         LIMIT $3`,
        [userId, threshold, limit]
      );

      return result.rows.map((row) => ({
        cardId: row.card_id,
        deckId: row.deck_id,
        reviewCount: parseInt(row.review_count, 10),
        failCount: parseInt(row.fail_count, 10),
        againCount: parseInt(row.again_count, 10),
        avgTimeMs: parseInt(row.avg_time_ms, 10),
        totalLapses: parseInt(row.total_lapses, 10) || 0,
        improvementCorrelation: parseFloat(row.improvement_correlation) || 0,
        struggleScore: parseFloat(row.struggle_score),
        struggleType: row.struggle_type,
        recommendation: this._getStruggleRecommendation(row.struggle_type),
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] getStrugglingCards error:", err);
      throw err;
    }
  }

  /**
   * Get struggling cards grouped by deck
   *
   * @param {string} userId - User ID
   * @returns {Promise<object>} Struggling cards by deck
   */
  async getStrugglingCardsByDeck(userId) {
    try {
      const result = await this.pool.query(
        `SELECT
           deck_id,
           COUNT(*) AS struggling_count,
           AVG(struggle_score) AS avg_struggle_score,
           ARRAY_AGG(card_id ORDER BY struggle_score DESC) AS card_ids
         FROM v_user_struggle_indicators
         WHERE user_id = $1
         GROUP BY deck_id
         ORDER BY avg_struggle_score DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        deckId: row.deck_id,
        strugglingCount: parseInt(row.struggling_count, 10),
        avgStruggleScore: parseFloat(row.avg_struggle_score),
        cardIds: row.card_ids || [],
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] getStrugglingCardsByDeck error:", err);
      throw err;
    }
  }

  /**
   * Get recommendation based on struggle type
   * @private
   */
  _getStruggleRecommendation(struggleType) {
    const recommendations = {
      high_fail_rate: "Review the card content and consider breaking it into simpler concepts",
      repeated_lapses: "This card keeps slipping. Try creating a mnemonic or visual association",
      getting_worse: "Performance is declining. Consider revising the card or seeking additional context",
      slow_recall: "Recall is slow. Practice active recall techniques or add retrieval cues",
      moderate_struggle: "Keep practicing. Consider reviewing related concepts",
    };
    return recommendations[struggleType] || recommendations.moderate_struggle;
  }

  // ============================================================
  // PATTERN DETECTION
  // ============================================================

  /**
   * Detect interference patterns (cards confused with each other)
   *
   * @param {string} userId - User ID
   * @param {string|null} deckId - Optional deck filter
   * @returns {Promise<Array>} Interference patterns
   */
  async detectInterferencePatterns(userId, deckId = null) {
    try {
      // Find card pairs reviewed in same session with sequential failures
      const query = `
        WITH session_reviews AS (
          SELECT
            session_id,
            card_id,
            deck_id,
            position_in_session,
            was_correct,
            server_received_at
          FROM review_events
          WHERE user_id = $1
            AND session_id IS NOT NULL
            AND status = 'completed'
            ${deckId ? "AND deck_id = $2" : ""}
        ),
        card_pairs AS (
          SELECT
            r1.card_id AS card_a,
            r2.card_id AS card_b,
            r1.deck_id,
            COUNT(*) AS co_occurrence_count,
            -- Sequential failures (A fails then B fails within 3 positions)
            COUNT(*) FILTER (
              WHERE r1.was_correct = FALSE
                AND r2.was_correct = FALSE
                AND ABS(r1.position_in_session - r2.position_in_session) <= 3
            ) AS sequential_fail_count,
            -- Both failed in same session
            COUNT(DISTINCT r1.session_id) FILTER (
              WHERE r1.was_correct = FALSE AND r2.was_correct = FALSE
            ) AS both_failed_sessions,
            -- One pass one fail (inconsistent pattern)
            COUNT(*) FILTER (
              WHERE (r1.was_correct = TRUE AND r2.was_correct = FALSE)
                 OR (r1.was_correct = FALSE AND r2.was_correct = TRUE)
            ) AS inconsistent_count
          FROM session_reviews r1
          INNER JOIN session_reviews r2 ON r1.session_id = r2.session_id
            AND r1.card_id < r2.card_id  -- Avoid duplicates
          GROUP BY r1.card_id, r2.card_id, r1.deck_id
          HAVING COUNT(*) >= 3  -- Minimum co-occurrence
        )
        SELECT
          card_a,
          card_b,
          deck_id,
          co_occurrence_count,
          sequential_fail_count,
          both_failed_sessions,
          inconsistent_count,
          -- Confusion score: weighted combination
          (sequential_fail_count * 3.0 + both_failed_sessions * 2.0 + inconsistent_count * 1.0) /
            GREATEST(co_occurrence_count, 1) AS confusion_score
        FROM card_pairs
        WHERE sequential_fail_count > 0 OR both_failed_sessions > 0
        ORDER BY confusion_score DESC
        LIMIT 20`;

      const params = deckId ? [userId, deckId] : [userId];
      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        cardA: row.card_a,
        cardB: row.card_b,
        deckId: row.deck_id,
        coOccurrenceCount: parseInt(row.co_occurrence_count, 10),
        sequentialFailCount: parseInt(row.sequential_fail_count, 10),
        bothFailedSessions: parseInt(row.both_failed_sessions, 10),
        inconsistentCount: parseInt(row.inconsistent_count, 10),
        confusionScore: parseFloat(row.confusion_score),
        recommendation: this._getInterferenceRecommendation(row),
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] detectInterferencePatterns error:", err);
      throw err;
    }
  }

  /**
   * Get interference recommendation
   * @private
   */
  _getInterferenceRecommendation(row) {
    const seqFails = parseInt(row.sequential_fail_count, 10);
    const bothFailed = parseInt(row.both_failed_sessions, 10);

    if (seqFails >= 3) {
      return "space_apart";
    } else if (bothFailed >= 2) {
      return "differentiate";
    }
    return "combine";
  }

  /**
   * Detect prerequisite gaps (advanced cards failing while basics pass)
   *
   * @param {string} userId - User ID
   * @param {string|null} deckId - Optional deck filter
   * @returns {Promise<Array>} Prerequisite gaps
   */
  async detectPrerequisiteGaps(userId, deckId = null) {
    try {
      // Use card_analysis complexity levels to detect gaps
      const query = `
        WITH user_card_performance AS (
          SELECT
            re.card_id,
            re.deck_id,
            ca.complexity_level,
            ca.detected_domain,
            ca.extracted_concepts,
            AVG(CASE WHEN re.was_correct THEN 1.0 ELSE 0.0 END) AS success_rate,
            COUNT(*) AS review_count
          FROM review_events re
          LEFT JOIN card_analysis ca ON re.card_id = ca.card_id
          WHERE re.user_id = $1
            AND re.status = 'completed'
            ${deckId ? "AND re.deck_id = $2" : ""}
          GROUP BY re.card_id, re.deck_id, ca.complexity_level, ca.detected_domain, ca.extracted_concepts
          HAVING COUNT(*) >= 3
        ),
        domain_level_stats AS (
          SELECT
            detected_domain,
            complexity_level,
            AVG(success_rate) AS avg_success_rate,
            COUNT(*) AS card_count
          FROM user_card_performance
          WHERE complexity_level IS NOT NULL
          GROUP BY detected_domain, complexity_level
        )
        SELECT
          advanced.detected_domain,
          basic.complexity_level AS basic_level,
          advanced.complexity_level AS advanced_level,
          basic.avg_success_rate AS basic_success_rate,
          advanced.avg_success_rate AS advanced_success_rate,
          (basic.avg_success_rate - advanced.avg_success_rate) AS success_gap,
          advanced.card_count AS advanced_cards_struggling
        FROM domain_level_stats basic
        INNER JOIN domain_level_stats advanced
          ON basic.detected_domain = advanced.detected_domain
        WHERE basic.complexity_level IN ('elementary', 'intermediate')
          AND advanced.complexity_level IN ('advanced', 'expert')
          AND basic.avg_success_rate > advanced.avg_success_rate + 0.2
          AND advanced.card_count >= 2
        ORDER BY (basic.avg_success_rate - advanced.avg_success_rate) DESC`;

      const params = deckId ? [userId, deckId] : [userId];
      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        domain: row.detected_domain,
        basicLevel: row.basic_level,
        advancedLevel: row.advanced_level,
        basicSuccessRate: parseFloat(row.basic_success_rate),
        advancedSuccessRate: parseFloat(row.advanced_success_rate),
        successGap: parseFloat(row.success_gap),
        advancedCardsStruggling: parseInt(row.advanced_cards_struggling, 10),
        recommendation: `Review ${row.basic_level} concepts in ${row.detected_domain} before tackling ${row.advanced_level} material`,
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] detectPrerequisiteGaps error:", err);
      throw err;
    }
  }

  /**
   * Analyze fatigue decay patterns
   *
   * @param {string} userId - User ID
   * @returns {Promise<object>} Fatigue analysis
   */
  async analyzeFatigueDecay(userId) {
    try {
      const result = await this.pool.query(
        `WITH session_fatigue AS (
           SELECT
             session_id,
             cards_completed,
             fatigue_score,
             accuracy_decay,
             pace_decay_pct,
             session_health
           FROM v_session_health_indicators
           WHERE session_id IN (
             SELECT session_id
             FROM session_tracking
             WHERE user_id = $1 AND final_state IN ('completed', 'interrupted')
           )
         ),
         fatigue_onset AS (
           -- Find typical number of cards before significant fatigue
           SELECT
             re.session_id,
             MIN(re.position_in_session) FILTER (
               WHERE bucket_accuracy < 0.7
                 AND bucket_num > 1
             ) AS fatigue_onset_position
           FROM (
             SELECT
               session_id,
               position_in_session,
               NTILE(5) OVER (PARTITION BY session_id ORDER BY position_in_session) AS bucket_num,
               AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) OVER (
                 PARTITION BY session_id, NTILE(5) OVER (PARTITION BY session_id ORDER BY position_in_session)
               ) AS bucket_accuracy
             FROM review_events
             WHERE user_id = $1 AND session_id IS NOT NULL AND status = 'completed'
           ) re
           GROUP BY re.session_id
         )
         SELECT
           COUNT(*) AS sessions_analyzed,
           AVG(sf.cards_completed) AS avg_session_length,
           AVG(sf.fatigue_score) AS avg_fatigue_score,
           AVG(fo.fatigue_onset_position) AS avg_fatigue_onset_cards,
           COUNT(*) FILTER (WHERE sf.session_health = 'fatigued') AS fatigued_sessions,
           COUNT(*) FILTER (WHERE sf.session_health = 'healthy') AS healthy_sessions,
           PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sf.fatigue_score) AS p75_fatigue_score
         FROM session_fatigue sf
         LEFT JOIN fatigue_onset fo ON sf.session_id = fo.session_id`,
        [userId]
      );

      const row = result.rows[0];
      if (!row || parseInt(row.sessions_analyzed, 10) < 3) {
        return {
          status: "insufficient_data",
          message: "Need at least 3 completed sessions for fatigue analysis",
        };
      }

      const avgSessionLength = parseFloat(row.avg_session_length) || 0;
      const avgFatigueOnset = parseFloat(row.avg_fatigue_onset_cards) || avgSessionLength;

      return {
        sessionsAnalyzed: parseInt(row.sessions_analyzed, 10),
        avgSessionLength: Math.round(avgSessionLength),
        avgFatigueScore: parseFloat(row.avg_fatigue_score) || 0,
        avgFatigueOnsetCards: Math.round(avgFatigueOnset),
        fatiguedSessions: parseInt(row.fatigued_sessions, 10),
        healthySessions: parseInt(row.healthy_sessions, 10),
        p75FatigueScore: parseFloat(row.p75_fatigue_score) || 0,
        optimalSessionLength: Math.round(avgFatigueOnset * 0.85), // 85% of typical onset
        recommendation: this._getFatigueRecommendation(row),
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] analyzeFatigueDecay error:", err);
      throw err;
    }
  }

  /**
   * Get fatigue recommendation
   * @private
   */
  _getFatigueRecommendation(row) {
    const avgFatigue = parseFloat(row.avg_fatigue_score) || 0;
    const healthyRatio = parseInt(row.healthy_sessions, 10) / (parseInt(row.sessions_analyzed, 10) || 1);

    if (healthyRatio > 0.7) {
      return "Your session lengths are working well. Keep it up!";
    } else if (avgFatigue > 0.4) {
      return "Consider shorter sessions or taking breaks. Fatigue is affecting your performance.";
    }
    return "Try to maintain consistent session lengths for optimal learning.";
  }

  /**
   * Analyze time-of-day effects on performance
   *
   * @param {string} userId - User ID
   * @returns {Promise<object>} Circadian analysis
   */
  async analyzeTimeOfDayEffects(userId) {
    try {
      const result = await this.pool.query(
        `WITH baseline AS (
           SELECT
             AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) AS overall_accuracy
           FROM review_events
           WHERE user_id = $1 AND status = 'completed'
         ),
         hourly_stats AS (
           SELECT
             local_hour,
             COUNT(*) AS review_count,
             AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) AS accuracy,
             AVG(total_duration_ms) AS avg_response_time
           FROM review_events
           WHERE user_id = $1
             AND status = 'completed'
             AND local_hour IS NOT NULL
           GROUP BY local_hour
           HAVING COUNT(*) >= 10  -- Minimum reviews for statistical validity
         )
         SELECT
           hs.local_hour,
           hs.review_count,
           hs.accuracy,
           hs.avg_response_time,
           (hs.accuracy - b.overall_accuracy) AS accuracy_delta,
           b.overall_accuracy
         FROM hourly_stats hs
         CROSS JOIN baseline b
         ORDER BY hs.local_hour`,
        [userId]
      );

      if (result.rows.length < 3) {
        return {
          status: "insufficient_data",
          message: "Need data from at least 3 different hours for circadian analysis",
        };
      }

      const overallAccuracy = parseFloat(result.rows[0].overall_accuracy) || 0;

      const hourlyPerformance = result.rows.map((row) => ({
        hour: parseInt(row.local_hour, 10),
        reviewCount: parseInt(row.review_count, 10),
        accuracy: parseFloat(row.accuracy),
        avgResponseTimeMs: Math.round(parseFloat(row.avg_response_time)),
        accuracyDelta: parseFloat(row.accuracy_delta),
      }));

      // Find peak and trough hours (>5% deviation from baseline with >=20 reviews)
      const peakHours = hourlyPerformance
        .filter((h) => h.accuracyDelta > 0.05 && h.reviewCount >= 20)
        .sort((a, b) => b.accuracyDelta - a.accuracyDelta)
        .map((h) => h.hour);

      const troughHours = hourlyPerformance
        .filter((h) => h.accuracyDelta < -0.05 && h.reviewCount >= 20)
        .sort((a, b) => a.accuracyDelta - b.accuracyDelta)
        .map((h) => h.hour);

      // Determine optimal study window
      let optimalWindow = null;
      if (peakHours.length > 0) {
        const start = Math.min(...peakHours);
        const end = Math.max(...peakHours);
        optimalWindow = { start, end };
      }

      return {
        overallAccuracy,
        hourlyPerformance,
        peakHours,
        troughHours,
        optimalWindow,
        recommendation: this._getCircadianRecommendation(peakHours, troughHours),
      };
    } catch (err) {
      console.error("[LearningAnalyticsService] analyzeTimeOfDayEffects error:", err);
      throw err;
    }
  }

  /**
   * Get circadian recommendation
   * @private
   */
  _getCircadianRecommendation(peakHours, troughHours) {
    if (peakHours.length === 0 && troughHours.length === 0) {
      return "Your performance is consistent throughout the day. Study whenever convenient!";
    }

    const parts = [];
    if (peakHours.length > 0) {
      const peakRange = peakHours.length > 1
        ? `${peakHours[0]}:00-${peakHours[peakHours.length - 1] + 1}:00`
        : `around ${peakHours[0]}:00`;
      parts.push(`Your best performance is ${peakRange}`);
    }

    if (troughHours.length > 0) {
      const troughRange = troughHours.length > 1
        ? `${troughHours[0]}:00-${troughHours[troughHours.length - 1] + 1}:00`
        : `around ${troughHours[0]}:00`;
      parts.push(`Avoid studying ${troughRange} if possible`);
    }

    return parts.join(". ") + ".";
  }

  // ============================================================
  // DAILY SUMMARY (from materialized view)
  // ============================================================

  /**
   * Get daily learning summary for a user
   *
   * @param {string} userId - User ID
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<Array>} Daily summaries
   */
  async getDailySummary(userId, days = 30) {
    try {
      const result = await this.pool.query(
        `SELECT *
         FROM mv_daily_learning_summary
         WHERE user_id = $1
           AND study_date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY study_date DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        studyDate: row.study_date,
        reviewsCompleted: parseInt(row.reviews_completed, 10),
        uniqueCards: parseInt(row.unique_cards, 10),
        correctCount: parseInt(row.correct_count, 10),
        totalStudyTimeMs: parseInt(row.total_study_time_ms, 10),
        sessions: parseInt(row.sessions, 10),
        peakStudyHour: row.peak_study_hour,
        accuracy: parseInt(row.reviews_completed, 10) > 0
          ? parseInt(row.correct_count, 10) / parseInt(row.reviews_completed, 10)
          : 0,
      }));
    } catch (err) {
      console.error("[LearningAnalyticsService] getDailySummary error:", err);
      throw err;
    }
  }
}

export default LearningAnalyticsService;
