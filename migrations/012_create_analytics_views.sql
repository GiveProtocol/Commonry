-- Migration: Create analytics views for learning pattern detection
-- This enables AI-powered diagnosis of learning patterns including velocity tracking,
-- session patterns, struggling cards, card difficulty, and session health indicators.
--
-- Design principles:
-- - Views for real-time queries, materialized view for dashboard summaries
-- - Statistical validity: require minimum sample sizes for metrics
-- - Fail gracefully: NULL for insufficient data rather than misleading metrics

BEGIN;

-- ============================================================
-- INDEXES for analytics queries (add before views)
-- ============================================================

-- For velocity calculations (weekly aggregates)
-- Note: Cannot use date_trunc directly in index (not immutable for timestamptz)
-- The view will use sequential scan on user_id which is already indexed
CREATE INDEX IF NOT EXISTS idx_review_events_user_completed
    ON review_events(user_id, server_received_at)
    WHERE status = 'completed';

-- For struggle detection (user+card fail patterns)
CREATE INDEX IF NOT EXISTS idx_review_events_user_card_correct
    ON review_events(user_id, card_id, was_correct, server_received_at)
    WHERE status = 'completed';

-- For card difficulty (cross-user analysis)
CREATE INDEX IF NOT EXISTS idx_review_events_card_correct
    ON review_events(card_id, was_correct)
    WHERE status = 'completed';

-- For session health (position-based analysis)
CREATE INDEX IF NOT EXISTS idx_review_events_session_position
    ON review_events(session_id, position_in_session)
    WHERE session_id IS NOT NULL AND status = 'completed';

-- ============================================================
-- VIEW: v_user_learning_velocity
-- Tracks cards mastered per week with trend analysis
-- ============================================================

CREATE OR REPLACE VIEW v_user_learning_velocity AS
WITH weekly_stats AS (
    SELECT
        re.user_id,
        date_trunc('week', re.server_received_at) AS week_start,
        -- Cards mastered = reached 21+ day interval
        COUNT(DISTINCT re.card_id) FILTER (
            WHERE re.interval_after_days >= 21 AND re.interval_before_days < 21
        ) AS cards_mastered,
        -- New cards learned (first review)
        COUNT(DISTINCT re.card_id) FILTER (
            WHERE re.card_state_before = 'new'
        ) AS new_cards_learned,
        COUNT(*) AS total_reviews,
        COUNT(*) FILTER (WHERE re.was_correct = TRUE) AS correct_reviews
    FROM review_events re
    WHERE re.status = 'completed'
    GROUP BY re.user_id, date_trunc('week', re.server_received_at)
),
with_rolling_avg AS (
    SELECT
        ws.*,
        AVG(ws.cards_mastered) OVER (
            PARTITION BY ws.user_id
            ORDER BY ws.week_start
            ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
        ) AS rolling_4week_avg,
        LAG(ws.cards_mastered) OVER (
            PARTITION BY ws.user_id ORDER BY ws.week_start
        ) AS prev_week_mastered,
        -- Month over month: compare to 4 weeks ago
        LAG(ws.cards_mastered, 4) OVER (
            PARTITION BY ws.user_id ORDER BY ws.week_start
        ) AS month_ago_mastered
    FROM weekly_stats ws
)
SELECT
    user_id,
    week_start,
    cards_mastered,
    new_cards_learned,
    total_reviews,
    correct_reviews,
    ROUND(rolling_4week_avg::NUMERIC, 2) AS rolling_4week_avg,
    -- Velocity trend (±20% threshold)
    CASE
        WHEN prev_week_mastered IS NULL THEN 'stable'
        WHEN cards_mastered > prev_week_mastered * 1.2 THEN 'accelerating'
        WHEN cards_mastered < prev_week_mastered * 0.8 THEN 'decelerating'
        ELSE 'stable'
    END AS velocity_trend,
    -- Month over month change percentage
    CASE
        WHEN month_ago_mastered IS NULL OR month_ago_mastered = 0 THEN NULL
        ELSE ROUND(((cards_mastered - month_ago_mastered)::NUMERIC / month_ago_mastered) * 100, 1)
    END AS month_over_month_change_pct
FROM with_rolling_avg;

