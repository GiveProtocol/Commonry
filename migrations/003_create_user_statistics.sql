-- Migration: Create user_statistics table
-- Description: Stores comprehensive study statistics for each user

CREATE TABLE IF NOT EXISTS user_statistics (
    stat_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Streak tracking
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_study_date DATE,

    -- Study totals
    total_study_days INTEGER DEFAULT 0,
    total_cards_reviewed INTEGER DEFAULT 0,
    total_cards_mastered INTEGER DEFAULT 0,
    active_decks_count INTEGER DEFAULT 0,

    -- Learning velocity
    new_cards_this_week INTEGER DEFAULT 0,
    new_cards_this_month INTEGER DEFAULT 0,

    -- Time tracking
    total_study_time_ms BIGINT DEFAULT 0,
    average_session_time_ms BIGINT DEFAULT 0,

    -- Best subject areas (auto-detected from deck tags)
    top_subjects JSONB DEFAULT '[]'::jsonb,

    -- Leaderboard (optional, null if not opted in)
    global_rank INTEGER,
    opted_into_leaderboard BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_statistics UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_global_rank ON user_statistics(global_rank) WHERE global_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_statistics_streak ON user_statistics(current_streak DESC);

-- Add comments
COMMENT ON TABLE user_statistics IS 'Comprehensive study statistics for each user';
COMMENT ON COLUMN user_statistics.current_streak IS 'Current consecutive days studying';
COMMENT ON COLUMN user_statistics.longest_streak IS 'Longest ever streak achieved';
COMMENT ON COLUMN user_statistics.total_cards_mastered IS 'Cards at high retention intervals';
COMMENT ON COLUMN user_statistics.top_subjects IS 'JSON array of top subject areas based on deck tags';
COMMENT ON COLUMN user_statistics.opted_into_leaderboard IS 'Whether user wants to appear on global leaderboards';
