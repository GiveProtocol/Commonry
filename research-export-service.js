/**
 * Research Export Service
 *
 * Core service for orchestrating anonymized research data exports.
 * Handles export job creation, data extraction with consent filtering,
 * schema validation, and output formatting.
 *
 * Key Features:
 * - Consent-aware: Only exports data from opted-in users
 * - Incremental: Watermark-based exports for efficiency
 * - Reproducible: Versioned schemas with data dictionaries
 * - Privacy-first: All data processed through DataAnonymizer
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ulid } from "ulid";
import { DataAnonymizer } from "./data-anonymizer.js";

// Current schema versions for each export type
const CURRENT_SCHEMA_VERSIONS = {
  sessions: "1.0.0",
  reviews: "1.0.0",
  statistics: "1.0.0",
  card_analysis: "1.0.0",
  full: "1.0.0",
};

// Default batch sizes for extraction
const DEFAULT_BATCH_SIZE = 1000;

export class ResearchExportService {
  /**
   * Create a new ResearchExportService instance
   *
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   * @param {DataAnonymizer} [anonymizer] - Optional pre-configured anonymizer
   * @param {Object} options - Configuration options
   */
  constructor(pool, anonymizer = null, options = {}) {
    this.pool = pool;
    this.anonymizer = anonymizer || new DataAnonymizer(pool);
    this.options = {
      exportDir:
        options.exportDir ||
        process.env.RESEARCH_EXPORT_DIR ||
        "./exports/research",
      batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
      ...options,
    };

    // Ensure export directory exists
    if (!fs.existsSync(this.options.exportDir)) {
      fs.mkdirSync(this.options.exportDir, { recursive: true });
    }
  }

  // ============================================================
  // EXPORT ORCHESTRATION
  // ============================================================

  /**
   * Create a new export job
   *
   * @param {string} type - Export type: sessions, reviews, statistics, card_analysis, full
   * @param {Object} options - Export options
   * @param {string} [options.format='jsonl'] - Output format: jsonl or parquet
   * @param {Date} [options.watermarkFrom] - Start of data range
   * @param {Date} [options.watermarkTo] - End of data range
   * @param {Object} [options.filters] - Additional filters
   * @param {string} options.createdBy - Admin user ID creating this export
   * @returns {Promise<Object>} Created export job
   */
  async createExport(type, options = {}) {
    const exportId = `exp_${ulid()}`;
    const schemaVersion = CURRENT_SCHEMA_VERSIONS[type];

    if (!schemaVersion) {
      throw new Error(`Invalid export type: ${type}`);
    }

    const format = options.format || "jsonl";
    if (!["jsonl", "parquet"].includes(format)) {
      throw new Error(`Invalid output format: ${format}`);
    }

    // Get default watermarks if not specified
    const watermarkTo = options.watermarkTo || new Date();
    const watermarkFrom =
      options.watermarkFrom || (await this.getLastWatermark(type));

    const result = await this.pool.query(
      `INSERT INTO research_exports (
        export_id, export_type, schema_version, status,
        watermark_from, watermark_to, filters, output_format, created_by
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        exportId,
        type,
        schemaVersion,
        watermarkFrom,
        watermarkTo,
        JSON.stringify(options.filters || {}),
        format,
        options.createdBy,
      ]
    );

    console.log(`[ResearchExportService] Created export job: ${exportId}`);
    return this.formatExportRecord(result.rows[0]);
  }

  /**
   * Process an export job (called by processor)
   *
   * @param {string} exportId - Export job ID
   * @returns {Promise<Object>} Completed export record
   */
  async processExport(exportId) {
    // Get export details
    const exportRecord = await this.getExportStatus(exportId);
    if (!exportRecord) {
      throw new Error(`Export not found: ${exportId}`);
    }

    if (exportRecord.status !== "processing") {
      throw new Error(
        `Export ${exportId} is not in processing state: ${exportRecord.status}`
      );
    }

    try {
      let data;
      let recordCount = 0;

      // Extract data based on type
      switch (exportRecord.exportType) {
        case "sessions":
          data = await this.extractSessions(
            exportRecord.watermarkFrom,
            exportRecord.watermarkTo
          );
          break;

        case "reviews":
          data = await this.extractReviews(
            exportRecord.watermarkFrom,
            exportRecord.watermarkTo
          );
          break;

        case "statistics":
          data = await this.extractStatistics();
          break;

        case "card_analysis":
          data = await this.extractCardAnalysis(
            exportRecord.watermarkFrom,
            exportRecord.watermarkTo
          );
          break;

        case "full":
          data = await this.extractFullExport(
            exportRecord.watermarkFrom,
            exportRecord.watermarkTo
          );
          break;

        default:
          throw new Error(`Unknown export type: ${exportRecord.exportType}`);
      }

      recordCount = Array.isArray(data) ? data.length : data.totalRecords || 0;

      // Write output file
      const outputPath = this.generateOutputPath(exportRecord);
      const { fileSize, checksum } = await this.writeJSONL(
        data,
        outputPath,
        exportRecord
      );

      // Mark as completed
      await this.pool.query(
        "SELECT complete_export_job($1, $2, $3, $4, $5, $6, $7)",
        [exportId, true, outputPath, recordCount, fileSize, checksum, null]
      );

      // Update watermark for incremental exports
      if (exportRecord.watermarkTo) {
        await this.updateWatermark(
          exportRecord.exportType,
          exportRecord.watermarkTo
        );
      }

      console.log(
        `[ResearchExportService] Completed export ${exportId}: ${recordCount} records`
      );

      return await this.getExportStatus(exportId);
    } catch (error) {
      // Mark as failed
      await this.pool.query(
        "SELECT complete_export_job($1, $2, $3, $4, $5, $6, $7)",
        [exportId, false, null, 0, 0, null, error.message]
      );

      console.error(
        `[ResearchExportService] Export ${exportId} failed:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get export job status
   *
   * @param {string} exportId - Export job ID
   * @returns {Promise<Object|null>} Export record or null
   */
  async getExportStatus(exportId) {
    const result = await this.pool.query(
      "SELECT * FROM research_exports WHERE export_id = $1",
      [exportId]
    );

    return result.rows.length > 0
      ? this.formatExportRecord(result.rows[0])
      : null;
  }

  /**
   * List exports with optional filters
   *
   * @param {Object} filters - Filter options
   * @param {string} [filters.type] - Filter by export type
   * @param {string} [filters.status] - Filter by status
   * @param {number} [filters.limit=50] - Max results
   * @param {number} [filters.offset=0] - Pagination offset
   * @returns {Promise<Object>} { exports, total }
   */
  async listExports(filters = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.type) {
      conditions.push(`export_type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM research_exports ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get records
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await this.pool.query(
      `SELECT * FROM research_exports ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      exports: result.rows.map((r) => this.formatExportRecord(r)),
      total,
      limit,
      offset,
    };
  }

  // ============================================================
  // DATA EXTRACTION (Consent-Filtered)
  // ============================================================

  /**
   * Extract study sessions for consented users
   *
   * @param {Date} watermarkFrom - Start timestamp
   * @param {Date} watermarkTo - End timestamp
   * @returns {Promise<Object[]>} Anonymized session records
   */
  async extractSessions(watermarkFrom, watermarkTo) {
    const result = await this.pool.query(
      `SELECT st.*
       FROM session_tracking st
       INNER JOIN privacy_settings ps ON st.user_id = ps.user_id
       WHERE ps.research_consent = true
         AND st.started_at >= $1
         AND st.started_at < $2
       ORDER BY st.started_at ASC`,
      [watermarkFrom, watermarkTo]
    );

    return this.anonymizer.anonymizeBatch(result.rows, "session");
  }

  /**
   * Extract review events for consented users
   *
   * @param {Date} watermarkFrom - Start timestamp
   * @param {Date} watermarkTo - End timestamp
   * @returns {Promise<Object[]>} Anonymized review event records
   */
  async extractReviews(watermarkFrom, watermarkTo) {
    // First get sessions to know their start times for timestamp relativization
    const sessionsResult = await this.pool.query(
      `SELECT DISTINCT st.session_id, st.started_at
       FROM session_tracking st
       INNER JOIN privacy_settings ps ON st.user_id = ps.user_id
       INNER JOIN review_events re ON st.session_id = re.session_id
       WHERE ps.research_consent = true
         AND re.created_at >= $1
         AND re.created_at < $2`,
      [watermarkFrom, watermarkTo]
    );

    const sessionStarts = {};
    for (const row of sessionsResult.rows) {
      sessionStarts[row.session_id] = row.started_at;
    }

    // Get review events
    const result = await this.pool.query(
      `SELECT re.*
       FROM review_events re
       INNER JOIN privacy_settings ps ON re.user_id = ps.user_id
       WHERE ps.research_consent = true
         AND re.created_at >= $1
         AND re.created_at < $2
       ORDER BY re.created_at ASC`,
      [watermarkFrom, watermarkTo]
    );

    return this.anonymizer.anonymizeBatch(result.rows, "review", {
      sessionStarts,
    });
  }

  /**
   * Extract user statistics for consented users
   *
   * @returns {Promise<Object[]>} Anonymized statistics records
   */
  async extractStatistics() {
    const result = await this.pool.query(
      `SELECT us.*
       FROM user_statistics us
       INNER JOIN privacy_settings ps ON us.user_id = ps.user_id
       WHERE ps.research_consent = true`
    );

    return this.anonymizer.anonymizeBatch(result.rows, "statistics");
  }

  /**
   * Extract card analysis data
   *
   * @param {Date} watermarkFrom - Start timestamp
   * @param {Date} watermarkTo - End timestamp
   * @returns {Promise<Object[]>} Anonymized card analysis records
   */
  async extractCardAnalysis(watermarkFrom, watermarkTo) {
    // Card analysis doesn't have user data, but we still filter to cards
    // that belong to decks owned by consented users
    const result = await this.pool.query(
      `SELECT ca.*
       FROM card_analysis ca
       INNER JOIN cards c ON ca.card_id = c.card_id
       INNER JOIN decks d ON c.deck_id = d.deck_id OR c.deck_client_id = d.deck_id
       INNER JOIN privacy_settings ps ON d.author_id = ps.user_id
       WHERE ps.research_consent = true
         AND ca.analyzed_at >= $1
         AND ca.analyzed_at < $2
       ORDER BY ca.analyzed_at ASC`,
      [watermarkFrom, watermarkTo]
    );

    return this.anonymizer.anonymizeBatch(result.rows, "card_analysis");
  }

  /**
   * Extract full export (all data types)
   *
   * @param {Date} watermarkFrom - Start timestamp
   * @param {Date} watermarkTo - End timestamp
   * @returns {Promise<Object>} Object with all data types
   */
  async extractFullExport(watermarkFrom, watermarkTo) {
    const [sessions, reviews, statistics, cardAnalysis] = await Promise.all([
      this.extractSessions(watermarkFrom, watermarkTo),
      this.extractReviews(watermarkFrom, watermarkTo),
      this.extractStatistics(),
      this.extractCardAnalysis(watermarkFrom, watermarkTo),
    ]);

    return {
      sessions,
      reviews,
      statistics,
      cardAnalysis,
      totalRecords:
        sessions.length +
        reviews.length +
        statistics.length +
        cardAnalysis.length,
    };
  }

  // ============================================================
  // OUTPUT FORMATTING
  // ============================================================

  /**
   * Write data to JSONL format
   *
   * @param {Object[]|Object} data - Data to write (array or object with arrays)
   * @param {string} outputPath - Output file path
   * @param {Object} exportRecord - Export metadata for header
   * @returns {Promise<{fileSize: number, checksum: string}>}
   */
  async writeJSONL(data, outputPath, exportRecord) {
    const writeStream = fs.createWriteStream(outputPath);
    const hash = crypto.createHash("sha256");

    return new Promise((resolve, reject) => {
      // Write metadata header as first line
      const header = JSON.stringify({
        schema_version: exportRecord.schemaVersion,
        export_type: exportRecord.exportType,
        export_id: exportRecord.exportId,
        exported_at: new Date().toISOString(),
        watermark_from: exportRecord.watermarkFrom,
        watermark_to: exportRecord.watermarkTo,
        record_count: Array.isArray(data) ? data.length : data.totalRecords || 0,
      });
      writeStream.write(header + "\n");
      hash.update(header + "\n");

      // Handle different data structures
      if (Array.isArray(data)) {
        // Simple array of records
        for (const record of data) {
          const line = JSON.stringify(record) + "\n";
          writeStream.write(line);
          hash.update(line);
        }
      } else if (data.sessions || data.reviews) {
        // Full export with multiple data types
        for (const [type, records] of Object.entries(data)) {
          if (Array.isArray(records)) {
            for (const record of records) {
              const line = JSON.stringify({ _type: type, ...record }) + "\n";
              writeStream.write(line);
              hash.update(line);
            }
          }
        }
      }

      writeStream.end(() => {
        const stats = fs.statSync(outputPath);
        resolve({
          fileSize: stats.size,
          checksum: hash.digest("hex"),
        });
      });

      writeStream.on("error", reject);
    });
  }

  /**
   * Generate output file path for an export
   *
   * @param {Object} exportRecord - Export record
   * @returns {string} File path
   */
  generateOutputPath(exportRecord) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${exportRecord.exportType}_${exportRecord.schemaVersion}_${timestamp}.jsonl`;
    return path.join(this.options.exportDir, filename);
  }

  // ============================================================
  // SCHEMA MANAGEMENT
  // ============================================================

  /**
   * Get current schema version for an export type
   *
   * @param {string} exportType - Export type
   * @returns {Promise<string>} Schema version
   */
  async getSchemaVersion(exportType) {
    const result = await this.pool.query(
      `SELECT version FROM export_schema_versions
       WHERE export_type = $1 AND is_current = true`,
      [exportType]
    );

    return result.rows.length > 0
      ? result.rows[0].version
      : CURRENT_SCHEMA_VERSIONS[exportType];
  }

  // ============================================================
  // WATERMARK MANAGEMENT
  // ============================================================

  /**
   * Get last successful watermark for incremental exports
   *
   * @param {string} exportType - Export type
   * @returns {Promise<Date>} Last watermark or default (30 days ago)
   */
  async getLastWatermark(exportType) {
    const result = await this.pool.query(
      `SELECT watermark_to FROM research_exports
       WHERE export_type = $1 AND status = 'completed'
       ORDER BY watermark_to DESC
       LIMIT 1`,
      [exportType]
    );

    if (result.rows.length > 0) {
      return result.rows[0].watermark_to;
    }

    // Default: 30 days ago for first export
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 30);
    return defaultDate;
  }

  /**
   * Update watermark after successful export
   * (Watermark is tracked via the research_exports table's completed records)
   *
   * @param {string} _exportType - Export type (unused, kept for API consistency)
   * @param {Date} _timestamp - New watermark timestamp (unused, tracked via exports)
   */
  async updateWatermark(_exportType, _timestamp) {
    // Watermark is implicitly tracked via research_exports completed records
    // No separate watermark table needed
  }

  // ============================================================
  // CONSENT STATISTICS
  // ============================================================

  /**
   * Get consent statistics for admin dashboard
   *
   * @returns {Promise<Object>} Consent statistics
   */
  async getConsentStats() {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE research_consent = true) as consented_users,
        COUNT(*) FILTER (WHERE research_consent = false OR research_consent IS NULL) as non_consented_users,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE research_consent = true AND research_consent_date > CURRENT_DATE - INTERVAL '30 days') as recent_consents
      FROM privacy_settings
    `);

    const stats = result.rows[0];

    return {
      consentedUsers: parseInt(stats.consented_users, 10) || 0,
      nonConsentedUsers: parseInt(stats.non_consented_users, 10) || 0,
      totalUsers: parseInt(stats.total_users, 10) || 0,
      recentConsents: parseInt(stats.recent_consents, 10) || 0,
      consentRate:
        stats.total_users > 0
          ? Math.round(
              (parseInt(stats.consented_users, 10) /
                parseInt(stats.total_users, 10)) *
                100
            )
          : 0,
    };
  }

  /**
   * Get the data dictionary for an export type
   *
   * @param {string} [exportType] - Filter by export type (optional)
   * @returns {Promise<Object[]>} Data dictionary entries
   */
  async getDataDictionary(exportType = null) {
    let query = `
      SELECT field_id, export_type, field_name, source_table, source_column,
             data_type, classification, description, example_values
      FROM export_data_dictionary
    `;
    const params = [];

    if (exportType) {
      query += " WHERE export_type = $1";
      params.push(exportType);
    }

    query += " ORDER BY export_type, field_name";

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      fieldId: row.field_id,
      exportType: row.export_type,
      fieldName: row.field_name,
      sourceTable: row.source_table,
      sourceColumn: row.source_column,
      dataType: row.data_type,
      classification: row.classification,
      description: row.description,
      exampleValues: row.example_values,
    }));
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Format a raw database export record to camelCase
   *
   * @param {Object} row - Database row
   * @returns {Object} Formatted export record
   */
  formatExportRecord(row) {
    return {
      exportId: row.export_id,
      exportType: row.export_type,
      schemaVersion: row.schema_version,
      status: row.status,
      watermarkFrom: row.watermark_from,
      watermarkTo: row.watermark_to,
      filters: row.filters,
      outputFormat: row.output_format,
      outputPath: row.output_path,
      recordCount: row.record_count,
      fileSizeBytes: row.file_size_bytes,
      checksum: row.checksum,
      createdBy: row.created_by,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    };
  }
}

export default ResearchExportService;
