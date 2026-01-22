/**
 * Card Analysis API Routes
 *
 * Provides endpoints for card content analysis including:
 * - GET  /api/analysis/cards/:cardId - Get analysis results
 * - POST /api/analysis/cards/:cardId - Trigger analysis (queue or immediate)
 * - GET  /api/analysis/backlog - Get queue status
 * - POST /api/admin/analysis/reanalyze - Admin re-analysis trigger
 */

import express from "express";
import { CardAnalysisService } from "./card-analysis-service.js";

/**
 * Create card analysis routes
 * @param {object} pool - PostgreSQL connection pool
 * @param {function} authenticateToken - Auth middleware
 * @returns {express.Router}
 */
export function createCardAnalysisRoutes(pool, authenticateToken) {
  const router = express.Router();
  const analysisService = new CardAnalysisService(pool);

  /**
   * GET /api/analysis/cards/:cardId
   * Get analysis results for a card
   */
  router.get("/cards/:cardId", authenticateToken, async (req, res) => {
    const { cardId } = req.params;

    try {
      const analysis = await analysisService.getCardAnalysis(cardId);

      if (!analysis) {
        return res.status(404).json({
          error: "Analysis not found",
          message: "No analysis exists for this card. Trigger analysis first.",
        });
      }

      // Transform snake_case to camelCase for API response
      res.json({
        analysisId: analysis.analysis_id,
        cardId: analysis.card_id,
        version: analysis.analysis_version,
        domain: {
          primary: analysis.detected_domain,
          confidence: parseFloat(analysis.domain_confidence),
          secondary: analysis.secondary_domains,
        },
        complexity: {
          level: analysis.complexity_level,
          score: parseFloat(analysis.complexity_score),
        },
        concepts: analysis.extracted_concepts,
        cardType: analysis.detected_card_type,
        language: analysis.detected_language,
        wordCount: {
          front: analysis.front_word_count,
          back: analysis.back_word_count,
        },
        method: analysis.analysis_method,
        status: analysis.status,
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at,
      });
      return null;
    } catch (error) {
      console.error("Get card analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
      return null;
    }
  });

  /**
   * POST /api/analysis/cards/:cardId
   * Trigger analysis for a card
   *
   * Query params:
   * - immediate=true: Run analysis synchronously and return results
   * - immediate=false (default): Queue for background processing
   */
  router.post("/cards/:cardId", authenticateToken, async (req, res) => {
    const { cardId } = req.params;
    const { immediate } = req.query;
    const userId = req.userId;

    try {
      if (immediate === "true") {
        // Run analysis immediately and return results
        const result = await analysisService.analyzeCard(cardId, {
          immediate: true,
          userId,
        });

        res.json({
          success: true,
          immediate: true,
          analysis: {
            analysisId: result.analysisId,
            cardId: result.cardId,
            version: result.version,
            domain: {
              primary: result.detectedDomain,
              confidence: result.domainConfidence,
              secondary: result.secondaryDomains,
            },
            complexity: {
              level: result.complexityLevel,
              score: result.complexityScore,
            },
            concepts: result.extractedConcepts,
            cardType: result.detectedCardType,
            language: result.detectedLanguage,
            wordCount: {
              front: result.frontWordCount,
              back: result.backWordCount,
            },
            method: result.method,
            status: result.status,
          },
        });
      } else {
        // Queue for background processing
        const job = await analysisService.queueCardForAnalysis(cardId, {
          userId,
          priority: 0,
        });

        res.status(202).json({
          success: true,
          immediate: false,
          message: "Analysis queued for processing",
          job: {
            jobId: job.jobId,
            cardId: job.cardId,
          },
        });
      }
    } catch (error) {
      console.error("Trigger card analysis error:", error);

      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to trigger analysis" });
    }
    return null;
  });

  /**
   * POST /api/analysis/decks/:deckId
   * Queue an entire deck for batch analysis
   */
  router.post("/decks/:deckId", authenticateToken, async (req, res) => {
    const { deckId } = req.params;
    const userId = req.userId;

    try {
      const job = await analysisService.queueDeckForAnalysis(deckId, {
        userId,
        priority: 0,
      });

      res.status(202).json({
        success: true,
        message: "Deck analysis queued for processing",
        job: {
          jobId: job.jobId,
          deckId: job.deckId,
          totalCards: job.totalCards,
        },
      });
    } catch (error) {
      console.error("Queue deck analysis error:", error);
      res.status(500).json({ error: "Failed to queue deck analysis" });
    }
  });

  /**
   * GET /api/analysis/backlog
   * Get job queue status
   */
  router.get("/backlog", authenticateToken, async (req, res) => {
    try {
      const status = await analysisService.getBacklogStatus();

      res.json({
        success: true,
        backlog: status,
      });
    } catch (error) {
      console.error("Get backlog status error:", error);
      res.status(500).json({ error: "Failed to get backlog status" });
    }
  });

  return router;
}

/**
 * Create admin analysis routes (separate for stricter auth)
 * @param {object} pool - PostgreSQL connection pool
 * @param {function} authenticateToken - Auth middleware
 * @param {function} requireAdmin - Admin check middleware (optional)
 * @returns {express.Router}
 */
export function createAdminAnalysisRoutes(
  pool,
  authenticateToken,
  requireAdmin,
) {
  const router = express.Router();
  const analysisService = new CardAnalysisService(pool);

  // Apply auth middleware
  router.use(authenticateToken);

  // Apply admin check if provided
  if (requireAdmin) {
    router.use(requireAdmin);
  }

  /**
   * POST /api/admin/analysis/reanalyze
   * Trigger re-analysis for cards matching criteria
   *
   * Body:
   * - domain: Only re-analyze cards in this domain
   * - beforeDate: Only re-analyze cards analyzed before this date
   * - minVersion: Only re-analyze cards below this version
   */
  router.post("/reanalyze", async (req, res) => {
    const { domain, beforeDate, minVersion } = req.body;
    const userId = req.userId;

    try {
      const result = await analysisService.queueReanalysis({
        domain,
        beforeDate,
        minVersion,
        userId,
        priority: 1, // Higher priority for admin requests
      });

      res.json({
        success: true,
        message: `Queued ${result.queuedCount} cards for re-analysis`,
        queuedCount: result.queuedCount,
      });
    } catch (error) {
      console.error("Queue re-analysis error:", error);
      res.status(500).json({ error: "Failed to queue re-analysis" });
    }
  });

  /**
   * GET /api/admin/analysis/stats
   * Get analysis statistics
   */
  router.get("/stats", async (req, res) => {
    try {
      // Get domain distribution
      const domainStats = await pool.query(
        `SELECT detected_domain, COUNT(*) as count
         FROM card_analysis
         WHERE status = 'completed'
         GROUP BY detected_domain
         ORDER BY count DESC`,
      );

      // Get complexity distribution
      const complexityStats = await pool.query(
        `SELECT complexity_level, COUNT(*) as count
         FROM card_analysis
         WHERE status = 'completed'
         GROUP BY complexity_level
         ORDER BY count DESC`,
      );

      // Get analysis method distribution
      const methodStats = await pool.query(
        `SELECT analysis_method, COUNT(*) as count
         FROM card_analysis
         GROUP BY analysis_method
         ORDER BY count DESC`,
      );

      // Get overall counts
      const totalStats = await pool.query(
        `SELECT
           COUNT(*) as total_analyses,
           COUNT(DISTINCT card_id) as unique_cards,
           AVG(domain_confidence) as avg_confidence
         FROM card_analysis
         WHERE status = 'completed'`,
      );

      res.json({
        success: true,
        stats: {
          totals: {
            analyses: parseInt(totalStats.rows[0].total_analyses),
            uniqueCards: parseInt(totalStats.rows[0].unique_cards),
            avgConfidence: parseFloat(totalStats.rows[0].avg_confidence || 0),
          },
          byDomain: domainStats.rows.map((r) => ({
            domain: r.detected_domain,
            count: parseInt(r.count),
          })),
          byComplexity: complexityStats.rows.map((r) => ({
            level: r.complexity_level,
            count: parseInt(r.count),
          })),
          byMethod: methodStats.rows.map((r) => ({
            method: r.analysis_method,
            count: parseInt(r.count),
          })),
        },
      });
    } catch (error) {
      console.error("Get analysis stats error:", error);
      res.status(500).json({ error: "Failed to get analysis stats" });
    }
  });

  return router;
}

export default createCardAnalysisRoutes;
