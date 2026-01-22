/**
 * Analysis Job Processor
 *
 * Background job processor for card content analysis.
 * Uses PostgreSQL-based job queue with atomic claiming (SKIP LOCKED)
 * to prevent duplicate processing across multiple workers.
 *
 * Features:
 * - Polls for pending jobs every 5 seconds
 * - Claims up to 10 jobs atomically per batch
 * - Handles single card and batch (deck) jobs
 * - Retries failed jobs up to 3 times with exponential backoff
 * - Releases stale jobs (stuck > 10 minutes)
 */

import { ulid } from "ulid";
import { CardAnalysisService } from "./card-analysis-service.js";

export class AnalysisJobProcessor {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.options = {
      // How often to poll for jobs (ms)
      pollInterval: 5000,
      // How many jobs to claim per batch
      batchSize: 10,
      // How often to release stale jobs (ms)
      staleCheckInterval: 60000,
      // Minutes before a job is considered stale
      staleMinutes: 10,
      // Worker ID for job claiming
      workerId: options.workerId || `worker_${ulid()}`,
      ...options,
    };

    this.analysisService = new CardAnalysisService(pool);
    this.isRunning = false;
    this.pollTimer = null;
    this.staleTimer = null;
  }

  /**
   * Start the job processor
   */
  start() {
    if (this.isRunning) {
      console.log("[AnalysisJobProcessor] Already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `[AnalysisJobProcessor] Starting with worker ID: ${this.options.workerId}`,
    );

    // Start polling for jobs
    this.poll();

    // Start stale job release check
    this.startStaleCheck();
  }

  /**
   * Stop the job processor gracefully
   */
  async stop() {
    console.log("[AnalysisJobProcessor] Stopping...");
    this.isRunning = false;

    // Clear timers
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }

    // Release any jobs we currently have locked
    await this.releaseOurJobs();

    console.log("[AnalysisJobProcessor] Stopped");
  }

  /**
   * Poll for and process jobs
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      await this.processJobs();
    } catch (error) {
      console.error("[AnalysisJobProcessor] Error in poll cycle:", error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.options.pollInterval);
  }

  /**
   * Claim and process a batch of jobs
   */
  async processJobs() {
    // Claim jobs atomically using SKIP LOCKED
    const result = await this.pool.query(
      "SELECT * FROM claim_analysis_job($1, $2)",
      [this.options.workerId, this.options.batchSize],
    );

    const jobs = result.rows;

    if (jobs.length === 0) {
      return; // No jobs to process
    }

    console.log(`[AnalysisJobProcessor] Claimed ${jobs.length} jobs`);

    // Process each job
    for (const job of jobs) {
      if (!this.isRunning) break; // Stop if shutdown requested

      try {
        await this.processJob(job);
      } catch (error) {
        console.error(
          `[AnalysisJobProcessor] Error processing job ${job.job_id}:`,
          error,
        );

        // Mark job as failed
        await this.pool.query("SELECT complete_analysis_job($1, $2, $3)", [
          job.job_id,
          false,
          error.message,
        ]);
      }
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    console.log(
      `[AnalysisJobProcessor] Processing job ${job.job_id} (type: ${job.job_type})`,
    );

    switch (job.job_type) {
      case "single":
      case "reanalysis":
        await this.processSingleCardJob(job);
        break;
      case "batch":
        await this.processBatchJob(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }

  /**
   * Process a single card analysis job
   */
  async processSingleCardJob(job) {
    const { job_id: jobId, card_id: cardId, user_id: userId } = job;

    try {
      // Run analysis
      await this.analysisService.analyzeCard(cardId, {
        userId,
        immediate: true,
      });

      // Mark job as completed
      await this.pool.query(
        "SELECT complete_analysis_job($1, $2, $3, $4, $5)",
        [jobId, true, null, 1, 0],
      );

      console.log(`[AnalysisJobProcessor] Completed single card job: ${jobId}`);
    } catch (error) {
      // Check if this is a retryable error
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable || job.attempt_count >= job.max_attempts) {
        // Mark as permanently failed
        await this.pool.query(
          "SELECT complete_analysis_job($1, $2, $3, $4, $5)",
          [jobId, false, error.message, 0, 1],
        );
        console.error(
          `[AnalysisJobProcessor] Job ${jobId} failed permanently:`,
          error.message,
        );
      } else {
        // Will be retried (complete_analysis_job handles retry logic)
        await this.pool.query("SELECT complete_analysis_job($1, $2, $3)", [
          jobId,
          false,
          error.message,
        ]);
        console.warn(`[AnalysisJobProcessor] Job ${jobId} will be retried`);
      }
    }
  }

  /**
   * Process a batch (deck) analysis job
   */
  async processBatchJob(job) {
    const {
      job_id: jobId,
      deck_id: deckId,
      user_id: userId,
      total_cards: totalCards,
    } = job;

    console.log(
      `[AnalysisJobProcessor] Processing batch job for deck ${deckId} (${totalCards} cards)`,
    );

    let processedCount = 0;
    let failedCount = 0;

    try {
      // Get all cards in the deck
      const cardsResult = await this.pool.query(
        "SELECT card_id FROM cards WHERE deck_client_id = $1",
        [deckId],
      );

      const cards = cardsResult.rows;

      // Process each card
      for (const card of cards) {
        if (!this.isRunning) {
          // Shutdown requested - save progress and exit
          await this.updateBatchProgress(jobId, processedCount, failedCount);
          return;
        }

        try {
          await this.analysisService.analyzeCard(card.card_id, {
            userId,
            immediate: true,
          });
          processedCount++;
        } catch (error) {
          console.warn(
            `[AnalysisJobProcessor] Failed to analyze card ${card.card_id}:`,
            error.message,
          );
          failedCount++;
        }

        // Update progress periodically (every 10 cards)
        if ((processedCount + failedCount) % 10 === 0) {
          await this.updateBatchProgress(jobId, processedCount, failedCount);
        }
      }

      // Mark batch job as completed
      await this.pool.query(
        "SELECT complete_analysis_job($1, $2, $3, $4, $5)",
        [jobId, true, null, processedCount, failedCount],
      );

      console.log(
        `[AnalysisJobProcessor] Completed batch job ${jobId}: ${processedCount} processed, ${failedCount} failed`,
      );
    } catch (error) {
      // Mark batch job as failed
      await this.pool.query(
        "SELECT complete_analysis_job($1, $2, $3, $4, $5)",
        [jobId, false, error.message, processedCount, failedCount],
      );

      throw error;
    }
  }

  /**
   * Update batch job progress
   */
  async updateBatchProgress(jobId, processed, failed) {
    await this.pool.query(
      `UPDATE analysis_jobs
       SET processed_cards = $2, failed_cards = $3, updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1`,
      [jobId, processed, failed],
    );
  }

  /**
   * Start periodic stale job release
   */
  startStaleCheck() {
    this.staleTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.releaseStaleJobs();
      } catch (error) {
        console.error(
          "[AnalysisJobProcessor] Error releasing stale jobs:",
          error,
        );
      }
    }, this.options.staleCheckInterval);
  }

  /**
   * Release jobs that have been stuck processing too long
   */
  async releaseStaleJobs() {
    const result = await this.pool.query("SELECT release_stale_jobs($1)", [
      this.options.staleMinutes,
    ]);

    const releasedCount = result.rows[0]?.release_stale_jobs || 0;

    if (releasedCount > 0) {
      console.log(
        `[AnalysisJobProcessor] Released ${releasedCount} stale jobs`,
      );
    }
  }

  /**
   * Release jobs locked by this worker (for graceful shutdown)
   */
  async releaseOurJobs() {
    const result = await this.pool.query(
      `UPDATE analysis_jobs
       SET status = 'pending', locked_by = NULL, locked_at = NULL
       WHERE locked_by = $1 AND status = 'processing'
       RETURNING job_id`,
      [this.options.workerId],
    );

    if (result.rows.length > 0) {
      console.log(
        `[AnalysisJobProcessor] Released ${result.rows.length} jobs on shutdown`,
      );
    }
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    // Network errors are retryable
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return true;
    }

    // Database connection errors are retryable
    if (error.code === "ECONNRESET" || error.code === "57P01") {
      return true;
    }

    // Rate limit errors are retryable
    if (error.message.includes("rate limit")) {
      return true;
    }

    // "Card not found" is not retryable
    if (error.message.includes("not found")) {
      return false;
    }

    // Default to retryable
    return true;
  }
}

export default AnalysisJobProcessor;
