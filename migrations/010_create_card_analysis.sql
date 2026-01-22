-- Migration: Create card analysis tables for content metadata extraction
-- This enables domain detection, complexity analysis, and concept extraction
-- for the knowledge graph and AI features.
--
-- Design principles:
-- - Hybrid approach: rule-based extraction with LLM fallback for ambiguous cases
-- - Job queue for background processing (imports, re-analysis)
-- - Version tracking for re-analysis capabilities

BEGIN;

-- ============================================================
-- ENUMS
-- ============================================================

-- Drop types if they exist (for re-running migration during development)
DROP TYPE IF EXISTS complexity_level CASCADE;
DROP TYPE IF EXISTS content_domain CASCADE;
DROP TYPE IF EXISTS analysis_status CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;

-- Complexity level for card content
CREATE TYPE complexity_level AS ENUM (
    'elementary',   -- Basic concepts, simple vocabulary
    'intermediate', -- Standard difficulty, some technical terms
    'advanced',     -- Complex concepts, specialized vocabulary
    'expert'        -- Highly technical, requires domain expertise
);

-- Content domain classification (12 domains)
CREATE TYPE content_domain AS ENUM (
    'languages',          -- Language learning (vocab, grammar, conjugation)
    'mathematics',        -- Math, equations, theorems
    'sciences',           -- Physics, chemistry, biology
    'history_social',     -- History, geography, social studies
    'arts_music',         -- Art, music theory, literature
    'technology',         -- Programming, CS, IT
    'medicine_health',    -- Medical, anatomy, pharmacology
    'law_government',     -- Legal terms, civics, political science
    'business_economics', -- Business, finance, economics
    'test_prep',          -- Standardized tests (SAT, GRE, MCAT)
    'hobbies',            -- Sports, games, crafts, personal interests
    'unknown'             -- Could not determine domain
);

-- Analysis processing status
CREATE TYPE analysis_status AS ENUM (
    'pending',    -- Waiting to be analyzed
    'processing', -- Currently being analyzed
    'completed',  -- Analysis finished successfully
    'failed',     -- Analysis failed (will retry)
    'needs_llm'   -- Rule-based insufficient, needs LLM analysis
);

-- Job queue status
CREATE TYPE job_status AS ENUM (
    'pending',    -- Job waiting to be processed
    'processing', -- Job currently being processed
    'completed',  -- Job finished successfully
    'failed',     -- Job failed after max retries
    'cancelled'   -- Job was cancelled
);

-- ============================================================
-- TABLE: card_analysis
-- ============================================================

CREATE TABLE card_analysis (
    -- Primary key with prefixed ULID (ana_)
    analysis_id VARCHAR(30) PRIMARY KEY,

    -- Reference to cards table (no FK constraint - cards may be deleted but analysis persists)
    card_id VARCHAR(30) NOT NULL,

    -- Version for re-analysis tracking
    analysis_version INTEGER NOT NULL DEFAULT 1,

    -- ============================================================
    -- DOMAIN DETECTION
    -- ============================================================

    -- Primary detected domain
    detected_domain content_domain NOT NULL DEFAULT 'unknown',

    -- Confidence score (0.000 - 1.000)
    domain_confidence DECIMAL(4,3) CHECK (domain_confidence >= 0 AND domain_confidence <= 1),

    -- Secondary domains (scores > 30% of top)
    secondary_domains content_domain[] DEFAULT '{}',

    -- ============================================================
    -- CONCEPT EXTRACTION
    -- ============================================================

    -- Key terms/concepts found in the card
    extracted_concepts TEXT[] DEFAULT '{}',

    -- ============================================================
    -- COMPLEXITY ANALYSIS
    -- ============================================================

    -- Content difficulty level
    complexity_level complexity_level,

    -- Raw complexity score (0.000 - 1.000)
    complexity_score DECIMAL(4,3) CHECK (complexity_score >= 0 AND complexity_score <= 1),

    -- ============================================================
    -- TEXT METRICS
    -- ============================================================

    -- Word counts
    front_word_count INTEGER DEFAULT 0,
    back_word_count INTEGER DEFAULT 0,

    -- ============================================================
    -- CARD TYPE DETECTION
    -- ============================================================

    -- Detected card type (basic, cloze, qa, definition)
    detected_card_type VARCHAR(20),

    -- ============================================================
    -- LANGUAGE DETECTION
    -- ============================================================

    -- ISO 639-1 language code (e.g., 'en', 'es', 'zh')
    detected_language VARCHAR(10),

    -- ============================================================
    -- ANALYSIS METADATA
    -- ============================================================

    -- Method used for analysis
    analysis_method VARCHAR(20) NOT NULL DEFAULT 'rule_based',

    -- Flexible storage for additional analysis data
    raw_analysis JSONB DEFAULT '{}',

    -- Processing status
    status analysis_status NOT NULL DEFAULT 'pending',

    -- Error message if failed
    error_message TEXT,

    -- ============================================================
    -- TIMESTAMPS
    -- ============================================================

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Unique constraint on card + version
    CONSTRAINT unique_card_version UNIQUE (card_id, analysis_version)
);

-- ============================================================
-- TABLE: analysis_jobs (PostgreSQL-based job queue)
-- ============================================================

