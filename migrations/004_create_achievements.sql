-- Migration: Create achievements system tables
-- Description: Achievement definitions and user achievement tracking

-- Achievements master table
CREATE TABLE IF NOT EXISTS achievements (
    achievement_id VARCHAR(50) PRIMARY KEY,

    -- Achievement details
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'consistency', 'volume', 'community', 'special'
    badge_icon VARCHAR(100), -- Icon identifier or emoji

    -- Criteria (stored as JSONB for flexibility)
    criteria JSONB NOT NULL,
    -- Example: {"type": "streak", "days": 7} or {"type": "reviews", "count": 1000}

    -- Display order and rarity
    display_order INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_category CHECK (category IN ('consistency', 'volume', 'community', 'special'))
);

-- User achievements junction table
CREATE TABLE IF NOT EXISTS user_achievements (
    user_achievement_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,

    -- Achievement progress
    progress INTEGER DEFAULT 0, -- Current progress toward achievement
    target INTEGER NOT NULL, -- Target value to unlock
    unlocked BOOLEAN DEFAULT false,

    -- Unlock timestamp
    unlocked_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_achievement UNIQUE(user_id, achievement_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(user_id, unlocked);
CREATE INDEX IF NOT EXISTS idx_user_achievements_recent ON user_achievements(unlocked_at DESC) WHERE unlocked = true;

-- Add comments
COMMENT ON TABLE achievements IS 'Master table of all available achievements';
COMMENT ON TABLE user_achievements IS 'Tracks user progress and unlocked achievements';
COMMENT ON COLUMN achievements.criteria IS 'JSON object defining achievement unlock criteria';
COMMENT ON COLUMN user_achievements.progress IS 'Current progress value (e.g., 5 out of 7 days for streak)';

-- Insert seed achievements
INSERT INTO achievements (achievement_id, name, description, category, badge_icon, criteria, display_order, rarity) VALUES
-- Consistency badges
('achv_01', 'Week Warrior', '7-day study streak', 'consistency', '🔥', '{"type": "streak", "days": 7}', 10, 'common'),
('achv_02', 'Month Master', '30-day study streak', 'consistency', '⭐', '{"type": "streak", "days": 30}', 20, 'rare'),
('achv_03', 'Century Scholar', '100-day study streak', 'consistency', '💎', '{"type": "streak", "days": 100}', 30, 'epic'),
('achv_04', 'Annual Achiever', '365-day study streak', 'consistency', '👑', '{"type": "streak", "days": 365}', 40, 'legendary'),
('achv_05', 'Perfect Week', 'Studied every day this week', 'consistency', '✨', '{"type": "perfect_week"}', 15, 'common'),

-- Volume badges
('achv_06', 'First Steps', '100 cards reviewed', 'volume', '🌱', '{"type": "reviews", "count": 100}', 50, 'common'),
('achv_07', 'Knowledge Seeker', '1,000 cards reviewed', 'volume', '📚', '{"type": "reviews", "count": 1000}', 60, 'common'),
('achv_08', 'Study Titan', '10,000 cards reviewed', 'volume', '🏆', '{"type": "reviews", "count": 10000}', 70, 'rare'),
('achv_09', 'Master Scholar', '100,000 cards reviewed', 'volume', '🎓', '{"type": "reviews", "count": 100000}', 80, 'legendary'),
('achv_10', 'Hundred Strong', '100 cards mastered', 'volume', '🌟', '{"type": "mastered", "count": 100}', 55, 'common'),
('achv_11', 'Thousand Wise', '1,000 cards mastered', 'volume', '🧠', '{"type": "mastered", "count": 1000}', 65, 'rare'),

-- Community badges
('achv_12', 'Deck Creator', 'Published first deck', 'community', '🎨', '{"type": "decks_published", "count": 1}', 90, 'common'),
('achv_13', 'Popular Publisher', 'Deck downloaded 100 times', 'community', '📦', '{"type": "deck_downloads", "count": 100}', 100, 'rare'),
('achv_14', 'Forum Pioneer', 'Made first forum post', 'community', '💬', '{"type": "forum_posts", "count": 1}', 95, 'common'),
('achv_15', 'Helpful Hand', '50 helpful forum answers', 'community', '🤝', '{"type": "helpful_answers", "count": 50}', 110, 'rare'),

-- Special badges
('achv_16', 'Early Adopter', 'Joined in the first year', 'special', '🚀', '{"type": "early_adopter"}', 200, 'epic'),
('achv_17', 'Anki Migrant', 'Imported first Anki deck', 'special', '📥', '{"type": "anki_import"}', 210, 'common'),
('achv_18', 'Commons Builder', 'Contributed to public decks', 'special', '🏛️', '{"type": "commons_contribution"}', 220, 'rare')
ON CONFLICT (achievement_id) DO NOTHING;
