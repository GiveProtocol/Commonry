/**
 * Data Dictionary Seed
 *
 * Seeds the export_data_dictionary table with field definitions
 * for all research export types. Also seeds the initial schema versions.
 *
 * Run with: node data-dictionary-seed.js
 */

import pool from "./db.js";
import { ulid } from "ulid";

// Schema version definitions
const SCHEMA_VERSIONS = [
  {
    version: "1.0.0",
    exportType: "sessions",
    schemaJson: {
      type: "object",
      properties: {
        anonymous_learner_id: { type: "string", maxLength: 64 },
        anonymous_session_id: { type: "string", maxLength: 64 },
        anonymous_deck_id: { type: ["string", "null"], maxLength: 64 },
        session_start_offset: { type: "integer" },
        session_duration_seconds: { type: ["integer", "null"] },
        cards_studied: { type: "integer" },
        correct_count: { type: "integer" },
        incorrect_count: { type: "integer" },
        total_time_seconds: { type: ["integer", "null"] },
        average_response_time_ms: { type: ["number", "null"] },
        session_type: { type: "string" },
        client_type: { type: "string" },
        platform_category: { type: "string" },
      },
      required: ["anonymous_learner_id", "anonymous_session_id"],
    },
    releaseNotes: "Initial schema version for session exports",
  },
  {
    version: "1.0.0",
    exportType: "reviews",
    schemaJson: {
      type: "object",
      properties: {
        anonymous_event_id: { type: "string", maxLength: 64 },
        anonymous_session_id: { type: "string", maxLength: 64 },
        anonymous_card_id: { type: "string", maxLength: 64 },
        anonymous_learner_id: { type: "string", maxLength: 64 },
        event_offset_ms: { type: ["integer", "null"] },
        response_quality: { type: "integer", minimum: 0, maximum: 5 },
        response_time_ms: { type: ["integer", "null"] },
        ease_factor: { type: ["number", "null"] },
        interval_days: { type: ["integer", "null"] },
        review_type: { type: "string" },
      },
      required: ["anonymous_event_id", "anonymous_learner_id"],
    },
    releaseNotes: "Initial schema version for review event exports",
  },
  {
    version: "1.0.0",
    exportType: "statistics",
    schemaJson: {
      type: "object",
      properties: {
        anonymous_learner_id: { type: "string", maxLength: 64 },
        total_reviews: { type: "integer" },
        total_study_time_minutes: { type: ["integer", "null"] },
        current_streak_days: { type: "integer" },
        longest_streak_days: { type: "integer" },
        average_accuracy: { type: ["number", "null"] },
        cards_mastered: { type: "integer" },
      },
      required: ["anonymous_learner_id"],
    },
    releaseNotes: "Initial schema version for statistics exports",
  },
  {
    version: "1.0.0",
    exportType: "card_analysis",
    schemaJson: {
      type: "object",
      properties: {
        anonymous_card_id: { type: "string", maxLength: 64 },
        content_domain: { type: ["string", "null"] },
        complexity_level: { type: ["string", "null"] },
        language: { type: ["string", "null"] },
        front_word_count: { type: ["integer", "null"] },
        back_word_count: { type: ["integer", "null"] },
      },
      required: ["anonymous_card_id"],
    },
    releaseNotes: "Initial schema version for card analysis exports",
  },
];