COMMENT ON VIEW v_user_learning_velocity IS 'Tracks cards mastered per week with trend analysis. "Mastered" = card reaches 21+ day interval.';

-- ============================================================
-- VIEW: v_user_session_patterns
-- Aggregated session behavior per user
-- ============================================================

CREATE OR REPLACE VIEW v_user_session_patterns AS
WITH session_stats AS (
    SELECT
        st.user_id,
        COUNT(*) AS total_sessions,
        COUNT(DISTINCT DATE(st.started_at)) AS total_study_days,
        AVG(st.total_active_time_ms) / 60000.0 AS avg_session_minutes,
        AVG(st.cards_completed) AS avg_cards_per_session,
        -- Device breakdown
        COUNT(*) FILTER (WHERE st.device_type = 'mobile') AS mobile_sessions,
        COUNT(*) FILTER (WHERE st.device_type = 'desktop') AS desktop_sessions,
        COUNT(*) FILTER (WHERE st.device_type = 'tablet') AS tablet_sessions
    FROM session_tracking st
    WHERE st.final_state IN ('completed', 'interrupted')
        AND st.started_at >= NOW() - INTERVAL '90 days'
    GROUP BY st.user_id
),
hour_analysis AS (
    SELECT
        st.user_id,
        st.local_hour_started,
        COUNT(*) AS session_count
    FROM session_tracking st
    WHERE st.final_state IN ('completed', 'interrupted')
        AND st.started_at >= NOW() - INTERVAL '90 days'
        AND st.local_hour_started IS NOT NULL
    GROUP BY st.user_id, st.local_hour_started
),
preferred_hour AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        local_hour_started AS preferred_hour
    FROM hour_analysis
    ORDER BY user_id, session_count DESC
),
day_analysis AS (
    SELECT
        st.user_id,
        st.local_day_of_week,
        COUNT(*) AS session_count
    FROM session_tracking st
    WHERE st.final_state IN ('completed', 'interrupted')
        AND st.started_at >= NOW() - INTERVAL '90 days'
        AND st.local_day_of_week IS NOT NULL
    GROUP BY st.user_id, st.local_day_of_week
),
preferred_day AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        local_day_of_week AS preferred_day
    FROM day_analysis
    ORDER BY user_id, session_count DESC
),
active_hours AS (
    SELECT
        user_id,
        ARRAY_AGG(local_hour_started ORDER BY session_count DESC) AS active_hours
    FROM hour_analysis
    WHERE session_count >= 2
    GROUP BY user_id
),
consistency AS (
    SELECT
        user_id,
        COUNT(DISTINCT DATE(started_at))::NUMERIC /
            GREATEST(1, (MAX(DATE(started_at)) - MIN(DATE(started_at)) + 1))::NUMERIC AS consistency_ratio
    FROM session_tracking
    WHERE final_state IN ('completed', 'interrupted')
        AND started_at >= NOW() - INTERVAL '90 days'
    GROUP BY user_id
)
SELECT
    ss.user_id,
    ph.preferred_hour,
    pd.preferred_day,
    ah.active_hours,
    ROUND(ss.avg_session_minutes::NUMERIC, 1) AS avg_session_minutes,
    ROUND(ss.avg_cards_per_session::NUMERIC, 1) AS avg_cards_per_session,
    ROUND(c.consistency_ratio::NUMERIC, 3) AS consistency_ratio,
    ss.total_study_days,
    ss.total_sessions,
    -- Session style based on avg session length
    CASE
        WHEN ss.avg_session_minutes < 5 THEN 'quick_review'
        WHEN ss.avg_session_minutes < 15 THEN 'focused'
        WHEN ss.avg_session_minutes < 30 THEN 'extended'
        ELSE 'marathon'
    END AS session_style,
    -- Learner type based on preferred hour
    CASE
        WHEN ph.preferred_hour BETWEEN 5 AND 11 THEN 'morning_learner'
        WHEN ph.preferred_hour BETWEEN 12 AND 16 THEN 'afternoon_learner'
        WHEN ph.preferred_hour BETWEEN 17 AND 20 THEN 'evening_learner'
        ELSE 'night_owl'
    END AS learner_type,
    ss.mobile_sessions,
    ss.desktop_sessions,
    ss.tablet_sessions
