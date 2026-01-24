-- Migration: Create research data export infrastructure
-- Description: Privacy-by-design infrastructure for anonymized learning data exports
-- Key principles: Consent-aware, privacy-first, reproducible, cost-efficient

-- ==================== EXTENSIONS ====================

-- Required for gen_random_bytes() and sha256()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== ENUMS ====================

-- Export job status
DO $$ BEGIN
    CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Data classification for anonymization
DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM ('keep', 'anonymize', 'hash', 'remove', 'relativize');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ==================== TABLES ====================

-- Anonymous Learner IDs (ALIDs)
-- Maps real user_id to rotating anonymous learner IDs
CREATE TABLE IF NOT EXISTS anonymous_learner_ids (
    alid_id VARCHAR(50) PRIMARY KEY,                    -- alid_[ulid]
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    anonymous_id VARCHAR(64) NOT NULL,                  -- SHA-256 hash (salted)
    rotation_salt VARCHAR(32) NOT NULL,                 -- Per-rotation salt
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,               -- NULL = current active ALID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_alid_user_validity ON anonymous_learner_ids(user_id, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_alid_anonymous_id ON anonymous_learner_ids(anonymous_id);

COMMENT ON TABLE anonymous_learner_ids IS 'Maps real user IDs to rotating anonymous learner IDs for research exports';
COMMENT ON COLUMN anonymous_learner_ids.anonymous_id IS 'SHA-256 hash of user_id with rotation salt - consistent within rotation period';
COMMENT ON COLUMN anonymous_learner_ids.valid_until IS 'NULL indicates the currently active ALID for this user';

-- Research Exports
-- Tracks export jobs and metadata
CREATE TABLE IF NOT EXISTS research_exports (
    export_id VARCHAR(30) PRIMARY KEY,                  -- exp_[ulid]
    export_type VARCHAR(30) NOT NULL,                   -- sessions, reviews, statistics, full
    schema_version VARCHAR(20) NOT NULL,                -- e.g., "1.0.0"
    status export_status NOT NULL DEFAULT 'pending',
    watermark_from TIMESTAMP WITH TIME ZONE,            -- Start of data range
    watermark_to TIMESTAMP WITH TIME ZONE,              -- End of data range
    filters JSONB DEFAULT '{}',                         -- Applied filters (e.g., date range, cohorts)
    output_format VARCHAR(10) NOT NULL DEFAULT 'jsonl', -- jsonl, parquet
    output_path TEXT,                                   -- File location when completed
    record_count INTEGER DEFAULT 0,                     -- Rows exported
    file_size_bytes BIGINT DEFAULT 0,                   -- Output file size
    checksum VARCHAR(64),                               -- SHA-256 of output file
    created_by VARCHAR(50) REFERENCES users(user_id),   -- Admin user who created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,                -- When processing began
    completed_at TIMESTAMP WITH TIME ZONE,              -- When completed
    error_message TEXT,                                 -- Error details if failed

    CONSTRAINT valid_export_type CHECK (export_type IN ('sessions', 'reviews', 'statistics', 'card_analysis', 'full')),
    CONSTRAINT valid_output_format CHECK (output_format IN ('jsonl', 'parquet'))
);

CREATE INDEX IF NOT EXISTS idx_exports_status ON research_exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_type_status ON research_exports(export_type, status);
CREATE INDEX IF NOT EXISTS idx_exports_created_by ON research_exports(created_by);

COMMENT ON TABLE research_exports IS 'Tracks research data export jobs, their status, and output metadata';
COMMENT ON COLUMN research_exports.watermark_from IS 'Incremental export: start timestamp for data to include';
COMMENT ON COLUMN research_exports.watermark_to IS 'Incremental export: end timestamp for data to include';

-- Export Schema Versions
-- Documents each schema version for reproducibility
CREATE TABLE IF NOT EXISTS export_schema_versions (
    version_id VARCHAR(30) PRIMARY KEY,                 -- ver_[ulid]
    version VARCHAR(20) NOT NULL,                       -- Semantic version (e.g., "1.0.0")
    export_type VARCHAR(30) NOT NULL,                   -- Which data type this schema applies to
    schema_json JSONB NOT NULL,                         -- Full schema definition (field names, types)
    field_mappings JSONB NOT NULL DEFAULT '{}',         -- Source table.column → export field mappings
    anonymization_rules JSONB NOT NULL DEFAULT '{}',    -- How each field is processed
    release_notes TEXT,                                 -- What changed in this version
    is_current BOOLEAN DEFAULT false,                   -- Is this the current version for this type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_version_type UNIQUE(version, export_type)
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_type ON export_schema_versions(export_type, is_current);

COMMENT ON TABLE export_schema_versions IS 'Versioned schemas for reproducible research exports';
COMMENT ON COLUMN export_schema_versions.schema_json IS 'JSON Schema definition for the export format';

-- Export Data Dictionary
-- Human-readable field documentation
CREATE TABLE IF NOT EXISTS export_data_dictionary (
    field_id VARCHAR(30) PRIMARY KEY,                   -- fld_[ulid]
    export_type VARCHAR(30) NOT NULL,                   -- Which export this field belongs to
    field_name VARCHAR(100) NOT NULL,                   -- Name in export file
    source_table VARCHAR(100),                          -- Original table (NULL if computed)
    source_column VARCHAR(100),                         -- Original column (NULL if computed)
    data_type VARCHAR(50) NOT NULL,                     -- string, integer, float, boolean, timestamp
    classification data_classification NOT NULL,        -- How this field is processed
    description TEXT NOT NULL,                          -- Human-readable description
    example_values TEXT[],                              -- Sample values for documentation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_field_in_export UNIQUE(export_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_data_dictionary_type ON export_data_dictionary(export_type);

COMMENT ON TABLE export_data_dictionary IS 'Human-readable documentation for each field in research exports';

-- ==================== EXTEND USERS TABLE ====================

-- Add role column to users table for admin authorization
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add constraint for valid roles
DO $$ BEGIN
    ALTER TABLE users
        ADD CONSTRAINT valid_user_role
        CHECK (role IN ('user', 'admin', 'moderator'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN users.role IS 'User role for authorization (user, admin, moderator)';

-- ==================== EXTEND PRIVACY_SETTINGS ====================

-- Add research consent fields to existing privacy_settings table
ALTER TABLE privacy_settings
    ADD COLUMN IF NOT EXISTS research_consent BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS research_consent_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS research_consent_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS data_retention_preference VARCHAR(20) DEFAULT 'standard';

-- Add constraint for data retention preference
DO $$ BEGIN
    ALTER TABLE privacy_settings
        ADD CONSTRAINT valid_retention_preference
        CHECK (data_retention_preference IN ('standard', 'minimum', 'extended'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN privacy_settings.research_consent IS 'User opt-in for anonymized data in research exports';
COMMENT ON COLUMN privacy_settings.research_consent_date IS 'When user gave or withdrew research consent';
COMMENT ON COLUMN privacy_settings.research_consent_version IS 'Version of consent form user agreed to';
COMMENT ON COLUMN privacy_settings.data_retention_preference IS 'How long to retain user learning data';

-- ==================== FUNCTIONS ====================

-- Get or create current ALID for a user
CREATE OR REPLACE FUNCTION get_or_create_alid(p_user_id VARCHAR(50))
RETURNS VARCHAR(64) AS $$
DECLARE
    v_alid_id VARCHAR(50);
    v_anonymous_id VARCHAR(64);
    v_salt VARCHAR(32);
BEGIN
    -- Check for existing current ALID
    SELECT anonymous_id INTO v_anonymous_id
    FROM anonymous_learner_ids
    WHERE user_id = p_user_id
      AND valid_until IS NULL
    LIMIT 1;

    IF v_anonymous_id IS NOT NULL THEN
        RETURN v_anonymous_id;
    END IF;

    -- Generate new ALID
    v_alid_id := 'alid_' || gen_random_ulid();
    v_salt := encode(gen_random_bytes(16), 'hex');
    v_anonymous_id := encode(sha256((p_user_id || v_salt)::bytea), 'hex');

    INSERT INTO anonymous_learner_ids (alid_id, user_id, anonymous_id, rotation_salt, valid_from)
    VALUES (v_alid_id, p_user_id, v_anonymous_id, v_salt, CURRENT_TIMESTAMP);

    RETURN v_anonymous_id;
END;
$$ LANGUAGE plpgsql;

-- ULID generator for PostgreSQL (if not exists)
CREATE OR REPLACE FUNCTION gen_random_ulid()
RETURNS TEXT AS $$
DECLARE
    timestamp_part TEXT;
    random_part TEXT;
    encoding TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    ms BIGINT;
    i INT;
BEGIN
    -- Get current timestamp in milliseconds
    ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

    -- Encode timestamp (10 chars)
    timestamp_part := '';
    FOR i IN REVERSE 9..0 LOOP
        timestamp_part := substring(encoding FROM ((ms % 32)::INT + 1) FOR 1) || timestamp_part;
        ms := ms / 32;
    END LOOP;

    -- Generate random part (16 chars)
    random_part := '';
    FOR i IN 1..16 LOOP
        random_part := random_part || substring(encoding FROM (floor(random() * 32)::INT + 1) FOR 1);
    END LOOP;

    RETURN timestamp_part || random_part;
END;
$$ LANGUAGE plpgsql;

-- Rotate ALIDs (quarterly recommended)
-- Marks current ALIDs as expired and creates new ones for all users with research consent
CREATE OR REPLACE FUNCTION rotate_alids()
RETURNS INTEGER AS $$
DECLARE
    v_rotated_count INTEGER := 0;
    v_user_record RECORD;
    v_new_alid_id VARCHAR(30);
    v_new_salt VARCHAR(32);
    v_new_anonymous_id VARCHAR(64);
BEGIN
    -- Mark all current ALIDs as expired
    UPDATE anonymous_learner_ids
    SET valid_until = CURRENT_TIMESTAMP
    WHERE valid_until IS NULL;

    GET DIAGNOSTICS v_rotated_count = ROW_COUNT;

    -- Create new ALIDs for users with research consent
    FOR v_user_record IN
        SELECT ps.user_id
        FROM privacy_settings ps
        WHERE ps.research_consent = true
    LOOP
        v_new_alid_id := 'alid_' || gen_random_ulid();
        v_new_salt := encode(gen_random_bytes(16), 'hex');
        v_new_anonymous_id := encode(sha256((v_user_record.user_id || v_new_salt)::bytea), 'hex');

        INSERT INTO anonymous_learner_ids (alid_id, user_id, anonymous_id, rotation_salt, valid_from)
        VALUES (v_new_alid_id, v_user_record.user_id, v_new_anonymous_id, v_new_salt, CURRENT_TIMESTAMP);
    END LOOP;

    RETURN v_rotated_count;
END;
$$ LANGUAGE plpgsql;

-- Get consented user IDs for a specific time period
-- Used by export service to filter data
CREATE OR REPLACE FUNCTION get_consented_user_ids()
RETURNS TABLE(user_id VARCHAR(50), anonymous_id VARCHAR(64)) AS $$
BEGIN
    RETURN QUERY
    SELECT ps.user_id, a.anonymous_id
    FROM privacy_settings ps
    JOIN anonymous_learner_ids a ON ps.user_id = a.user_id AND a.valid_until IS NULL
    WHERE ps.research_consent = true;
END;
$$ LANGUAGE plpgsql;

-- Claim an export job for processing
CREATE OR REPLACE FUNCTION claim_export_job(p_worker_id VARCHAR(100))
RETURNS TABLE(
    export_id VARCHAR(30),
    export_type VARCHAR(30),
    schema_version VARCHAR(20),
    watermark_from TIMESTAMP WITH TIME ZONE,
    watermark_to TIMESTAMP WITH TIME ZONE,
    filters JSONB,
    output_format VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        UPDATE research_exports re_update
        SET status = 'processing',
            started_at = CURRENT_TIMESTAMP
        WHERE re_update.export_id = (
            SELECT re.export_id
            FROM research_exports re
            WHERE re.status = 'pending'
            ORDER BY re.created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING re_update.*
    )
    SELECT c.export_id, c.export_type, c.schema_version,
           c.watermark_from, c.watermark_to, c.filters, c.output_format
    FROM claimed c;
END;
$$ LANGUAGE plpgsql;

-- Complete an export job
CREATE OR REPLACE FUNCTION complete_export_job(
    p_export_id VARCHAR(30),
    p_success BOOLEAN,
    p_output_path TEXT DEFAULT NULL,
    p_record_count INTEGER DEFAULT 0,
    p_file_size_bytes BIGINT DEFAULT 0,
    p_checksum VARCHAR(64) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE research_exports
    SET status = CASE WHEN p_success THEN 'completed'::export_status ELSE 'failed'::export_status END,
        output_path = COALESCE(p_output_path, output_path),
        record_count = p_record_count,
        file_size_bytes = p_file_size_bytes,
        checksum = p_checksum,
        completed_at = CURRENT_TIMESTAMP,
        error_message = p_error_message
    WHERE export_id = p_export_id;
END;
$$ LANGUAGE plpgsql;

-- ==================== COMMENTS ====================

COMMENT ON FUNCTION get_or_create_alid IS 'Returns the current anonymous learner ID for a user, creating one if needed';
COMMENT ON FUNCTION rotate_alids IS 'Rotates all ALIDs - run quarterly for privacy protection';
COMMENT ON FUNCTION get_consented_user_ids IS 'Returns user IDs that have opted into research data collection';
COMMENT ON FUNCTION claim_export_job IS 'Atomically claims a pending export job for processing';
COMMENT ON FUNCTION complete_export_job IS 'Marks an export job as completed or failed with results';
