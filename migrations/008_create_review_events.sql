-- Migration: Create enriched review_events table for analytics
-- This is an append-only event log optimized for ML/analytics, separate from study_sessions
--
-- Design principles:
-- - Capture generously: storage is cheap, missing data is forever
-- - Support streaming: events start incomplete and are enriched over time
-- - Fail gracefully: review capture should never break the review experience

BEGIN;

-- Drop types if they exist (for re-running migration during development)
DROP TYPE IF EXISTS response_type CASCADE;
DROP TYPE IF EXISTS device_type CASCADE;
DROP TYPE IF EXISTS card_state CASCADE;
DROP TYPE IF EXISTS review_event_status CASCADE;

-- Response type enum
CREATE TYPE response_type AS ENUM ('self_rating', 'typed_response', 'multiple_choice', 'cloze_fill');

-- Device type enum
CREATE TYPE device_type AS ENUM ('mobile', 'tablet', 'desktop', 'unknown');

-- Card state enum (matches existing card states)
CREATE TYPE card_state AS ENUM ('new', 'learning', 'review', 'relearning');

-- Review event lifecycle status
CREATE TYPE review_event_status AS ENUM ('started', 'interacting', 'completed', 'abandoned');

-- Main review events table
CREATE TABLE review_events (
    -- ============================================================
    -- IDENTITY
    -- ============================================================

    -- Primary key with prefixed ULID (evt_)
    event_id VARCHAR(30) PRIMARY KEY,

    -- Core references
    user_id VARCHAR(30) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_id VARCHAR(30) NOT NULL,  -- No FK constraint - cards may be deleted but events persist
    deck_id VARCHAR(30) NOT NULL,  -- Denormalized for faster queries
    session_id VARCHAR(30),        -- Groups reviews in a single study session (ses_)

    -- Event lifecycle status
    status review_event_status NOT NULL DEFAULT 'started',

    -- Outcome (NULL until completed)
    rating SMALLINT CHECK (rating BETWEEN 1 AND 4),
    was_correct BOOLEAN,  -- Set to (rating >= 3) on completion

    -- ============================================================
    -- TIMING DATA
    -- ============================================================

    -- Time from card shown to first user interaction (touch, click, keypress)
    time_to_first_interaction_ms INTEGER,

    -- Time from first interaction to final answer submission
    time_to_answer_ms INTEGER,

    -- Total time card was visible (NULL until completed)
    total_duration_ms INTEGER,

    -- For self-rating: time between showing answer and selecting rating
    hesitation_before_rating_ms INTEGER,

    -- ============================================================
    -- SESSION CONTEXT
    -- ============================================================

    -- Position of this card in the current session (1-indexed)
    position_in_session SMALLINT,

    -- Cumulative time since session started
    time_since_session_start_ms INTEGER,

    -- Local time context (for circadian pattern analysis)
    local_hour SMALLINT CHECK (local_hour >= 0 AND local_hour <= 23),
    local_day_of_week SMALLINT CHECK (local_day_of_week >= 0 AND local_day_of_week <= 6),
    timezone_offset_minutes SMALLINT,  -- UTC offset in minutes

    -- Preceding cards context (last 3-5 cards reviewed in this session)
    -- Format: [{"card_id": "crd_xxx", "rating": 3, "duration_ms": 5000, "was_correct": true}, ...]
    preceding_reviews JSONB DEFAULT '[]',

    -- ============================================================
    -- RESPONSE QUALITY DATA
    -- ============================================================

    response_type response_type NOT NULL DEFAULT 'self_rating',

    -- For typed responses: the actual text entered
    user_response_text TEXT,

    -- For typed responses: expected correct answer
    expected_response_text TEXT,

    -- Fuzzy match similarity score (0.0 - 1.0) for typed responses
    response_similarity_score DECIMAL(4,3),

    -- Editing behavior for typed responses
    keystroke_count INTEGER,
    backspace_count INTEGER,
    paste_count SMALLINT,
    edit_count SMALLINT,

    -- For multiple choice: which options were considered (hover/focus time)
    -- Format: [{"option_index": 0, "hover_ms": 500, "click_count": 1}, ...]
    option_interactions JSONB,

    -- Streaming interaction log (appended during review via PATCH)
    -- Format: [{"type": "keystroke", "timestamp_ms": 1234, "data": {...}}, ...]
    interaction_log JSONB DEFAULT '[]',

    -- ============================================================
    -- DEVICE & CONTEXT
    -- ============================================================

    device_type device_type DEFAULT 'unknown',
    viewport_width SMALLINT,
    viewport_height SMALLINT,

    -- Was the app/tab in background during this review?
    was_backgrounded BOOLEAN DEFAULT FALSE,
    time_backgrounded_ms INTEGER,

    -- Input method: 'touch', 'mouse', 'keyboard', 'stylus'
    input_method VARCHAR(20),

    -- Client metadata
    client_version VARCHAR(20),
    platform VARCHAR(50),  -- 'web', 'ios', 'android', 'electron'
    user_agent TEXT,

    -- ============================================================
    -- SCHEDULING METADATA (FSRS State at review time)
    -- ============================================================

    -- Card state before and after (NULL until started/completed)
    card_state_before card_state,
    card_state_after card_state,

    -- FSRS predicted probability of recall at review time
    predicted_recall_probability DECIMAL(5,4),

    -- Interval tracking
    actual_interval_days DECIMAL(10,4),
    scheduled_interval_days DECIMAL(10,4),
    overdue_days DECIMAL(10,4),

    -- Ease factors
    ease_factor_before DECIMAL(4,2),
    ease_factor_after DECIMAL(4,2),

    -- Intervals in days
    interval_before_days DECIMAL(10,4),
    interval_after_days DECIMAL(10,4),

    -- Review counts
    repetition_count INTEGER,
    lapse_count INTEGER,

    -- ============================================================
    -- CONTENT CONTEXT (for ML feature engineering)
    -- ============================================================

    front_content_length INTEGER,
    back_content_length INTEGER,
    has_media BOOLEAN DEFAULT FALSE,
    media_types VARCHAR(50)[],
    card_tags TEXT[],

    -- ============================================================
    -- TIMESTAMPS & METADATA
    -- ============================================================

    -- When the client created the event (review started)
    client_created_at TIMESTAMP WITH TIME ZONE,

    -- When the server first received the event
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- When the review was completed
    completed_at TIMESTAMP WITH TIME ZONE,

    -- For data lineage: link to study_sessions if applicable
    legacy_session_id VARCHAR(30),

    -- For debugging/tracing requests
    client_request_id VARCHAR(50)
);

