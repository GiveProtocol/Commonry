-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Decks table
CREATE TABLE decks (
    deck_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Card types enum
CREATE TYPE card_type AS ENUM ('basic', 'basic_reverse', 'cloze', 'custom');

-- Cards table
CREATE TABLE cards (
    card_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    card_type card_type NOT NULL DEFAULT 'basic',
    front_content JSONB NOT NULL,
    back_content JSONB,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_deck FOREIGN KEY (deck_id) REFERENCES decks(deck_id)
);

-- Media table
CREATE TABLE media (
    media_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    storage_url TEXT NOT NULL,
    file_hash VARCHAR(64) UNIQUE,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_deck_media FOREIGN KEY (deck_id) REFERENCES decks(deck_id)
);

-- Indexes for performance
CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_cards_tags ON cards USING GIN(tags);
CREATE INDEX idx_media_deck_id ON media(deck_id);
CREATE INDEX idx_media_hash ON media(file_hash);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Users table for authentication
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Study sessions table (raw data)
CREATE TABLE study_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(card_id) ON DELETE CASCADE,
    studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_spent_ms INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
    was_correct BOOLEAN GENERATED ALWAYS AS (rating >= 3) STORED,
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_card FOREIGN KEY (card_id) REFERENCES cards(card_id)
);

-- Daily aggregated statistics (for performance)
CREATE TABLE user_statistics_daily (
    stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    cards_studied INTEGER DEFAULT 0,
    unique_cards INTEGER DEFAULT 0,
    total_time_ms BIGINT DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_answers INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_answers > 0 THEN (correct_answers::DECIMAL / total_answers * 100)
            ELSE 0
        END
    ) STORED,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_daily FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- All-time statistics (denormalized for speed)
CREATE TABLE user_statistics_total (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_cards_studied BIGINT DEFAULT 0,
    total_unique_cards INTEGER DEFAULT 0,
    total_time_ms BIGINT DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_attempts > 0 THEN (total_correct::DECIMAL / total_attempts * 100)
            ELSE 0
        END
    ) STORED,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_study_date DATE,
    first_study_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_total FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Leaderboard cache (materialized view for top performers)
