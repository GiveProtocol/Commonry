-- Migration: Create privacy settings, goals, and follows tables
-- Description: Privacy controls, learning goals, and social connections

-- Privacy settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
    setting_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Privacy preset
    privacy_preset VARCHAR(20) DEFAULT 'community_member', -- 'fully_public', 'community_member', 'private_learner', 'anonymous'

    -- Field-level visibility (true = public, false = private)
    show_statistics BOOLEAN DEFAULT true,
    show_decks BOOLEAN DEFAULT true,
    show_forum_activity BOOLEAN DEFAULT true,
    show_followers BOOLEAN DEFAULT true,
    show_achievements BOOLEAN DEFAULT true,
    show_goals BOOLEAN DEFAULT false, -- Goals private by default

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_privacy UNIQUE(user_id),
    CONSTRAINT valid_preset CHECK (privacy_preset IN ('fully_public', 'community_member', 'private_learner', 'anonymous'))
);

-- User goals table
CREATE TABLE IF NOT EXISTS user_goals (
    goal_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Goal details
    goal_text TEXT NOT NULL,
    target_value INTEGER, -- Optional numeric target
    current_progress INTEGER DEFAULT 0,
    target_date DATE, -- Optional deadline

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    is_public BOOLEAN DEFAULT false,

    -- Timestamps
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- User follows table (social connections)
CREATE TABLE IF NOT EXISTS user_follows (
    follow_id VARCHAR(50) PRIMARY KEY,
    follower_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    following_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_follow UNIQUE(follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Add comments
COMMENT ON TABLE privacy_settings IS 'Granular privacy controls for user profiles';
COMMENT ON TABLE user_goals IS 'User learning goals and progress tracking';
COMMENT ON TABLE user_follows IS 'Social connections - who follows whom';
COMMENT ON COLUMN privacy_settings.privacy_preset IS 'Quick preset for common privacy configurations';
COMMENT ON COLUMN user_goals.is_public IS 'Whether goal is visible to other users';
