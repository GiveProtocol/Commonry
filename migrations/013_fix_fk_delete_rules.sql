-- Migration: Fix missing FK ON DELETE rules
-- Adds ON DELETE SET NULL to foreign keys that were missing delete behavior
-- This ensures referential integrity while preserving data when referenced rows are deleted

BEGIN;

-- ============================================================
-- tags.category_id -> categories(id)
-- When a category is deleted, tags should keep their data but lose the category link
-- ============================================================

ALTER TABLE tags
  DROP CONSTRAINT IF EXISTS tags_category_id_fkey;

ALTER TABLE tags
  ADD CONSTRAINT tags_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id)
  ON DELETE SET NULL;

-- ============================================================
-- deck_flags.reporter_id -> users(user_id)
-- When a user is deleted, keep the flag but lose the reporter reference
-- ============================================================

ALTER TABLE deck_flags
  DROP CONSTRAINT IF EXISTS deck_flags_reporter_id_fkey;

ALTER TABLE deck_flags
  ADD CONSTRAINT deck_flags_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES users(user_id)
  ON DELETE SET NULL;

-- ============================================================
-- deck_flags.reviewed_by -> users(user_id)
-- When a user is deleted, keep the flag but lose the reviewer reference
-- ============================================================

ALTER TABLE deck_flags
  DROP CONSTRAINT IF EXISTS deck_flags_reviewed_by_fkey;

ALTER TABLE deck_flags
  ADD CONSTRAINT deck_flags_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
  ON DELETE SET NULL;

-- ============================================================
-- decks.author_id -> users(user_id)
-- When a user is deleted, keep the deck but lose the author reference
-- ============================================================

ALTER TABLE decks
  DROP CONSTRAINT IF EXISTS decks_author_id_fkey;

ALTER TABLE decks
  ADD CONSTRAINT decks_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(user_id)
  ON DELETE SET NULL;

-- ============================================================
-- research_exports.created_by -> users(user_id)
-- When a user is deleted, keep the export record but lose the creator reference
-- ============================================================

ALTER TABLE research_exports
  DROP CONSTRAINT IF EXISTS research_exports_created_by_fkey;

ALTER TABLE research_exports
  ADD CONSTRAINT research_exports_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(user_id)
  ON DELETE SET NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON CONSTRAINT tags_category_id_fkey ON tags IS 'SET NULL on category delete - tags persist without category link';
COMMENT ON CONSTRAINT deck_flags_reporter_id_fkey ON deck_flags IS 'SET NULL on user delete - flags persist for audit trail';
COMMENT ON CONSTRAINT deck_flags_reviewed_by_fkey ON deck_flags IS 'SET NULL on user delete - flags persist for audit trail';
COMMENT ON CONSTRAINT decks_author_id_fkey ON decks IS 'SET NULL on user delete - decks persist without author';
COMMENT ON CONSTRAINT research_exports_created_by_fkey ON research_exports IS 'SET NULL on user delete - exports persist for audit trail';

COMMIT;