FROM session_stats ss
LEFT JOIN preferred_hour ph ON ss.user_id = ph.user_id
LEFT JOIN preferred_day pd ON ss.user_id = pd.user_id
LEFT JOIN active_hours ah ON ss.user_id = ah.user_id
LEFT JOIN consistency c ON ss.user_id = c.user_id;

COMMENT ON VIEW v_user_session_patterns IS 'Aggregated session behavior per user including preferred study times, session style, and device preferences.';

-- ============================================================
-- VIEW: v_user_struggle_indicators
-- Identifies struggling cards per user
-- ============================================================

CREATE OR REPLACE VIEW v_user_struggle_indicators AS
WITH ranked_reviews AS (
    SELECT
        re.user_id,
        re.card_id,
        re.deck_id,
        re.was_correct,
        re.rating,
        re.total_duration_ms,
        re.lapse_count,
        ROW_NUMBER() OVER (
            PARTITION BY re.user_id, re.card_id
            ORDER BY re.server_received_at
        ) AS review_num,
        COUNT(*) OVER (PARTITION BY re.user_id, re.card_id) AS total_reviews
    FROM review_events re
    WHERE re.status = 'completed'
),
card_stats AS (
    SELECT
        user_id,
        card_id,
        deck_id,
        MAX(total_reviews) AS review_count,
        COUNT(*) FILTER (WHERE was_correct = FALSE) AS fail_count,
        COUNT(*) FILTER (WHERE rating = 1) AS again_count,
        AVG(total_duration_ms) AS avg_time_ms,
        SUM(lapse_count) AS total_lapses,
        -- Check if improving: compare first half vs second half success rate
        AVG(CASE WHEN review_num <= total_reviews / 2
            THEN CASE WHEN was_correct THEN 1.0 ELSE 0.0 END
        END) AS first_half_accuracy,
        AVG(CASE WHEN review_num > total_reviews / 2
            THEN CASE WHEN was_correct THEN 1.0 ELSE 0.0 END
        END) AS second_half_accuracy
    FROM ranked_reviews
    GROUP BY user_id, card_id, deck_id
    HAVING MAX(total_reviews) >= 3  -- Minimum reviews for statistical validity
),
with_metrics AS (
    SELECT
        cs.*,
        cs.fail_count::NUMERIC / NULLIF(cs.review_count, 0) AS fail_rate,
        COALESCE(cs.second_half_accuracy, 0) - COALESCE(cs.first_half_accuracy, 0) AS improvement_correlation,
        -- Struggle score (0-1): weighted combination
        -- 40% fail rate + 30% lapse impact + 30% no improvement penalty
        LEAST(1.0,
            (cs.fail_count::NUMERIC / NULLIF(cs.review_count, 0)) * 0.4 +
            LEAST(1.0, COALESCE(cs.total_lapses, 0)::NUMERIC / 10.0) * 0.3 +
            CASE
                WHEN cs.second_half_accuracy IS NOT NULL AND cs.first_half_accuracy IS NOT NULL
                    AND cs.second_half_accuracy <= cs.first_half_accuracy
                THEN 0.3
                ELSE 0.0
            END
        ) AS struggle_score
    FROM card_stats cs
)
SELECT
    user_id,
    card_id,
    deck_id,
    review_count,
    fail_count,
    again_count,
    ROUND(avg_time_ms::NUMERIC, 0) AS avg_time_ms,
    total_lapses,
    ROUND(improvement_correlation::NUMERIC, 3) AS improvement_correlation,
    ROUND(struggle_score::NUMERIC, 3) AS struggle_score,
    -- Struggle type classification
    CASE
        WHEN fail_rate > 0.5 THEN 'high_fail_rate'
        WHEN COALESCE(total_lapses, 0) >= 3 THEN 'repeated_lapses'
        WHEN improvement_correlation < 0 THEN 'getting_worse'
        WHEN avg_time_ms > 10000 THEN 'slow_recall'
        ELSE 'moderate_struggle'
    END AS struggle_type
FROM with_metrics
WHERE struggle_score >= 0.3;  -- Only include cards with meaningful struggle

COMMENT ON VIEW v_user_struggle_indicators IS 'Identifies struggling cards per user. Struggle score combines fail rate, lapses, and improvement trends.';