CREATE TABLE leaderboard_cache (
    cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    value NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_leaderboard FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT unique_metric_rank UNIQUE (metric_type, rank)
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_sessions_card_id ON study_sessions(card_id);
CREATE INDEX idx_sessions_studied_at ON study_sessions(studied_at);
CREATE INDEX idx_sessions_user_date ON study_sessions(user_id, studied_at);
CREATE INDEX idx_daily_stats_user_date ON user_statistics_daily(user_id, date);
CREATE INDEX idx_daily_stats_date ON user_statistics_daily(date);
CREATE INDEX idx_leaderboard_metric_rank ON leaderboard_cache(metric_type, rank);
CREATE INDEX idx_leaderboard_user ON leaderboard_cache(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON user_statistics_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_total_stats_updated_at BEFORE UPDATE ON user_statistics_total
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily statistics
CREATE OR REPLACE FUNCTION update_daily_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update daily statistics
    INSERT INTO user_statistics_daily (user_id, date, cards_studied, unique_cards, total_time_ms, correct_answers, total_answers)
    VALUES (
        NEW.user_id,
        NEW.studied_at::DATE,
        1,
        1,
        NEW.time_spent_ms,
        CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
        1
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        cards_studied = user_statistics_daily.cards_studied + 1,
        total_time_ms = user_statistics_daily.total_time_ms + NEW.time_spent_ms,
        correct_answers = user_statistics_daily.correct_answers + CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
        total_answers = user_statistics_daily.total_answers + 1,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update daily stats when session is recorded
CREATE TRIGGER trigger_update_daily_stats
    AFTER INSERT ON study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_daily_statistics();

-- Function to update total statistics
CREATE OR REPLACE FUNCTION update_total_statistics()
RETURNS TRIGGER AS $$
DECLARE
    prev_date DATE;
    streak_count INTEGER;
BEGIN
    -- Get last study date for streak calculation
    SELECT last_study_date INTO prev_date
    FROM user_statistics_total
    WHERE user_id = NEW.user_id;

    -- Calculate streak
    IF prev_date IS NULL THEN
        streak_count := 1;
    ELSIF NEW.studied_at::DATE = prev_date THEN
        -- Same day, keep current streak
        SELECT current_streak INTO streak_count
        FROM user_statistics_total
        WHERE user_id = NEW.user_id;
    ELSIF NEW.studied_at::DATE = prev_date + INTERVAL '1 day' THEN
        -- Consecutive day, increment streak
        SELECT current_streak + 1 INTO streak_count
        FROM user_statistics_total
        WHERE user_id = NEW.user_id;
    ELSE
        -- Streak broken
        streak_count := 1;
    END IF;

    -- Insert or update total statistics
    INSERT INTO user_statistics_total (
        user_id, total_cards_studied, total_time_ms, total_correct, total_attempts,
        current_streak, longest_streak, last_study_date, first_study_date
    )
    VALUES (
        NEW.user_id,
        1,
        NEW.time_spent_ms,
        CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
        1,
        streak_count,
        streak_count,
        NEW.studied_at::DATE,
        NEW.studied_at::DATE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_cards_studied = user_statistics_total.total_cards_studied + 1,
        total_time_ms = user_statistics_total.total_time_ms + NEW.time_spent_ms,
        total_correct = user_statistics_total.total_correct + CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
        total_attempts = user_statistics_total.total_attempts + 1,
        current_streak = streak_count,
        longest_streak = GREATEST(user_statistics_total.longest_streak, streak_count),
        last_study_date = NEW.studied_at::DATE,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update total stats when session is recorded
CREATE TRIGGER trigger_update_total_stats
    AFTER INSERT ON study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_total_statistics();

-- Function to refresh leaderboard cache
CREATE OR REPLACE FUNCTION refresh_leaderboard(metric VARCHAR(50), top_n INTEGER DEFAULT 100)
RETURNS VOID AS $$
BEGIN
    -- Delete old cache for this metric
    DELETE FROM leaderboard_cache WHERE metric_type = metric;

    -- Insert new rankings based on metric type
    IF metric = 'total_cards' THEN
        INSERT INTO leaderboard_cache (metric_type, rank, user_id, username, display_name, value)
        SELECT
            'total_cards',
            ROW_NUMBER() OVER (ORDER BY s.total_cards_studied DESC),
            u.user_id,
            u.username,
            u.display_name,
            s.total_cards_studied
        FROM user_statistics_total s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.total_cards_studied > 0
        ORDER BY s.total_cards_studied DESC
        LIMIT top_n;

    ELSIF metric = 'total_time' THEN
        INSERT INTO leaderboard_cache (metric_type, rank, user_id, username, display_name, value)
        SELECT
            'total_time',
            ROW_NUMBER() OVER (ORDER BY s.total_time_ms DESC),
            u.user_id,
            u.username,
            u.display_name,
            s.total_time_ms
        FROM user_statistics_total s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.total_time_ms > 0
        ORDER BY s.total_time_ms DESC
        LIMIT top_n;

    ELSIF metric = 'retention_rate' THEN
        INSERT INTO leaderboard_cache (metric_type, rank, user_id, username, display_name, value)
        SELECT
            'retention_rate',
            ROW_NUMBER() OVER (ORDER BY s.retention_rate DESC),
            u.user_id,
            u.username,
            u.display_name,
            s.retention_rate
        FROM user_statistics_total s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.total_attempts >= 50  -- Minimum threshold
        ORDER BY s.retention_rate DESC
        LIMIT top_n;

    ELSIF metric = 'current_streak' THEN
        INSERT INTO leaderboard_cache (metric_type, rank, user_id, username, display_name, value)
        SELECT
            'current_streak',
            ROW_NUMBER() OVER (ORDER BY s.current_streak DESC),
            u.user_id,
            u.username,
            u.display_name,
            s.current_streak
        FROM user_statistics_total s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.current_streak > 0
        ORDER BY s.current_streak DESC
        LIMIT top_n;
    END IF;
END;
$$ LANGUAGE plpgsql;