-- ============================================================
-- INDEXES for common analytical queries
-- ============================================================

-- Primary lookup patterns
CREATE INDEX idx_review_events_user_id ON review_events(user_id);
CREATE INDEX idx_review_events_card_id ON review_events(card_id);
CREATE INDEX idx_review_events_deck_id ON review_events(deck_id);
CREATE INDEX idx_review_events_session_id ON review_events(session_id);

-- Time-based queries
CREATE INDEX idx_review_events_server_received ON review_events(server_received_at);
CREATE INDEX idx_review_events_user_received ON review_events(user_id, server_received_at);

-- Status-based queries (for finding incomplete events)
CREATE INDEX idx_review_events_status ON review_events(status);
CREATE INDEX idx_review_events_incomplete ON review_events(user_id, status, server_received_at)
    WHERE status IN ('started', 'interacting');

-- Analytics queries
CREATE INDEX idx_review_events_user_card ON review_events(user_id, card_id, server_received_at);
CREATE INDEX idx_review_events_rating ON review_events(rating) WHERE rating IS NOT NULL;

-- Pattern analysis (failures, time of day)
CREATE INDEX idx_review_events_failures ON review_events(user_id, card_id, server_received_at)
    WHERE was_correct = FALSE;
CREATE INDEX idx_review_events_local_hour ON review_events(user_id, local_hour);
CREATE INDEX idx_review_events_device ON review_events(user_id, device_type);

-- Card state transitions
CREATE INDEX idx_review_events_state_transition ON review_events(card_state_before, card_state_after)
    WHERE card_state_before IS NOT NULL;

