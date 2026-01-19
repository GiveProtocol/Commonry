-- Migration: Create session_tracking table for robust session tracking
-- This enables session-level analytics, heartbeat-based liveness detection,
-- and provides context for review_events.
-- Note: String duplication for ENUM values and JSONB defaults is intentional in DDL (S1192)
--
-- Design principles:
-- - Sessions are the unit of study analysis (one sitting)
-- - Heartbeat mechanism detects abandonment (5-minute timeout)
-- - Break tracking captures pauses (background, manual, idle)
-- - Statistics computed on session close from review_events

BEGIN;

-- Drop types if they exist (for re-running migration during development)
DROP TYPE IF EXISTS session_type CASCADE;
DROP TYPE IF EXISTS session_state CASCADE;

-- Session type enum
CREATE TYPE session_type AS ENUM (
    'regular',      -- Normal daily review
    'diagnostic',   -- Initial assessment
    'cram',         -- Quick pre-exam review
    'speed_review', -- Fast-paced recall practice
    'learn_new'     -- Focus on new cards only
);

-- Session state enum -- NOSONAR: ENUM values must be string literals
CREATE TYPE session_state AS ENUM (
    'in_progress',  -- Active session
    'completed',    -- User explicitly finished
    'abandoned',    -- No heartbeat for timeout period
    'interrupted'   -- App crash/browser close detected
);

