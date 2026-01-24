/**
 * Learning Analytics API Routes
 *
 * Express routes for querying learning analytics data.
 * All routes require authentication - users can only access their own analytics.
 *
 * Endpoints:
 * - GET /api/analytics/users/:userId/profile           - Comprehensive learning profile
 * - GET /api/analytics/users/:userId/velocity          - Velocity history
 * - GET /api/analytics/users/:userId/daily-summary     - Daily learning summary
 * - GET /api/analytics/users/:userId/struggling-cards  - Struggling cards
 * - GET /api/analytics/users/:userId/patterns/interference   - Interference patterns
 * - GET /api/analytics/users/:userId/patterns/prerequisites  - Prerequisite gaps
 * - GET /api/analytics/users/:userId/patterns/fatigue        - Fatigue decay
 * - GET /api/analytics/users/:userId/patterns/time-of-day    - Circadian effects
 * - GET /api/analytics/cards/:cardId/difficulty        - Card difficulty metrics
 * - GET /api/analytics/decks/:deckId/hardest           - Hardest cards in deck
 * - GET /api/analytics/sessions/:sessionId/health      - Session health analysis
 */

import { Router } from "express";
import { LearningAnalyticsService } from "./learning-analytics-service.js";

/**
 * Create learning analytics routes
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {Function} authenticateToken - Authentication middleware
 * @returns {Router} Express router
 */