-- FSRS analysis
CREATE INDEX idx_review_events_recall_prob ON review_events(predicted_recall_probability)
    WHERE predicted_recall_probability IS NOT NULL;

-- Tag-based analysis (GIN for array)
CREATE INDEX idx_review_events_tags ON review_events USING GIN(card_tags);

-- Session analysis
CREATE INDEX idx_review_events_session_position ON review_events(session_id, position_in_session)
    WHERE session_id IS NOT NULL;

-- ============================================================
-- FUNCTION: Append to interaction_log efficiently
-- ============================================================

CREATE OR REPLACE FUNCTION append_interaction_event(
    p_event_id VARCHAR(30),
    p_interaction JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE review_events
    SET
        interaction_log = COALESCE(interaction_log, '[]'::jsonb) || p_interaction,
        status = CASE
            WHEN status = 'started' THEN 'interacting'::review_event_status
            ELSE status
        END
    WHERE event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Complete a review event
-- ============================================================

CREATE OR REPLACE FUNCTION complete_review_event(
    p_event_id VARCHAR(30),
    p_rating SMALLINT,
    p_total_duration_ms INTEGER,
    p_completion_data JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    UPDATE review_events
    SET
        status = 'completed'::review_event_status,
        rating = p_rating,
        was_correct = (p_rating >= 3),
        total_duration_ms = p_total_duration_ms,
        completed_at = CURRENT_TIMESTAMP,
        -- Merge any additional completion data
        time_to_first_interaction_ms = COALESCE(
            (p_completion_data->>'time_to_first_interaction_ms')::INTEGER,
            time_to_first_interaction_ms
        ),
        time_to_answer_ms = COALESCE(
            (p_completion_data->>'time_to_answer_ms')::INTEGER,
            time_to_answer_ms
        ),
        hesitation_before_rating_ms = COALESCE(
            (p_completion_data->>'hesitation_before_rating_ms')::INTEGER,
            hesitation_before_rating_ms
        ),
        keystroke_count = COALESCE(
            (p_completion_data->>'keystroke_count')::INTEGER,
            keystroke_count
        ),
        backspace_count = COALESCE(
            (p_completion_data->>'backspace_count')::INTEGER,
            backspace_count
        ),
        user_response_text = COALESCE(
            p_completion_data->>'user_response_text',
            user_response_text
        ),
        card_state_after = COALESCE(
            (p_completion_data->>'card_state_after')::card_state,
            card_state_after
        ),
        ease_factor_after = COALESCE(
            (p_completion_data->>'ease_factor_after')::DECIMAL,
            ease_factor_after
        ),
        interval_after_days = COALESCE(
            (p_completion_data->>'interval_after_days')::DECIMAL,
            interval_after_days
        )
    WHERE event_id = p_event_id
      AND status != 'completed';  -- Prevent double-completion
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS for documentation
-- ============================================================

COMMENT ON TABLE review_events IS 'Append-only event log capturing rich review data for AI/ML analytics. Supports streaming updates during review lifecycle.';

COMMENT ON COLUMN review_events.event_id IS 'Prefixed ULID: evt_01HXXXXXXXXXXXXXXXXXXXXXXX';
COMMENT ON COLUMN review_events.session_id IS 'Groups reviews in a study session. Prefixed ULID: ses_01HXXXXXXXXXXXXXXXXXXXXXXX';
COMMENT ON COLUMN review_events.status IS 'Lifecycle: started -> interacting -> completed (or abandoned)';
COMMENT ON COLUMN review_events.interaction_log IS 'Streaming log of interactions: [{"type": "keystroke", "timestamp_ms": 1234, "data": {...}}]';
COMMENT ON COLUMN review_events.preceding_reviews IS 'Last 3-5 cards reviewed in session: [{"card_id": "crd_xxx", "rating": 3, "duration_ms": 5000}]';
COMMENT ON COLUMN review_events.predicted_recall_probability IS 'FSRS predicted P(recall) at review time, range 0.0000-1.0000';
COMMENT ON COLUMN review_events.overdue_days IS 'Days overdue (positive) or early (negative) compared to scheduled review';
COMMENT ON COLUMN review_events.client_request_id IS 'Client-generated ID for request tracing/deduplication';

COMMIT;
