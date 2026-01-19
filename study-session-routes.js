/**
 * Study Session API Routes
 *
 * Express routes for session lifecycle:
 * - POST   /api/sessions/start         - Start a new session
 * - POST   /api/sessions/:id/heartbeat - Send heartbeat
 * - POST   /api/sessions/:id/break     - Record break start/end
 * - POST   /api/sessions/:id/complete  - Complete session
 * - POST   /api/sessions/:id/beacon    - Browser close handler (sendBeacon)
 * - GET    /api/sessions/active        - Get current active session
 * - GET    /api/sessions/:id           - Get session details
 * - GET    /api/sessions/recent        - Get recent sessions
 */

import { Router } from "express";
import { StudySessionService } from "./study-session-service.js";

/**
 * Create study session routes
 * @param {object} pool - PostgreSQL connection pool
 * @param {function} authenticateToken - Authentication middleware
 * @returns {Router} Express router
 */
export function createStudySessionRoutes(pool, authenticateToken) {
  const router = Router();
  const service = new StudySessionService(pool);

  // Start abandonment detector (checks every 60 seconds)
  service.startAbandonmentDetector(60000);

  // Graceful shutdown
  const shutdown = () => {
    service.stopAbandonmentDetector();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ============================================================
  // ERROR WRAPPER
  // ============================================================

  /**
   * Wrap route handlers with error handling
   * Returns 200 even on errors to avoid breaking client-side fire-and-forget calls
   */
  const safeHandler = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("[StudySessionRoutes] Unhandled error:", error);
      res.status(200).json({
        success: false,
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Validate session ID format
   */
  const validateSessionId = (sessionId) => {
    return sessionId && sessionId.startsWith("ses_") && sessionId.length === 30;
  };

  // ============================================================
  // START SESSION
  // POST /api/sessions/start
  // ============================================================

  router.post(
    "/start",
    authenticateToken,
    safeHandler(async (req, res) => {
      const result = await service.startSession(req.userId, req.body);
      res.status(result.success ? 201 : 200).json(result);
    })
  );

  // ============================================================
  // HEARTBEAT
  // POST /api/sessions/:id/heartbeat
  // ============================================================

  router.post(
    "/:id/heartbeat",
    authenticateToken,
    safeHandler(async (req, res) => {
      const sessionId = req.params.id;

      if (!validateSessionId(sessionId)) {
        return res.status(200).json({
          success: false,
          error: "Invalid session ID format",
          code: "INVALID_SESSION_ID",
        });
      }

      const result = await service.recordHeartbeat(
        sessionId,
        req.userId,
        req.body
      );
      res.status(200).json(result);
    })
  );

  // ============================================================
  // BREAK
  // POST /api/sessions/:id/break
  // ============================================================

  router.post(
    "/:id/break",
    authenticateToken,
    safeHandler(async (req, res) => {
      const sessionId = req.params.id;

      if (!validateSessionId(sessionId)) {
        return res.status(200).json({
          success: false,
          error: "Invalid session ID format",
          code: "INVALID_SESSION_ID",
        });
      }

      if (!req.body.action || !["start", "end"].includes(req.body.action)) {
        return res.status(200).json({
          success: false,
          error: "Invalid break action. Must be 'start' or 'end'",
          code: "INVALID_ACTION",
        });
      }

      const result = await service.recordBreak(sessionId, req.userId, req.body);
      res.status(200).json(result);
    })
  );

  // ============================================================
  // COMPLETE SESSION
  // POST /api/sessions/:id/complete
  // ============================================================

  router.post(
    "/:id/complete",
    authenticateToken,
    safeHandler(async (req, res) => {
      const sessionId = req.params.id;

      if (!validateSessionId(sessionId)) {
        return res.status(200).json({
          success: false,
          error: "Invalid session ID format",
          code: "INVALID_SESSION_ID",
        });
      }

      const result = await service.completeSession(
        sessionId,
        req.userId,
        req.body
      );
      res.status(200).json(result);
    })
  );

  // ============================================================
  // BEACON ENDPOINT (for beforeunload)
  // POST /api/sessions/:id/beacon
  //
  // This endpoint is called via navigator.sendBeacon() when the
  // browser is closing. It marks the session as interrupted.
  // ============================================================

  router.post(
    "/:id/beacon",
    authenticateToken,
    safeHandler(async (req, res) => {
      const sessionId = req.params.id;

      if (!validateSessionId(sessionId)) {
        // Beacon endpoints should return 200 regardless of errors
        return res.status(200).end();
      }

      // Mark session as interrupted
      await service.completeSession(sessionId, req.userId, {
        finalState: "interrupted",
        totalActiveTimeMs: req.body?.totalActiveTimeMs,
      });

      // Beacon endpoints should return minimal response
      res.status(200).end();
    })
  );

  // ============================================================
  // GET ACTIVE SESSION
  // GET /api/sessions/active
  // ============================================================

  router.get(
    "/active",
    authenticateToken,
    safeHandler(async (req, res) => {
      const result = await service.getActiveSession(req.userId);
      res.status(200).json(result);
    })
  );

  // ============================================================
  // GET RECENT SESSIONS
  // GET /api/sessions/recent
  // ============================================================

  router.get(
    "/recent",
    authenticateToken,
    safeHandler(async (req, res) => {
      const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
      const result = await service.getRecentSessions(req.userId, limit);
      res.status(200).json(result);
    })
  );

  // ============================================================
  // GET SESSION BY ID
  // GET /api/sessions/:id
  // ============================================================

  router.get(
    "/:id",
    authenticateToken,
    safeHandler(async (req, res) => {
      const sessionId = req.params.id;

      if (!validateSessionId(sessionId)) {
        return res.status(200).json({
          success: false,
          error: "Invalid session ID format",
          code: "INVALID_SESSION_ID",
        });
      }

      const result = await service.getSession(sessionId, req.userId);
      res.status(200).json(result);
    })
  );

  return router;
}

export default createStudySessionRoutes;