// Data dictionary entries
const DATA_DICTIONARY = [
  // ==================== SESSION FIELDS ====================
  {
    exportType: "sessions",
    fieldName: "anonymous_learner_id",
    sourceTable: "anonymous_learner_ids",
    sourceColumn: "anonymous_id",
    dataType: "string",
    classification: "hash",
    description:
      "SHA-256 hash of user ID with rotation salt. Consistent within rotation period (quarterly).",
    exampleValues: ["a1b2c3d4e5f6...", "9f8e7d6c5b4a..."],
  },
  {
    exportType: "sessions",
    fieldName: "anonymous_session_id",
    sourceTable: "session_tracking",
    sourceColumn: "session_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of original session ID. Links sessions to review events.",
    exampleValues: ["1a2b3c4d5e6f...", "f6e5d4c3b2a1..."],
  },
  {
    exportType: "sessions",
    fieldName: "anonymous_deck_id",
    sourceTable: "session_tracking",
    sourceColumn: "deck_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of deck ID. Null if session spans multiple decks.",
    exampleValues: ["abc123def456...", null],
  },
  {
    exportType: "sessions",
    fieldName: "session_start_offset",
    sourceTable: null,
    sourceColumn: null,
    dataType: "integer",
    classification: "relativize",
    description: "Always 0. Reference point for other timestamps in the session.",
    exampleValues: ["0"],
  },
  {
    exportType: "sessions",
    fieldName: "session_duration_seconds",
    sourceTable: "session_tracking",
    sourceColumn: "ended_at - started_at",
    dataType: "integer",
    classification: "relativize",
    description: "Session duration in seconds. Null if session not ended.",
    exampleValues: ["300", "1800", "45"],
  },
  {
    exportType: "sessions",
    fieldName: "cards_studied",
    sourceTable: "session_tracking",
    sourceColumn: "cards_studied",
    dataType: "integer",
    classification: "keep",
    description: "Total number of cards reviewed in this session.",
    exampleValues: ["25", "100", "5"],
  },
  {
    exportType: "sessions",
    fieldName: "correct_count",
    sourceTable: "session_tracking",
    sourceColumn: "correct_count",
    dataType: "integer",
    classification: "keep",
    description: "Number of cards answered correctly (response quality >= 3).",
    exampleValues: ["20", "85", "3"],
  },
  {
    exportType: "sessions",
    fieldName: "incorrect_count",
    sourceTable: "session_tracking",
    sourceColumn: "incorrect_count",
    dataType: "integer",
    classification: "keep",
    description: "Number of cards answered incorrectly (response quality < 3).",
    exampleValues: ["5", "15", "2"],
  },
  {
    exportType: "sessions",
    fieldName: "total_time_seconds",
    sourceTable: "session_tracking",
    sourceColumn: "total_time_seconds",
    dataType: "integer",
    classification: "keep",
    description: "Total active study time in seconds (may differ from duration).",
    exampleValues: ["280", "1500", "40"],
  },
  {
    exportType: "sessions",
    fieldName: "average_response_time_ms",
    sourceTable: "session_tracking",
    sourceColumn: "average_response_time_ms",
    dataType: "float",
    classification: "keep",
    description: "Average time to respond to cards in milliseconds.",
    exampleValues: ["2500.5", "1800.0", "4200.75"],
  },
  {
    exportType: "sessions",
    fieldName: "session_type",
    sourceTable: "session_tracking",
    sourceColumn: "session_type",
    dataType: "string",
    classification: "keep",
    description: "Type of study session (review, learn, cram, etc.).",
    exampleValues: ["review", "learn", "cram"],
  },
  {
    exportType: "sessions",
    fieldName: "client_type",
    sourceTable: "session_tracking",
    sourceColumn: "client_info",
    dataType: "string",
    classification: "anonymize",
    description: "Anonymized device category derived from client info.",
    exampleValues: ["mobile", "desktop", "tablet", "unknown"],
  },
  {
    exportType: "sessions",
    fieldName: "platform_category",
    sourceTable: "session_tracking",
    sourceColumn: "user_agent",
    dataType: "string",
    classification: "anonymize",
    description: "Anonymized platform/browser category derived from user agent.",
    exampleValues: ["iOS", "Android", "Chrome", "Safari", "Firefox"],
  },

  // ==================== REVIEW EVENT FIELDS ====================
  {
    exportType: "reviews",
    fieldName: "anonymous_event_id",
    sourceTable: "review_events",
    sourceColumn: "event_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of original event ID.",
    exampleValues: ["e1f2a3b4c5d6...", "6d5c4b3a2f1e..."],
  },
  {
    exportType: "reviews",
    fieldName: "anonymous_session_id",
    sourceTable: "review_events",
    sourceColumn: "session_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of session ID. Links to sessions export.",
    exampleValues: ["1a2b3c4d5e6f...", "f6e5d4c3b2a1..."],
  },
  {
    exportType: "reviews",
    fieldName: "anonymous_card_id",
    sourceTable: "review_events",
    sourceColumn: "card_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of card ID. Links to card_analysis export.",
    exampleValues: ["c1a2r3d4i5d6...", "d6i5d4r3a2c1..."],
  },
  {
    exportType: "reviews",
    fieldName: "anonymous_learner_id",
    sourceTable: "anonymous_learner_ids",
    sourceColumn: "anonymous_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of user ID. Links to other exports for same learner.",
    exampleValues: ["a1b2c3d4e5f6...", "9f8e7d6c5b4a..."],
  },
  {
    exportType: "reviews",
    fieldName: "event_offset_ms",
    sourceTable: "review_events",
    sourceColumn: "created_at",
    dataType: "integer",
    classification: "relativize",
    description: "Milliseconds from session start. Preserves temporal ordering.",
    exampleValues: ["0", "15000", "120500"],
  },
  {
    exportType: "reviews",
    fieldName: "response_quality",
    sourceTable: "review_events",
    sourceColumn: "response_quality",
    dataType: "integer",
    classification: "keep",
    description: "User's self-reported recall quality (0-5, SM-2 scale).",
    exampleValues: ["0", "3", "5"],
  },
  {
    exportType: "reviews",
    fieldName: "response_time_ms",
    sourceTable: "review_events",
    sourceColumn: "response_time_ms",
    dataType: "integer",
    classification: "keep",
    description: "Time from card display to response in milliseconds.",
    exampleValues: ["1500", "5000", "800"],
  },
  {
    exportType: "reviews",
    fieldName: "ease_factor",
    sourceTable: "review_events",
    sourceColumn: "ease_factor",
    dataType: "float",
    classification: "keep",
    description: "SM-2 ease factor after this review (typically 1.3-2.5).",
    exampleValues: ["2.5", "1.8", "2.1"],
  },
  {
    exportType: "reviews",
    fieldName: "interval_days",
    sourceTable: "review_events",
    sourceColumn: "interval_days",
    dataType: "integer",
    classification: "keep",
    description: "Days until next scheduled review after this review.",
    exampleValues: ["1", "7", "30"],
  },
  {
    exportType: "reviews",
    fieldName: "review_type",
    sourceTable: "review_events",
    sourceColumn: "review_type",
    dataType: "string",
    classification: "keep",
    description: "Type of review (new, review, relearn, filtered).",
    exampleValues: ["new", "review", "relearn"],
  },

  // ==================== STATISTICS FIELDS ====================
  {
    exportType: "statistics",
    fieldName: "anonymous_learner_id",
    sourceTable: "anonymous_learner_ids",
    sourceColumn: "anonymous_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of user ID.",
    exampleValues: ["a1b2c3d4e5f6...", "9f8e7d6c5b4a..."],
  },
  {
    exportType: "statistics",
    fieldName: "total_reviews",
    sourceTable: "user_statistics",
    sourceColumn: "total_reviews",
    dataType: "integer",
    classification: "keep",
    description: "Total number of card reviews by this learner.",
    exampleValues: ["500", "10000", "50"],
  },
  {
    exportType: "statistics",
    fieldName: "total_study_time_minutes",
    sourceTable: "user_statistics",
    sourceColumn: "total_study_time_minutes",
    dataType: "integer",
    classification: "keep",
    description: "Total study time in minutes.",
    exampleValues: ["120", "5000", "30"],
  },
  {
    exportType: "statistics",
    fieldName: "current_streak_days",
    sourceTable: "user_statistics",
    sourceColumn: "current_streak_days",
    dataType: "integer",
    classification: "keep",
    description: "Current consecutive days studied.",
    exampleValues: ["7", "30", "0"],
  },
  {
    exportType: "statistics",
    fieldName: "longest_streak_days",
    sourceTable: "user_statistics",
    sourceColumn: "longest_streak_days",
    dataType: "integer",
    classification: "keep",
    description: "Longest consecutive days studied ever.",
    exampleValues: ["30", "365", "7"],
  },
  {
    exportType: "statistics",
    fieldName: "average_accuracy",
    sourceTable: "user_statistics",
    sourceColumn: "average_accuracy",
    dataType: "float",
    classification: "keep",
    description: "Overall accuracy rate (0.0-1.0).",
    exampleValues: ["0.85", "0.92", "0.70"],
  },
  {
    exportType: "statistics",
    fieldName: "cards_mastered",
    sourceTable: "user_statistics",
    sourceColumn: "cards_mastered",
    dataType: "integer",
    classification: "keep",
    description: "Number of cards with interval > 21 days.",
    exampleValues: ["100", "500", "25"],
  },

  // ==================== CARD ANALYSIS FIELDS ====================
  {
    exportType: "card_analysis",
    fieldName: "anonymous_card_id",
    sourceTable: "card_analysis",
    sourceColumn: "card_id",
    dataType: "string",
    classification: "hash",
    description: "SHA-256 hash of card ID. Links to review events.",
    exampleValues: ["c1a2r3d4i5d6...", "d6i5d4r3a2c1..."],
  },
  {
    exportType: "card_analysis",
    fieldName: "content_domain",
    sourceTable: "card_analysis",
    sourceColumn: "detected_domain",
    dataType: "string",
    classification: "keep",
    description: "Detected subject domain of card content.",
    exampleValues: ["mathematics", "language", "science", "history"],
  },
  {
    exportType: "card_analysis",
    fieldName: "complexity_level",
    sourceTable: "card_analysis",
    sourceColumn: "complexity_level",
    dataType: "string",
    classification: "keep",
    description: "Estimated complexity level of the card.",
    exampleValues: ["basic", "intermediate", "advanced"],
  },
  {
    exportType: "card_analysis",
    fieldName: "language",
    sourceTable: "card_analysis",
    sourceColumn: "detected_language",
    dataType: "string",
    classification: "keep",
    description: "Detected language of card content.",
    exampleValues: ["en", "es", "zh", "ja"],
  },
  {
    exportType: "card_analysis",
    fieldName: "front_word_count",
    sourceTable: "card_analysis",
    sourceColumn: "front_word_count",
    dataType: "integer",
    classification: "keep",
    description: "Number of words on the front (question) side.",
    exampleValues: ["5", "20", "50"],
  },
  {
    exportType: "card_analysis",
    fieldName: "back_word_count",
    sourceTable: "card_analysis",
    sourceColumn: "back_word_count",
    dataType: "integer",
    classification: "keep",
    description: "Number of words on the back (answer) side.",
    exampleValues: ["10", "50", "100"],
  },
];