-- ============================================================
-- VIEW: v_card_difficulty_metrics
-- Cross-user difficulty analysis
-- ============================================================

CREATE OR REPLACE VIEW v_card_difficulty_metrics AS
WITH card_global_stats AS (
    SELECT
        re.card_id,
        COUNT(DISTINCT re.user_id) AS unique_users,
        COUNT(*) AS total_reviews,
        AVG(CASE WHEN re.was_correct THEN 1.0 ELSE 0.0 END) AS global_success_rate,
        STDDEV(CASE WHEN re.was_correct THEN 1.0 ELSE 0.0 END) AS success_rate_variance,
        AVG(re.total_duration_ms) AS avg_response_time_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY re.total_duration_ms) AS median_response_ms
    FROM review_events re
    WHERE re.status = 'completed'
    GROUP BY re.card_id
    HAVING COUNT(DISTINCT re.user_id) >= 2 AND COUNT(*) >= 5  -- Statistical validity
),
with_percentiles AS (
    SELECT
        cgs.*,
        PERCENT_RANK() OVER (ORDER BY cgs.global_success_rate DESC) AS difficulty_percentile
    FROM card_global_stats cgs
)
SELECT
    card_id,
    unique_users,
    total_reviews,
    ROUND(global_success_rate::NUMERIC, 3) AS global_success_rate,
    ROUND(success_rate_variance::NUMERIC, 4) AS success_rate_variance,
    ROUND(avg_response_time_ms::NUMERIC, 0) AS avg_response_time_ms,
    ROUND(median_response_ms::NUMERIC, 0) AS median_response_ms,
    ROUND(difficulty_percentile::NUMERIC, 3) AS difficulty_percentile,
    -- Difficulty classification
    CASE
        WHEN global_success_rate >= 0.95 THEN 'trivial'
        WHEN global_success_rate >= 0.85 THEN 'easy'
        WHEN global_success_rate >= 0.70 THEN 'moderate'
        WHEN global_success_rate >= 0.50 THEN 'hard'
        ELSE 'very_hard'
    END AS difficulty_class,
    -- Consistency classification (based on variance across users)
    CASE
        WHEN success_rate_variance IS NULL OR success_rate_variance < 0.2 THEN 'consistent'
        ELSE 'inconsistent'
    END AS consistency_class
FROM with_percentiles;

COMMENT ON VIEW v_card_difficulty_metrics IS 'Cross-user difficulty analysis. Requires >=2 users and >=5 reviews for statistical validity.';

-- ============================================================
-- VIEW: v_session_health_indicators
-- Session fatigue and performance decay
-- ============================================================

