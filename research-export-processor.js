/**
 * Research Export Processor
 *
 * Background job processor for research data exports.
 * Polls for pending export jobs and processes them asynchronously.
 *
 * Features:
 * - Polls for pending jobs every 30 seconds
 * - Claims jobs atomically using SKIP LOCKED
 * - Processes exports through ResearchExportService
 * - Handles failures gracefully with error logging
 */

import { ulid } from "ulid";

export class ResearchExportProcessor {
  /**
   * Create a new ResearchExportProcessor instance
   *
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   * @param {import('./research-export-service.js').ResearchExportService} exportService - Export service
   * @param {Object} options - Configuration options
   */
  constructor(pool, exportService, options = {}) {
    this.pool = pool;
    this.exportService = exportService;
    this.options = {
      // How often to poll for jobs (ms)
      pollInterval: options.pollInterval || 30000,
      // Worker ID for job claiming
      workerId: options.workerId || `export_worker_${ulid()}`,
      ...options,
    };

    this.isRunning = false;
    this.pollTimer = null;
    this.currentExport = null;
  }

  /**
   * Start the export processor
   */
  start() {
    if (this.isRunning) {
      console.log("[ResearchExportProcessor] Already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `[ResearchExportProcessor] Starting with worker ID: ${this.options.workerId}`
    );

    // Start polling for jobs
    this.poll();
  }

  /**
   * Stop the processor gracefully
   */
  async stop() {
    console.log("[ResearchExportProcessor] Stopping...");
    this.isRunning = false;

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for current export to complete if any
    if (this.currentExport) {
      console.log(
        `[ResearchExportProcessor] Waiting for current export to complete: ${this.currentExport}`
      );
      // Give it some time to finish, but don't wait forever
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log("[ResearchExportProcessor] Stopped");
  }

  /**
   * Poll for and process export jobs
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      await this.processExports();
    } catch (error) {
      console.error(
        "[ResearchExportProcessor] Error in poll cycle:",
        error.message
      );
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.options.pollInterval);
  }

  /**
   * Claim and process pending export jobs
   */
  async processExports() {
    // Try to claim a pending export job
    const result = await this.pool.query("SELECT * FROM claim_export_job($1)", [
      this.options.workerId,
    ]);

    if (result.rows.length === 0) {
      return; // No jobs to process
    }

    const job = result.rows[0];
    console.log(
      `[ResearchExportProcessor] Claimed export job: ${job.export_id} (type: ${job.export_type})`
    );

    this.currentExport = job.export_id;

    try {
      await this.processExport(job);
    } catch (error) {
      console.error(
        `[ResearchExportProcessor] Export ${job.export_id} failed:`,
        error.message
      );
      // Error handling is done in exportService.processExport
    } finally {
      this.currentExport = null;
    }
  }

  /**
   * Process a single export job
   *
   * @param {Object} job - Export job from claim_export_job
   */
  async processExport(job) {
    const startTime = Date.now();

    try {
      const result = await this.exportService.processExport(job.export_id);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[ResearchExportProcessor] Completed export ${job.export_id} in ${duration}s: ${result.recordCount} records`
      );
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(
        `[ResearchExportProcessor] Export ${job.export_id} failed after ${duration}s:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get processor status
   *
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      workerId: this.options.workerId,
      currentExport: this.currentExport,
      pollInterval: this.options.pollInterval,
    };
  }

  /**
   * Force process a specific export (for manual triggers)
   *
   * @param {string} exportId - Export ID to process
   * @returns {Promise<Object>} Completed export record
   */
  async forceProcess(exportId) {
    console.log(
      `[ResearchExportProcessor] Force processing export: ${exportId}`
    );

    // Claim the job if it's pending
    const checkResult = await this.pool.query(
      "SELECT status FROM research_exports WHERE export_id = $1",
      [exportId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error(`Export not found: ${exportId}`);
    }

    const status = checkResult.rows[0].status;

    if (status === "pending") {
      // Update to processing
      await this.pool.query(
        `UPDATE research_exports
         SET status = 'processing', started_at = CURRENT_TIMESTAMP
         WHERE export_id = $1`,
        [exportId]
      );
    } else if (status !== "processing") {
      throw new Error(
        `Export ${exportId} cannot be processed (status: ${status})`
      );
    }

    this.currentExport = exportId;

    try {
      const result = await this.exportService.processExport(exportId);
      return result;
    } finally {
      this.currentExport = null;
    }
  }
}

export default ResearchExportProcessor;