/**
 * Seed the database with schema versions and data dictionary
 */
async function seed() {
  console.log("Seeding research export schema versions and data dictionary...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Seed schema versions
    console.log("Seeding schema versions...");
    for (const schema of SCHEMA_VERSIONS) {
      await client.query(
        `INSERT INTO export_schema_versions
         (version_id, version, export_type, schema_json, field_mappings, anonymization_rules, release_notes, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (version, export_type) DO UPDATE SET
           schema_json = EXCLUDED.schema_json,
           release_notes = EXCLUDED.release_notes,
           is_current = true`,
        [
          `ver_${ulid()}`,
          schema.version,
          schema.exportType,
          JSON.stringify(schema.schemaJson),
          JSON.stringify({}),
          JSON.stringify({}),
          schema.releaseNotes,
        ]
      );
    }
    console.log(`  Seeded ${SCHEMA_VERSIONS.length} schema versions`);

    // Seed data dictionary
    console.log("Seeding data dictionary...");
    for (const field of DATA_DICTIONARY) {
      await client.query(
        `INSERT INTO export_data_dictionary
         (field_id, export_type, field_name, source_table, source_column,
          data_type, classification, description, example_values)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (export_type, field_name) DO UPDATE SET
           source_table = EXCLUDED.source_table,
           source_column = EXCLUDED.source_column,
           data_type = EXCLUDED.data_type,
           classification = EXCLUDED.classification,
           description = EXCLUDED.description,
           example_values = EXCLUDED.example_values,
           updated_at = CURRENT_TIMESTAMP`,
        [
          `fld_${ulid()}`,
          field.exportType,
          field.fieldName,
          field.sourceTable,
          field.sourceColumn,
          field.dataType,
          field.classification,
          field.description,
          field.exampleValues,
        ]
      );
    }
    console.log(`  Seeded ${DATA_DICTIONARY.length} data dictionary entries`);

    await client.query("COMMIT");
    console.log("Seeding completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith("data-dictionary-seed.js");
if (isMainModule) {
  seed()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}

export { seed, SCHEMA_VERSIONS, DATA_DICTIONARY };
export default seed;