CREATE OR REPLACE VIEW v_session_health_indicators AS
WITH session_quarters AS (
    SELECT
        re.session_id,
        re.position_in_session,
        re.was_correct,
        re.total_duration_ms,
        NTILE(4) OVER (PARTITION BY re.session_id ORDER BY re.position_in_session) AS quarter,
        COUNT(*) OVER (PARTITION BY re.session_id) AS cards_in_session
    FROM review_events re
    WHERE re.session_id IS NOT NULL
        AND re.status = 'completed'
        AND re.position_in_session IS NOT NULL
),
quarter_stats AS (
    SELECT
        session_id,
        quarter,
        MAX(cards_in_session) AS cards_completed,
        AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) AS quarter_accuracy,
        AVG(total_duration_ms) AS quarter_avg_time
    FROM session_quarters
    GROUP BY session_id, quarter
),
session_analysis AS (
    SELECT
        qs.session_id,
        MAX(qs.cards_completed) AS cards_completed,
        -- Overall session accuracy
        AVG(qs.quarter_accuracy) AS final_accuracy,
        -- Q1 vs Q4 comparison
        MAX(CASE WHEN qs.quarter = 1 THEN qs.quarter_accuracy END) AS q1_accuracy,
        MAX(CASE WHEN qs.quarter = 4 THEN qs.quarter_accuracy END) AS q4_accuracy,
        MAX(CASE WHEN qs.quarter = 1 THEN qs.quarter_avg_time END) AS q1_avg_time,
        MAX(CASE WHEN qs.quarter = 4 THEN qs.quarter_avg_time END) AS q4_avg_time
    FROM quarter_stats qs
    GROUP BY qs.session_id
    HAVING COUNT(DISTINCT qs.quarter) >= 2  -- Need at least 2 quarters for comparison
)
SELECT
    session_id,
    cards_completed,
    ROUND(final_accuracy::NUMERIC, 3) AS final_accuracy,
    -- Fatigue score: combination of accuracy decay and pace slowdown
    ROUND(LEAST(1.0,
        GREATEST(0.0, COALESCE(q1_accuracy - q4_accuracy, 0)) * 0.6 +
        GREATEST(0.0, LEAST(0.4, COALESCE((q4_avg_time - q1_avg_time) / NULLIF(q1_avg_time, 0), 0) * 0.4))
    )::NUMERIC, 3) AS fatigue_score,
    ROUND(q1_accuracy::NUMERIC, 3) AS q1_accuracy,
    ROUND(q4_accuracy::NUMERIC, 3) AS q4_accuracy,
    -- Accuracy decay (positive = getting worse)
    ROUND((COALESCE(q1_accuracy, 0) - COALESCE(q4_accuracy, 0))::NUMERIC, 3) AS accuracy_decay,
    -- Pace decay percentage (positive = slowing down)
    ROUND(CASE
        WHEN q1_avg_time IS NOT NULL AND q1_avg_time > 0
        THEN ((q4_avg_time - q1_avg_time) / q1_avg_time * 100)
        ELSE 0
    END::NUMERIC, 1) AS pace_decay_pct,
    -- Session health classification
    CASE
        WHEN COALESCE(q1_accuracy - q4_accuracy, 0) <= 0.05
            AND COALESCE((q4_avg_time - q1_avg_time) / NULLIF(q1_avg_time, 0), 0) <= 0.1
        THEN 'healthy'
        WHEN COALESCE(q1_accuracy - q4_accuracy, 0) <= 0.10
            AND COALESCE((q4_avg_time - q1_avg_time) / NULLIF(q1_avg_time, 0), 0) <= 0.2
        THEN 'slowing'
        WHEN COALESCE(q1_accuracy - q4_accuracy, 0) <= 0.15
        THEN 'declining'
        ELSE 'fatigued'
    END AS session_health
FROM session_analysis;

COMMENT ON VIEW v_session_health_indicators IS 'Session fatigue and performance decay. Compares first vs last quarter accuracy and pace.';

-- ============================================================
-- MATERIALIZED VIEW: mv_daily_learning_summary
-- Daily aggregates for dashboards (refresh nightly)
-- ============================================================

CREATE MATERIALIZED VIEW mv_daily_learning_summary AS
SELECT
    re.user_id,
    DATE(re.server_received_at) AS study_date,
    COUNT(*) AS reviews_completed,
    COUNT(DISTINCT re.card_id) AS unique_cards,
    COUNT(*) FILTER (WHERE re.was_correct = TRUE) AS correct_count,
    SUM(re.total_duration_ms) AS total_study_time_ms,
    COUNT(DISTINCT re.session_id) AS sessions,
    -- Peak study hour (mode of local_hour)
    MODE() WITHIN GROUP (ORDER BY re.local_hour) AS peak_study_hour
FROM review_events re
WHERE re.status = 'completed'
GROUP BY re.user_id, DATE(re.server_received_at);

-- Create unique index for efficient refresh
CREATE UNIQUE INDEX idx_mv_daily_learning_summary_pk
    ON mv_daily_learning_summary(user_id, study_date);

-- Additional indexes for querying
CREATE INDEX idx_mv_daily_learning_summary_date
    ON mv_daily_learning_summary(study_date);

CREATE INDEX idx_mv_daily_learning_summary_user_date
    ON mv_daily_learning_summary(user_id, study_date DESC);

COMMENT ON MATERIALIZED VIEW mv_daily_learning_summary IS 'Daily learning aggregates for dashboards. Refresh nightly with REFRESH MATERIALIZED VIEW CONCURRENTLY.';

-- ============================================================
-- FUNCTION: Refresh daily summary (call from cron/scheduler)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_daily_learning_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_learning_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_daily_learning_summary IS 'Refreshes mv_daily_learning_summary. Should be called nightly by scheduler.';

COMMIT;