-- Main session_tracking table
CREATE TABLE session_tracking (
    -- ============================================================
    -- IDENTITY
    -- ============================================================

    -- Primary key with prefixed ULID (ses_)
    session_id VARCHAR(30) PRIMARY KEY,

    -- User reference
    user_id VARCHAR(30) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- ============================================================
    -- TIMING
    -- ============================================================

    -- Session lifecycle timestamps
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- For abandonment detection (updated every 30s by client heartbeat)
    last_heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Total active study time (excludes breaks/background time)
    total_active_time_ms INTEGER DEFAULT 0,

    -- ============================================================
    -- SESSION CONFIGURATION
    -- ============================================================

    session_type session_type NOT NULL DEFAULT 'regular',

    -- Which deck is being studied (NULL = mixed/all decks)
    deck_id VARCHAR(30),

    -- Session goals (set at start)
    cards_planned INTEGER,
    target_duration_minutes INTEGER,

    -- ============================================================
    -- DEVICE & CONTEXT
    -- ============================================================

    -- Device/client info (captured at session start)
    device_type device_type DEFAULT 'unknown',
    client_version VARCHAR(20),
    platform VARCHAR(50),
    user_agent TEXT,

    -- Local time context for circadian analysis
    local_hour_started SMALLINT CHECK (local_hour_started >= 0 AND local_hour_started <= 23),
    local_day_of_week SMALLINT CHECK (local_day_of_week >= 0 AND local_day_of_week <= 6),
    timezone_offset_minutes SMALLINT,

    -- ============================================================
    -- SESSION PROGRESS
    -- ============================================================

    -- Card counts
    cards_completed INTEGER DEFAULT 0,
    cards_correct INTEGER DEFAULT 0,
    cards_again INTEGER DEFAULT 0,  -- Rating 1 count
    cards_hard INTEGER DEFAULT 0,   -- Rating 2 count
    cards_good INTEGER DEFAULT 0,   -- Rating 3 count
    cards_easy INTEGER DEFAULT 0,   -- Rating 4 count

    -- New vs review breakdown
    new_cards_completed INTEGER DEFAULT 0,
    review_cards_completed INTEGER DEFAULT 0,

    -- ============================================================
    -- BREAK TRACKING
    -- ============================================================

    -- JSONB array of breaks: [{"startMs": 1234, "endMs": 5678, "reason": "background"}, ...]
    breaks JSONB DEFAULT '[]',

    -- Total break time
    total_break_time_ms INTEGER DEFAULT 0,

    -- ============================================================
    -- SESSION-LEVEL STATISTICS (computed on close)
    -- ============================================================

    -- Final state
    final_state session_state NOT NULL DEFAULT 'in_progress', -- NOSONAR: references session_state enum

    -- Accuracy (0.0000 - 1.0000)
    accuracy_rate DECIMAL(5,4),

    -- Response time statistics (in milliseconds)
    avg_response_time_ms INTEGER,
    median_response_time_ms INTEGER,
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,

    -- Response time trend (linear regression: negative slope = getting faster)
    -- Format: {"slope": -0.5, "rSquared": 0.8, "sampleCount": 25}
    response_time_trend JSONB,

    -- Fatigue indicators (0.000 - 1.000, computed from pace changes + accuracy decline)
    fatigue_score DECIMAL(4,3),

    -- Difficulty distribution (percentage of cards at each state)
    -- Format: {"new": 0.3, "learning": 0.2, "review": 0.4, "relearning": 0.1}
    difficulty_distribution JSONB,

    -- ============================================================
    -- TIMESTAMPS & METADATA
    -- ============================================================

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Primary lookup patterns
CREATE INDEX idx_session_tracking_user_id ON session_tracking(user_id);
CREATE INDEX idx_session_tracking_deck_id ON session_tracking(deck_id) WHERE deck_id IS NOT NULL;

-- Time-based queries
CREATE INDEX idx_session_tracking_started_at ON session_tracking(started_at);
CREATE INDEX idx_session_tracking_user_started ON session_tracking(user_id, started_at);

-- State-based queries (for finding active/abandoned sessions)
CREATE INDEX idx_session_tracking_state ON session_tracking(final_state);
CREATE INDEX idx_session_tracking_active ON session_tracking(user_id, final_state, last_heartbeat_at)
    WHERE final_state = 'in_progress'; -- NOSONAR: partial index on enum value

-- For abandonment detection job (find sessions with stale heartbeats)
CREATE INDEX idx_session_tracking_heartbeat ON session_tracking(last_heartbeat_at)
    WHERE final_state = 'in_progress'; -- NOSONAR: partial index on enum value

-- Session type analysis
CREATE INDEX idx_session_tracking_type ON session_tracking(user_id, session_type, started_at);

-- ============================================================
-- ADD FOREIGN KEY TO review_events
-- ============================================================

-- Add foreign key constraint to review_events.session_id
-- ON DELETE SET NULL: if session is deleted, review events remain but lose session link
ALTER TABLE review_events
    ADD CONSTRAINT fk_review_events_session
    FOREIGN KEY (session_id) REFERENCES session_tracking(session_id)
    ON DELETE SET NULL;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update last_heartbeat_at efficiently (called every 30s)
CREATE OR REPLACE FUNCTION update_session_heartbeat(
    p_session_id VARCHAR(30),
    p_user_id VARCHAR(30)
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE session_tracking
    SET
        last_heartbeat_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND final_state = 'in_progress'; -- NOSONAR: enum value

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to mark sessions as abandoned (run periodically by server)
CREATE OR REPLACE FUNCTION mark_abandoned_sessions(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
    abandoned_count INTEGER;
BEGIN
    UPDATE session_tracking
    SET
        final_state = 'abandoned',
        ended_at = last_heartbeat_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE final_state = 'in_progress' -- NOSONAR: enum value
      AND last_heartbeat_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS abandoned_count = ROW_COUNT;
    RETURN abandoned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to compute session statistics from review_events on close
CREATE OR REPLACE FUNCTION compute_session_statistics(
    p_session_id VARCHAR(30)
)
RETURNS VOID AS $$
DECLARE
    v_cards_completed INTEGER;
    v_cards_correct INTEGER;
    v_cards_again INTEGER;
    v_cards_hard INTEGER;
    v_cards_good INTEGER;
    v_cards_easy INTEGER;
    v_new_cards INTEGER;
    v_review_cards INTEGER;
    v_avg_response INTEGER;
    v_median_response INTEGER;
    v_min_response INTEGER;
    v_max_response INTEGER;
    v_accuracy DECIMAL(5,4);
    v_difficulty_dist JSONB;
BEGIN
    -- Aggregate statistics from completed review_events for this session
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE was_correct = TRUE),
        COUNT(*) FILTER (WHERE rating = 1),
        COUNT(*) FILTER (WHERE rating = 2),
        COUNT(*) FILTER (WHERE rating = 3),
        COUNT(*) FILTER (WHERE rating = 4),
        COUNT(*) FILTER (WHERE card_state_before = 'new'), -- NOSONAR: card_state enum
        COUNT(*) FILTER (WHERE card_state_before IN ('learning', 'review', 'relearning')), -- NOSONAR: card_state enum values
        AVG(total_duration_ms)::INTEGER,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_duration_ms)::INTEGER,
        MIN(total_duration_ms),
        MAX(total_duration_ms)
    INTO
        v_cards_completed,
        v_cards_correct,
        v_cards_again,
        v_cards_hard,
        v_cards_good,
        v_cards_easy,
        v_new_cards,
        v_review_cards,
        v_avg_response,
        v_median_response,
        v_min_response,
        v_max_response
    FROM review_events
    WHERE session_id = p_session_id
      AND status = 'completed'; -- NOSONAR: review_event_status enum

    -- Calculate accuracy
    IF v_cards_completed > 0 THEN
        v_accuracy := v_cards_correct::DECIMAL / v_cards_completed;
    ELSE
        v_accuracy := NULL;
    END IF;

    -- Calculate difficulty distribution -- NOSONAR: card_state enum values used as JSON keys and filter values
    SELECT jsonb_build_object(
        'new', COALESCE(COUNT(*) FILTER (WHERE card_state_before = 'new')::DECIMAL / NULLIF(COUNT(*), 0), 0),
        'learning', COALESCE(COUNT(*) FILTER (WHERE card_state_before = 'learning')::DECIMAL / NULLIF(COUNT(*), 0), 0),
        'review', COALESCE(COUNT(*) FILTER (WHERE card_state_before = 'review')::DECIMAL / NULLIF(COUNT(*), 0), 0),
        'relearning', COALESCE(COUNT(*) FILTER (WHERE card_state_before = 'relearning')::DECIMAL / NULLIF(COUNT(*), 0), 0)
    )
    INTO v_difficulty_dist
    FROM review_events
    WHERE session_id = p_session_id
      AND status = 'completed';

    -- Update session with computed statistics
    UPDATE session_tracking
    SET
        cards_completed = COALESCE(v_cards_completed, cards_completed),
        cards_correct = COALESCE(v_cards_correct, cards_correct),
        cards_again = COALESCE(v_cards_again, cards_again),
        cards_hard = COALESCE(v_cards_hard, cards_hard),
        cards_good = COALESCE(v_cards_good, cards_good),
        cards_easy = COALESCE(v_cards_easy, cards_easy),
        new_cards_completed = COALESCE(v_new_cards, new_cards_completed),
        review_cards_completed = COALESCE(v_review_cards, review_cards_completed),
        accuracy_rate = v_accuracy,
        avg_response_time_ms = v_avg_response,
        median_response_time_ms = v_median_response,
        min_response_time_ms = v_min_response,
        max_response_time_ms = v_max_response,
        difficulty_distribution = v_difficulty_dist,
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER for updated_at
-- ============================================================

-- Reuse existing update_updated_at_column function if it exists,
-- otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_tracking_updated_at
    BEFORE UPDATE ON session_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE session_tracking IS 'Tracks study session lifecycle with heartbeat-based liveness detection and session-level analytics. Sessions provide context for review_events.';

COMMENT ON COLUMN session_tracking.session_id IS 'Prefixed ULID: ses_01HXXXXXXXXXXXXXXXXXXXXXXX';
COMMENT ON COLUMN session_tracking.last_heartbeat_at IS 'Updated every 30s by client heartbeat. Sessions without heartbeat for 5min are marked abandoned.';
COMMENT ON COLUMN session_tracking.breaks IS 'Array of break periods: [{"startMs": 1234, "endMs": 5678, "reason": "background|pause|idle|manual"}]';
COMMENT ON COLUMN session_tracking.response_time_trend IS 'Linear regression on response times: {"slope": -0.5, "rSquared": 0.8, "sampleCount": 25}. Negative slope = getting faster.';
COMMENT ON COLUMN session_tracking.fatigue_score IS 'Computed from pace decline and accuracy changes. 0.000=fresh, 1.000=fatigued';
COMMENT ON COLUMN session_tracking.difficulty_distribution IS 'Percentage of cards at each state: {"new": 0.3, "learning": 0.2, "review": 0.4, "relearning": 0.1}';

COMMIT;
