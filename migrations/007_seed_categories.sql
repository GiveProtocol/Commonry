-- Seed Data: Initial Categories for The Commons
-- 12 fields of study to organize public decks
-- Note: Category IDs are repeated as foreign keys in tags - this is intentional for seed data (S1192)

-- Define category ID constants to reduce duplication
DO $$
DECLARE
  cat_languages CONSTANT VARCHAR := 'cat_01JEK8M9X1LANGUAGES00000';
  cat_sciences CONSTANT VARCHAR := 'cat_01JEK8M9X1SCIENCES00000';
  cat_technology CONSTANT VARCHAR := 'cat_01JEK8M9X1TECHNOLOGY000';
  cat_medicine CONSTANT VARCHAR := 'cat_01JEK8M9X1MEDICINE00000';
  cat_testprep CONSTANT VARCHAR := 'cat_01JEK8M9X1TESTPREP00000';
BEGIN
  -- Insert categories
  INSERT INTO categories (id, name, slug, description, icon_emoji, display_order) VALUES
    (cat_languages, 'Languages', 'languages', 'Learn vocabulary, grammar, and phrases for world languages', '📚', 1),
    ('cat_01JEK8M9X1MATHEMATICS000', 'Mathematics', 'mathematics', 'Algebra, calculus, statistics, geometry and more', '🔢', 2),
    (cat_sciences, 'Sciences', 'sciences', 'Physics, chemistry, biology, and natural sciences', '🔬', 3),
    ('cat_01JEK8M9X1HISTORY0000000', 'History & Social Studies', 'history', 'World history, geography, civics, and social sciences', '🏛️', 4),
    ('cat_01JEK8M9X1ARTSMUSIC0000', 'Arts & Music', 'arts-music', 'Art history, music theory, instruments, and creative arts', '🎨', 5),
    (cat_technology, 'Technology & Programming', 'technology', 'Programming languages, frameworks, CS concepts, and IT', '💻', 6),
    (cat_medicine, 'Medicine & Health', 'medicine', 'Anatomy, pharmacology, medical terminology, and healthcare', '🏥', 7),
    ('cat_01JEK8M9X1LAW000000000', 'Law & Government', 'law', 'Legal terms, constitutional law, political science', '⚖️', 8),
    ('cat_01JEK8M9X1BUSINESS00000', 'Business & Economics', 'business', 'Finance, accounting, marketing, and economic principles', '📈', 9),
    (cat_testprep, 'Test Preparation', 'test-prep', 'SAT, GRE, MCAT, bar exam, and standardized test prep', '📝', 10),
    ('cat_01JEK8M9X1HOBBIES000000', 'Hobbies & Interests', 'hobbies', 'Trivia, games, sports, cooking, and personal interests', '🎯', 11),
    ('cat_01JEK8M9X1OTHER00000000', 'Other', 'other', 'Decks that don''t fit other categories', '📦', 12)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_emoji = EXCLUDED.icon_emoji,
    display_order = EXCLUDED.display_order;

  -- Insert tags with category references
  INSERT INTO tags (id, name, slug, category_id, usage_count) VALUES
    -- Language tags
    ('tag_01JEK8M9X1SPANISH000000', 'spanish', 'spanish', cat_languages, 0),
    ('tag_01JEK8M9X1FRENCH0000000', 'french', 'french', cat_languages, 0),
    ('tag_01JEK8M9X1GERMAN0000000', 'german', 'german', cat_languages, 0),
    ('tag_01JEK8M9X1JAPANESE00000', 'japanese', 'japanese', cat_languages, 0),
    ('tag_01JEK8M9X1CHINESE000000', 'chinese', 'chinese', cat_languages, 0),
    ('tag_01JEK8M9X1KOREAN0000000', 'korean', 'korean', cat_languages, 0),
    ('tag_01JEK8M9X1VOCABULARY00', 'vocabulary', 'vocabulary', cat_languages, 0),
    ('tag_01JEK8M9X1GRAMMAR000000', 'grammar', 'grammar', cat_languages, 0),
    -- Difficulty level tags (no category affinity)
    ('tag_01JEK8M9X1BEGINNER0000', 'beginner', 'beginner', NULL, 0),
    ('tag_01JEK8M9X1INTERMEDIATE', 'intermediate', 'intermediate', NULL, 0),
    ('tag_01JEK8M9X1ADVANCED00000', 'advanced', 'advanced', NULL, 0),
    -- Science tags
    ('tag_01JEK8M9X1BIOLOGY000000', 'biology', 'biology', cat_sciences, 0),
    ('tag_01JEK8M9X1CHEMISTRY0000', 'chemistry', 'chemistry', cat_sciences, 0),
    ('tag_01JEK8M9X1PHYSICS000000', 'physics', 'physics', cat_sciences, 0),
    -- Programming tags
    ('tag_01JEK8M9X1JAVASCRIPT00', 'javascript', 'javascript', cat_technology, 0),
    ('tag_01JEK8M9X1PYTHON0000000', 'python', 'python', cat_technology, 0),
    ('tag_01JEK8M9X1REACT00000000', 'react', 'react', cat_technology, 0),
    ('tag_01JEK8M9X1ALGORITHMS00', 'algorithms', 'algorithms', cat_technology, 0),
    -- Medicine tags
    ('tag_01JEK8M9X1ANATOMY000000', 'anatomy', 'anatomy', cat_medicine, 0),
    ('tag_01JEK8M9X1PHARMACOLOGY', 'pharmacology', 'pharmacology', cat_medicine, 0),
    -- Test prep tags
    ('tag_01JEK8M9X1SAT0000000000', 'sat', 'sat', cat_testprep, 0),
    ('tag_01JEK8M9X1GRE0000000000', 'gre', 'gre', cat_testprep, 0),
    ('tag_01JEK8M9X1MCAT000000000', 'mcat', 'mcat', cat_testprep, 0)
  ON CONFLICT (slug) DO NOTHING;
END $$;