export function createLearningAnalyticsRoutes(pool, authenticateToken) {
  const router = Router();
  const service = new LearningAnalyticsService(pool);

  // ============================================================
  // AUTHORIZATION MIDDLEWARE
  // ============================================================

  /**
   * Middleware to ensure user can only access their own analytics
   */
  const authorizeUserAccess = (req, res, next) => {
    const requestedUserId = req.params.userId;
    const authenticatedUserId = req.userId;

    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only access your own analytics",
        code: "FORBIDDEN",
      });
    }

    next();
  };

  // ============================================================
  // ERROR WRAPPER
  // ============================================================

  /**
   * Wraps async route handlers to catch errors
   */
  const asyncHandler = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("[LearningAnalyticsRoutes] Error:", error);
      res.status(500).json({
        success: false,
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // ============================================================
  // USER PROFILE ROUTES
  // ============================================================

  /**
   * GET /api/analytics/users/:userId/profile
   * Get comprehensive learning profile
   */
  router.get(
    "/users/:userId/profile",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const profile = await service.getUserLearningProfile(req.params.userId);

      res.json({
        success: true,
        data: profile,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/velocity
   * Get velocity history for charting
   * Query params:
   *   - weeks: number of weeks (default 12)
   */
  router.get(
    "/users/:userId/velocity",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const weeks = parseInt(req.query.weeks, 10) || 12;
      const velocityHistory = await service.getUserVelocityHistory(
        req.params.userId,
        Math.min(weeks, 52) // Cap at 52 weeks
      );

      res.json({
        success: true,
        data: velocityHistory,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/daily-summary
   * Get daily learning summary
   * Query params:
   *   - days: number of days (default 30)
   */
  router.get(
    "/users/:userId/daily-summary",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const days = parseInt(req.query.days, 10) || 30;
      const dailySummary = await service.getDailySummary(
        req.params.userId,
        Math.min(days, 365) // Cap at 365 days
      );

      res.json({
        success: true,
        data: dailySummary,
      });
    })
  );

  // ============================================================
  // STRUGGLING CARDS ROUTES
  // ============================================================

  /**
   * GET /api/analytics/users/:userId/struggling-cards
   * Get struggling cards for a user
   * Query params:
   *   - threshold: minimum struggle score 0-1 (default 0.4)
   *   - limit: max cards to return (default 20)
   */
  router.get(
    "/users/:userId/struggling-cards",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const threshold = parseFloat(req.query.threshold) || 0.4;
      const limit = parseInt(req.query.limit, 10) || 20;

      const strugglingCards = await service.getStrugglingCards(
        req.params.userId,
        Math.max(0, Math.min(threshold, 1)), // Clamp to 0-1
        Math.min(limit, 100) // Cap at 100
      );

      res.json({
        success: true,
        data: strugglingCards,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/struggling-cards/by-deck
   * Get struggling cards grouped by deck
   */
  router.get(
    "/users/:userId/struggling-cards/by-deck",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const cardsByDeck = await service.getStrugglingCardsByDeck(req.params.userId);

      res.json({
        success: true,
        data: cardsByDeck,
      });
    })
  );

  // ============================================================
  // PATTERN DETECTION ROUTES
  // ============================================================

  /**
   * GET /api/analytics/users/:userId/patterns/interference
   * Detect interference patterns (cards confused with each other)
   * Query params:
   *   - deckId: optional deck filter
   */
  router.get(
    "/users/:userId/patterns/interference",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const patterns = await service.detectInterferencePatterns(
        req.params.userId,
        req.query.deckId || null
      );

      res.json({
        success: true,
        data: patterns,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/patterns/prerequisites
   * Detect prerequisite gaps
   * Query params:
   *   - deckId: optional deck filter
   */
  router.get(
    "/users/:userId/patterns/prerequisites",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const gaps = await service.detectPrerequisiteGaps(
        req.params.userId,
        req.query.deckId || null
      );

      res.json({
        success: true,
        data: gaps,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/patterns/fatigue
   * Analyze fatigue decay patterns
   */
  router.get(
    "/users/:userId/patterns/fatigue",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const analysis = await service.analyzeFatigueDecay(req.params.userId);

      res.json({
        success: true,
        data: analysis,
      });
    })
  );

  /**
   * GET /api/analytics/users/:userId/patterns/time-of-day
   * Analyze time-of-day effects (circadian patterns)
   */
  router.get(
    "/users/:userId/patterns/time-of-day",
    authenticateToken,
    authorizeUserAccess,
    asyncHandler(async (req, res) => {
      const analysis = await service.analyzeTimeOfDayEffects(req.params.userId);

      res.json({
        success: true,
        data: analysis,
      });
    })
  );

  // ============================================================
  // CARD DIFFICULTY ROUTES
  // ============================================================

  /**
   * GET /api/analytics/cards/:cardId/difficulty
   * Get difficulty metrics for a card
   * Query params:
   *   - userId: optional user ID for comparison (must be authenticated user)
   */
  router.get(
    "/cards/:cardId/difficulty",
    authenticateToken,
    asyncHandler(async (req, res) => {
      // If userId is provided, it must match the authenticated user
      let compareUserId = null;
      if (req.query.userId) {
        if (req.query.userId !== req.userId) {
          return res.status(403).json({
            success: false,
            error: "Can only compare with your own performance",
            code: "FORBIDDEN",
          });
        }
        compareUserId = req.query.userId;
      }

      const metrics = await service.getCardDifficultyMetrics(
        req.params.cardId,
        compareUserId
      );

      res.json({
        success: true,
        data: metrics,
      });
    })
  );

  // ============================================================
  // DECK ANALYTICS ROUTES
  // ============================================================

  /**
   * GET /api/analytics/decks/:deckId/hardest
   * Get hardest cards in a deck
   * Query params:
   *   - limit: max cards to return (default 10)
   */
  router.get(
    "/decks/:deckId/hardest",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const limit = parseInt(req.query.limit, 10) || 10;

      const hardestCards = await service.getDeckHardestCards(
        req.params.deckId,
        Math.min(limit, 50) // Cap at 50
      );

      res.json({
        success: true,
        data: hardestCards,
      });
    })
  );

  // ============================================================
  // SESSION HEALTH ROUTES
  // ============================================================

  /**
   * GET /api/analytics/sessions/:sessionId/health
   * Get session health analysis
   */
  router.get(
    "/sessions/:sessionId/health",
    authenticateToken,
    asyncHandler(async (req, res) => {
      // Verify the session belongs to the authenticated user
      const sessionCheck = await pool.query(
        `SELECT user_id FROM session_tracking WHERE session_id = $1`,
        [req.params.sessionId]
      );

      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
          code: "NOT_FOUND",
        });
      }

      if (sessionCheck.rows[0].user_id !== req.userId) {
        return res.status(403).json({
          success: false,
          error: "You can only access your own sessions",
          code: "FORBIDDEN",
        });
      }

      const health = await service.getSessionHealthIndicators(req.params.sessionId);

      if (!health) {
        return res.status(404).json({
          success: false,
          error: "No health data available for this session",
          code: "NO_DATA",
        });
      }

      res.json({
        success: true,
        data: health,
      });
    })
  );

  /**
   * GET /api/analytics/sessions/:sessionId/health/live
   * Get real-time health for an active session
   */
  router.get(
    "/sessions/:sessionId/health/live",
    authenticateToken,
    asyncHandler(async (req, res) => {
      // Verify the session belongs to the authenticated user
      const sessionCheck = await pool.query(
        `SELECT user_id FROM session_tracking WHERE session_id = $1`,
        [req.params.sessionId]
      );

      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
          code: "NOT_FOUND",
        });
      }

      if (sessionCheck.rows[0].user_id !== req.userId) {
        return res.status(403).json({
          success: false,
          error: "You can only access your own sessions",
          code: "FORBIDDEN",
        });
      }

      const liveHealth = await service.getLiveSessionHealth(req.params.sessionId);

      res.json({
        success: true,
        data: liveHealth,
      });
    })
  );

  return router;
}

export default createLearningAnalyticsRoutes;