CREATE TABLE analysis_jobs (
    -- Primary key with prefixed ULID (job_)
    job_id VARCHAR(30) PRIMARY KEY,

    -- Job target (one of these should be set)
    card_id VARCHAR(30),             -- Single card job
    deck_id VARCHAR(30),             -- Batch job (imports)

    -- Job type
    job_type VARCHAR(20) NOT NULL DEFAULT 'single',

    -- Processing status
    status job_status NOT NULL DEFAULT 'pending',

    -- Priority (0 = normal, higher = more urgent)
    priority INTEGER NOT NULL DEFAULT 0,

    -- Retry tracking
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- Worker claiming
    locked_by VARCHAR(50),           -- Worker ID that claimed this job
    locked_at TIMESTAMP WITH TIME ZONE,

    -- Batch job progress
    total_cards INTEGER,
    processed_cards INTEGER DEFAULT 0,
    failed_cards INTEGER DEFAULT 0,

    -- Error tracking
    last_error TEXT,

    -- User context
    user_id VARCHAR(30),

    -- ============================================================
    -- TIMESTAMPS
    -- ============================================================

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- INDEXES
-- ============================================================

-- card_analysis indexes
CREATE INDEX idx_card_analysis_card_id ON card_analysis(card_id);
CREATE INDEX idx_card_analysis_status ON card_analysis(status);
CREATE INDEX idx_card_analysis_domain ON card_analysis(detected_domain);
CREATE INDEX idx_card_analysis_complexity ON card_analysis(complexity_level);
CREATE INDEX idx_card_analysis_card_version ON card_analysis(card_id, analysis_version);

-- analysis_jobs indexes
CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_priority ON analysis_jobs(priority DESC, created_at ASC)
    WHERE status = 'pending';
CREATE INDEX idx_analysis_jobs_card_id ON analysis_jobs(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_analysis_jobs_deck_id ON analysis_jobs(deck_id) WHERE deck_id IS NOT NULL;
CREATE INDEX idx_analysis_jobs_locked ON analysis_jobs(locked_at)
    WHERE status = 'processing';
CREATE INDEX idx_analysis_jobs_user ON analysis_jobs(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to atomically claim analysis jobs
-- Uses SKIP LOCKED to prevent contention
CREATE OR REPLACE FUNCTION claim_analysis_job(
    p_worker_id VARCHAR(50),
    p_batch_limit INTEGER DEFAULT 10
)
RETURNS SETOF analysis_jobs AS $$
BEGIN
    RETURN QUERY
    UPDATE analysis_jobs
    SET
        status = 'processing',
        locked_by = p_worker_id,
        locked_at = CURRENT_TIMESTAMP,
        attempt_count = attempt_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE job_id IN (
        SELECT job_id
        FROM analysis_jobs
        WHERE status = 'pending'
          AND attempt_count < max_attempts
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Function to release stale jobs (stuck > N minutes)
CREATE OR REPLACE FUNCTION release_stale_jobs(
    p_stale_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    UPDATE analysis_jobs
    SET
        status = 'pending',
        locked_by = NULL,
        locked_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing'
      AND locked_at < NOW() - (p_stale_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS released_count = ROW_COUNT;
    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to complete an analysis job
CREATE OR REPLACE FUNCTION complete_analysis_job(
    p_job_id VARCHAR(30),
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL,
    p_processed INTEGER DEFAULT NULL,
    p_failed INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE analysis_jobs
    SET
        status = CASE
            WHEN p_success THEN 'completed'::job_status
            WHEN attempt_count >= max_attempts THEN 'failed'::job_status
            ELSE 'pending'::job_status  -- Will be retried
        END,
        locked_by = NULL,
        locked_at = NULL,
        last_error = CASE WHEN p_success THEN NULL ELSE p_error END,
        processed_cards = COALESCE(p_processed, processed_cards),
        failed_cards = COALESCE(p_failed, failed_cards),
        completed_at = CASE WHEN p_success THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE job_id = p_job_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Reuse existing update_updated_at_column function
CREATE TRIGGER update_card_analysis_updated_at
    BEFORE UPDATE ON card_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_jobs_updated_at
    BEFORE UPDATE ON analysis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE card_analysis IS 'Stores content analysis metadata for cards including domain detection, complexity scoring, and concept extraction for knowledge graph and AI features.';
COMMENT ON TABLE analysis_jobs IS 'PostgreSQL-based job queue for background card analysis processing. Supports single cards, batch deck analysis, and re-analysis.';

COMMENT ON COLUMN card_analysis.analysis_id IS 'Prefixed ULID: ana_01HXXXXXXXXXXXXXXXXXXXXXXX';
COMMENT ON COLUMN card_analysis.domain_confidence IS 'Confidence in domain detection: topScore / totalScore (0.000-1.000)';
COMMENT ON COLUMN card_analysis.secondary_domains IS 'Alternative domains with scores > 30% of primary domain';
COMMENT ON COLUMN card_analysis.extracted_concepts IS 'Key terms and concepts extracted from card content';
COMMENT ON COLUMN card_analysis.complexity_score IS 'Raw complexity score based on vocabulary, sentence length, and domain-specific terms';
COMMENT ON COLUMN card_analysis.analysis_method IS 'Method used: rule_based, llm, or hybrid';
COMMENT ON COLUMN card_analysis.raw_analysis IS 'Flexible JSON storage for additional analysis data (LLM responses, debug info)';

COMMENT ON COLUMN analysis_jobs.job_id IS 'Prefixed ULID: job_01HXXXXXXXXXXXXXXXXXXXXXXX';
COMMENT ON COLUMN analysis_jobs.locked_by IS 'Worker ID that has claimed this job for processing';
COMMENT ON COLUMN analysis_jobs.locked_at IS 'When job was claimed - used for stale job detection (10 min timeout)';

COMMENT ON FUNCTION claim_analysis_job IS 'Atomically claims up to batch_limit pending jobs using SKIP LOCKED to prevent contention';
COMMENT ON FUNCTION release_stale_jobs IS 'Releases jobs stuck in processing state for longer than stale_minutes (default 10)';
COMMENT ON FUNCTION complete_analysis_job IS 'Marks job as completed or failed, handles retry logic based on attempt count';

COMMIT;
