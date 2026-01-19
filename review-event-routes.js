/**
 * Review Event API Routes
 *
 * Express routes for the review event lifecycle:
 * - POST   /api/reviews/events/start        - Start a new review event
 * - PATCH  /api/reviews/events/:id/interaction - Append interaction data
 * - POST   /api/reviews/events/:id/complete - Complete a review event
 * - POST   /api/reviews/events              - Record complete event (single request)
 *
 * All routes require authentication and fail gracefully to never break the review experience.
 */

import { Router } from "express";
import { ReviewEventService } from "./review-event-service.js";

/**
 * Create review event routes
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {Function} authenticateToken - Authentication middleware
 * @returns {Router} Express router
 */
export function createReviewEventRoutes(pool, authenticateToken) {
  const router = Router();
  const service = new ReviewEventService(pool);

  // Start batch processor for high-throughput interaction logging
  service.startBatchProcessor();

  // Graceful shutdown handler
  process.on("SIGTERM", async () => {
    await service.stopBatchProcessor();
  });

  // ============================================================
  // ERROR WRAPPER
  // ============================================================

  /**
   * Wraps async route handlers to catch errors gracefully
   * Returns a degraded response instead of 500 errors
   */
  const safeHandler = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("[ReviewEventRoutes] Unhandled error:", error);

      // Return a graceful error response
      res.status(200).json({
        success: false,
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        // Include request ID for debugging if provided
        clientRequestId: req.body?.clientRequestId,
      });
    }
  };

  // ============================================================
  // START REVIEW EVENT
  // POST /api/reviews/events/start
  // ============================================================

  router.post(
    "/start",
    authenticateToken,
    safeHandler(async (req, res) => {
      const result = await service.startReviewEvent(req.userId, req.body);

      if (result.success) {
        res.status(201).json(result);
      } else {
        // Return 200 with error details - don't fail the client
        res.status(200).json(result);
      }
    })
  );

  // ============================================================
  // RECORD INTERACTION
  // PATCH /api/reviews/events/:id/interaction
  // ============================================================

  router.patch(
    "/:id/interaction",
    authenticateToken,
    safeHandler(async (req, res) => {
      const eventId = req.params.id;

      // Validate event ID format
      if (!eventId || !eventId.startsWith("evt_")) {
        return res.status(200).json({
          success: false,
          error: "Invalid event ID format",
          code: "INVALID_EVENT_ID",
        });
      }

      // Use async queue for fire-and-forget if client doesn't need confirmation
      if (req.query.async === "true") {
        service.queueInteraction(eventId, req.userId, req.body);
        return res.status(202).json({
          success: true,
          eventId,
          queued: true,
        });
      }

      const result = await service.recordInteraction(
        eventId,
        req.userId,
        req.body
      );

      res.status(200).json(result);
    })
  );

  // ============================================================
  // COMPLETE REVIEW EVENT
  // POST /api/reviews/events/:id/complete
  // ============================================================

  router.post(
    "/:id/complete",
    authenticateToken,
    safeHandler(async (req, res) => {
      const eventId = req.params.id;

      // Validate event ID format
      if (!eventId || !eventId.startsWith("evt_")) {
        return res.status(200).json({
          success: false,
          error: "Invalid event ID format",
          code: "INVALID_EVENT_ID",
        });
      }

      const result = await service.completeReviewEvent(
        eventId,
        req.userId,
        req.body
      );

      // Always return 200 - don't fail the client even on errors
      res.status(200).json(result);
    })
  );

  // ============================================================
  // SINGLE-REQUEST COMPLETE EVENT (legacy/fallback)
  // POST /api/reviews/events
  // ============================================================

  router.post(
    "/",
    authenticateToken,
    safeHandler(async (req, res) => {
      const result = await service.recordCompleteEvent(req.userId, req.body);

      if (result.success) {
        res.status(201).json(result);
      } else {
        // Return 200 with error details - don't fail the client
        res.status(200).json(result);
      }
    })
  );

  // ============================================================
  // BATCH COMPLETE EVENTS
  // POST /api/reviews/events/batch
  // ============================================================

  router.post(
    "/batch",
    authenticateToken,
    safeHandler(async (req, res) => {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(200).json({
          success: false,
          error: "events array is required",
          code: "MISSING_EVENTS",
        });
      }

      // Limit batch size
      if (events.length > 100) {
        return res.status(200).json({
          success: false,
          error: "Maximum 100 events per batch",
          code: "BATCH_TOO_LARGE",
        });
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const event of events) {
        const result = await service.recordCompleteEvent(req.userId, event);
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      res.status(201).json({
        success: true,
        total: events.length,
        successCount,
        errorCount,
        events: results,
      });
    })
  );

  // ============================================================
  // ADMIN: MARK ABANDONED EVENTS
  // POST /api/reviews/events/admin/cleanup
  // ============================================================

  router.post(
    "/admin/cleanup",
    authenticateToken,
    safeHandler(async (req, res) => {
      // TODO: Add admin role check
      const maxAgeMinutes = parseInt(req.query.maxAge, 10) || 30;

      const abandonedCount = await service.markAbandonedEvents(maxAgeMinutes);

      res.status(200).json({
        success: true,
        abandonedCount,
        maxAgeMinutes,
      });
    })
  );

  return router;
}

export default createReviewEventRoutes;
