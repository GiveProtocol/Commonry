-- Migration script: UUID to ULID
-- This script converts all UUID columns to VARCHAR(30) for ULID support

BEGIN;

-- Drop existing foreign key constraints
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS fk_user;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS fk_card;
ALTER TABLE user_statistics_daily DROP CONSTRAINT IF EXISTS fk_user_daily;
ALTER TABLE user_statistics_total DROP CONSTRAINT IF EXISTS fk_user_total;
ALTER TABLE leaderboard_cache DROP CONSTRAINT IF EXISTS fk_user_leaderboard;
ALTER TABLE cards DROP CONSTRAINT IF EXISTS fk_deck;
ALTER TABLE media DROP CONSTRAINT IF EXISTS fk_deck_media;

-- Backup existing data (create backup tables)
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE cards_backup AS SELECT * FROM cards;
CREATE TABLE decks_backup AS SELECT * FROM decks;
CREATE TABLE media_backup AS SELECT * FROM media;

-- Drop dependent tables (we'll recreate them)
DROP TABLE IF EXISTS leaderboard_cache;
DROP TABLE IF EXISTS user_statistics_total;
DROP TABLE IF EXISTS user_statistics_daily;
DROP TABLE IF EXISTS study_sessions;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS decks;

-- Recreate tables with VARCHAR for IDs

-- Decks table
CREATE TABLE decks (
    deck_id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cards table
CREATE TABLE cards (
    card_id VARCHAR(30) PRIMARY KEY,
    deck_id VARCHAR(30) NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    card_type VARCHAR(50) NOT NULL DEFAULT 'basic',
    front_content JSONB NOT NULL,
    back_content JSONB,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Media table
CREATE TABLE media (
    media_id VARCHAR(30) PRIMARY KEY,
    deck_id VARCHAR(30) NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    storage_url TEXT NOT NULL,
    file_hash VARCHAR(64) UNIQUE,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    user_id VARCHAR(30) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Study sessions table
CREATE TABLE study_sessions (
    session_id VARCHAR(30) PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_id VARCHAR(30) NOT NULL,
    studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_spent_ms INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
    was_correct BOOLEAN GENERATED ALWAYS AS (rating >= 3) STORED,
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5)
);

-- Daily aggregated statistics
CREATE TABLE user_statistics_daily (
    stat_id VARCHAR(30) PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- All-time statistics
CREATE TABLE user_statistics_total (
    user_id VARCHAR(30) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard cache
CREATE TABLE leaderboard_cache (
    cache_id VARCHAR(30) PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,
    user_id VARCHAR(30) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    value NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_metric_rank UNIQUE (metric_type, rank)
);

-- Recreate indexes
CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_cards_tags ON cards USING GIN(tags);
CREATE INDEX idx_media_deck_id ON media(deck_id);
CREATE INDEX idx_media_hash ON media(file_hash);
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

-- Recreate triggers
CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON user_statistics_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_total_stats_updated_at BEFORE UPDATE ON user_statistics_total
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_daily_stats
    AFTER INSERT ON study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_daily_statistics();

CREATE TRIGGER trigger_update_total_stats
    AFTER INSERT ON study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_total_statistics();

COMMIT;
