-- Migration: Add profile fields to users table
-- Description: Adds bio, pronouns, location, avatar, and learning topics to user profiles

-- Add profile fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50),
ADD COLUMN IF NOT EXISTS location VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS learning_topics TEXT[]; -- Array of topic tags

-- Add constraints
ALTER TABLE users
ADD CONSTRAINT bio_length CHECK (LENGTH(bio) <= 300);

-- Add comment
COMMENT ON COLUMN users.bio IS 'User bio, max 300 characters';
COMMENT ON COLUMN users.pronouns IS 'User pronouns (optional, user-defined)';
COMMENT ON COLUMN users.location IS 'User location (optional, for community building)';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN users.learning_topics IS 'Array of learning topics/subjects as tags';
