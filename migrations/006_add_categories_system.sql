-- Migration: Add Categories System for The Commons
-- This enables public deck discovery with field-first navigation

-- Categories (fields of study)
CREATE TABLE categories (
  id VARCHAR(30) PRIMARY KEY,           -- cat_[ulid]
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_emoji VARCHAR(10),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deck-Category junction (many-to-many, decks can have multiple categories)
CREATE TABLE deck_categories (
  deck_id VARCHAR(30) REFERENCES decks(deck_id) ON DELETE CASCADE,
  category_id VARCHAR(30) REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  PRIMARY KEY (deck_id, category_id)
);

-- Tags for granular filtering within categories
CREATE TABLE tags (
  id VARCHAR(30) PRIMARY KEY,           -- tag_[ulid]
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  category_id VARCHAR(30) REFERENCES categories(id), -- Optional category affinity
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deck-Tag junction
CREATE TABLE deck_tags (
  deck_id VARCHAR(30) REFERENCES decks(deck_id) ON DELETE CASCADE,
  tag_id VARCHAR(30) REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (deck_id, tag_id)
);

-- Deck flags for content moderation
CREATE TABLE deck_flags (
  id VARCHAR(30) PRIMARY KEY,           -- flag_[ulid]
  deck_id VARCHAR(30) REFERENCES decks(deck_id) ON DELETE CASCADE,
  reporter_id VARCHAR(30) REFERENCES users(user_id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, dismissed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(30) REFERENCES users(user_id)
);

-- Deck subscriptions (users subscribing to public decks)
CREATE TABLE deck_subscriptions (
  user_id VARCHAR(30) REFERENCES users(user_id) ON DELETE CASCADE,
  deck_id VARCHAR(30) REFERENCES decks(deck_id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, deck_id)
);

-- Add new columns to decks table for public browsing
ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS author_id VARCHAR(30) REFERENCES users(user_id);
ALTER TABLE decks ADD COLUMN IF NOT EXISTS subscriber_count INTEGER DEFAULT 0;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2);
ALTER TABLE decks ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS trending_score DECIMAL(10,2) DEFAULT 0;

-- Indexes for performance
CREATE INDEX idx_decks_public ON decks(is_public) WHERE is_public = true;
CREATE INDEX idx_decks_author ON decks(author_id);
CREATE INDEX idx_decks_trending ON decks(trending_score DESC) WHERE is_public = true;
CREATE INDEX idx_decks_featured ON decks(featured_at DESC) WHERE featured_at IS NOT NULL;
CREATE INDEX idx_deck_categories_category ON deck_categories(category_id);
CREATE INDEX idx_deck_categories_primary ON deck_categories(deck_id) WHERE is_primary = true;
CREATE INDEX idx_tags_category ON tags(category_id);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);
CREATE INDEX idx_deck_tags_tag ON deck_tags(tag_id);
CREATE INDEX idx_deck_flags_status ON deck_flags(status) WHERE status = 'pending';
CREATE INDEX idx_deck_subscriptions_deck ON deck_subscriptions(deck_id);

-- Trigger to update subscriber_count when subscriptions change
CREATE OR REPLACE FUNCTION update_subscriber_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE decks SET subscriber_count = subscriber_count + 1 WHERE deck_id = NEW.deck_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE decks SET subscriber_count = subscriber_count - 1 WHERE deck_id = OLD.deck_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscriber_count
  AFTER INSERT OR DELETE ON deck_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriber_count();

-- Trigger to update tag usage_count when deck_tags change
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_usage_count
  AFTER INSERT OR DELETE ON deck_tags
  FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Function to calculate trending score (can be called periodically)
CREATE OR REPLACE FUNCTION calculate_trending_score(p_deck_id VARCHAR(30))
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_subscriber_count INTEGER;
  v_average_rating DECIMAL(3,2);
  v_days_since_activity INTEGER;
  v_recency_score DECIMAL(10,2);
  v_trending_score DECIMAL(10,2);
BEGIN
  SELECT
    COALESCE(subscriber_count, 0),
    COALESCE(average_rating, 3.0),
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(last_activity_at, created_at)))::INTEGER
  INTO v_subscriber_count, v_average_rating, v_days_since_activity
  FROM decks
  WHERE deck_id = p_deck_id;

  -- Recency score: fresher = higher (max 100, decays over 50 days)
  v_recency_score := GREATEST(0, 100 - v_days_since_activity * 2);

  -- Community score formula:
  -- 40% subscriber count (log scale for fairness)
  -- 30% rating (normalized to 0-100)
  -- 30% recency
  v_trending_score :=
    (LEAST(LOG(v_subscriber_count + 1) * 20, 100) * 0.4) +
    (v_average_rating * 20 * 0.3) +
    (v_recency_score * 0.3);

  RETURN v_trending_score;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all trending scores (run via cron job)
CREATE OR REPLACE FUNCTION refresh_all_trending_scores()
RETURNS VOID AS $$
BEGIN
  UPDATE decks
  SET trending_score = calculate_trending_score(deck_id)
  WHERE is_public = true;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE categories IS 'Fields of study for organizing public decks';
COMMENT ON TABLE deck_categories IS 'Junction table linking decks to categories (many-to-many)';
COMMENT ON TABLE tags IS 'Tags for filtering decks within categories';
COMMENT ON TABLE deck_tags IS 'Junction table linking decks to tags';
COMMENT ON TABLE deck_flags IS 'User reports for inappropriate content moderation';
COMMENT ON TABLE deck_subscriptions IS 'Users subscribing to public decks';
COMMENT ON COLUMN decks.is_public IS 'Whether deck is visible in The Commons';
COMMENT ON COLUMN decks.trending_score IS 'Composite score for Community Favorites sorting';
