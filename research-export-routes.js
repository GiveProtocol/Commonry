/**
 * Research Export Admin Routes
 *
 * Admin API endpoints for managing research data exports.
 * All routes require authentication and admin privileges.
 *
 * Endpoints:
 * - POST   /api/admin/research/exports              - Create export job
 * - GET    /api/admin/research/exports              - List exports
 * - GET    /api/admin/research/exports/:id          - Get export status
 * - GET    /api/admin/research/exports/:id/download - Download export file
 * - POST   /api/admin/research/exports/:id/cancel   - Cancel export
 * - GET    /api/admin/research/dictionary           - Get data dictionary
 * - GET    /api/admin/research/consent-stats        - Get consent statistics
 * - POST   /api/admin/research/rotate-alids         - Rotate anonymous IDs
 */

import { Router } from "express";
import fs from "fs";
import path from "path";

/**
 * Create research export admin routes
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {import('./research-export-service.js').ResearchExportService} exportService - Export service
 * @param {Function} authenticateToken - Authentication middleware
 * @param {Function} requireAdmin - Admin authorization middleware
 * @returns {Router} Express router
 */
export function createResearchExportRoutes(
  pool,
  exportService,
  authenticateToken,
  requireAdmin,
) {
  const router = Router();

  // ============================================================
  // CREATE EXPORT JOB
  // POST /exports
  // ============================================================

  router.post("/exports", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { type, format, watermarkFrom, watermarkTo, filters } = req.body;

      // Validate required fields
      if (!type) {
        return res.status(400).json({
          error: "Export type is required",
          validTypes: [
            "sessions",
            "reviews",
            "statistics",
            "card_analysis",
            "full",
          ],
        });
      }

      const validTypes = [
        "sessions",
        "reviews",
        "statistics",
        "card_analysis",
        "full",
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid export type: ${type}`,
          validTypes,
        });
      }

      const exportJob = await exportService.createExport(type, {
        format: format || "jsonl",
        watermarkFrom: watermarkFrom ? new Date(watermarkFrom) : undefined,
        watermarkTo: watermarkTo ? new Date(watermarkTo) : undefined,
        filters,
        createdBy: req.userId,
      });

      res.status(201).json({
        success: true,
        export: exportJob,
      });
    } catch (error) {
      console.error("[ResearchExportRoutes] Error creating export:", error);
      res.status(500).json({
        error: "Failed to create export job",
        message: error.message,
      });
    }
  });

  // ============================================================
  // LIST EXPORTS
  // GET /exports
  // ============================================================

  router.get("/exports", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { type, status, limit, offset } = req.query;

      const result = await exportService.listExports({
        type,
        status,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[ResearchExportRoutes] Error listing exports:", error);
      res.status(500).json({
        error: "Failed to list exports",
        message: error.message,
      });
    }
  });

  // ============================================================
  // GET EXPORT STATUS
  // GET /exports/:id
  // ============================================================

  router.get(
    "/exports/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const exportJob = await exportService.getExportStatus(req.params.id);

        if (!exportJob) {
          return res.status(404).json({
            error: "Export not found",
          });
        }

        res.json({
          success: true,
          export: exportJob,
        });
      } catch (error) {
        console.error("[ResearchExportRoutes] Error getting export:", error);
        res.status(500).json({
          error: "Failed to get export status",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // DOWNLOAD EXPORT FILE
  // GET /exports/:id/download
  // ============================================================

  router.get(
    "/exports/:id/download",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const exportJob = await exportService.getExportStatus(req.params.id);

        if (!exportJob) {
          return res.status(404).json({
            error: "Export not found",
          });
        }

        if (exportJob.status !== "completed") {
          return res.status(400).json({
            error: "Export is not completed",
            status: exportJob.status,
          });
        }

        if (!exportJob.outputPath || !fs.existsSync(exportJob.outputPath)) {
          return res.status(404).json({
            error: "Export file not found",
          });
        }

        // Set headers for download
        const filename = path.basename(exportJob.outputPath);
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.setHeader("X-Export-Checksum", exportJob.checksum || "");
        res.setHeader("X-Export-Record-Count", exportJob.recordCount || 0);

        // Stream the file
        const fileStream = fs.createReadStream(exportJob.outputPath);
        fileStream.pipe(res);
      } catch (error) {
        console.error(
          "[ResearchExportRoutes] Error downloading export:",
          error,
        );
        res.status(500).json({
          error: "Failed to download export",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // CANCEL EXPORT
  // POST /exports/:id/cancel
  // ============================================================

  router.post(
    "/exports/:id/cancel",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const exportJob = await exportService.getExportStatus(req.params.id);

        if (!exportJob) {
          return res.status(404).json({
            error: "Export not found",
          });
        }

        if (!["pending", "processing"].includes(exportJob.status)) {
          return res.status(400).json({
            error: "Export cannot be cancelled",
            status: exportJob.status,
          });
        }

        // Update status to cancelled
        await pool.query(
          `UPDATE research_exports
           SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
           WHERE export_id = $1`,
          [req.params.id],
        );

        res.json({
          success: true,
          message: "Export cancelled",
        });
      } catch (error) {
        console.error("[ResearchExportRoutes] Error cancelling export:", error);
        res.status(500).json({
          error: "Failed to cancel export",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // GET DATA DICTIONARY
  // GET /dictionary
  // ============================================================

  router.get(
    "/dictionary",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const { type } = req.query;
        const dictionary = await exportService.getDataDictionary(type);

        res.json({
          success: true,
          dictionary,
          count: dictionary.length,
        });
      } catch (error) {
        console.error(
          "[ResearchExportRoutes] Error getting data dictionary:",
          error,
        );
        res.status(500).json({
          error: "Failed to get data dictionary",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // GET CONSENT STATISTICS
  // GET /consent-stats
  // ============================================================

  router.get(
    "/consent-stats",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const stats = await exportService.getConsentStats();

        res.json({
          success: true,
          stats,
        });
      } catch (error) {
        console.error(
          "[ResearchExportRoutes] Error getting consent stats:",
          error,
        );
        res.status(500).json({
          error: "Failed to get consent statistics",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // ROTATE ANONYMOUS IDs
  // POST /rotate-alids
  // ============================================================

  router.post(
    "/rotate-alids",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const { confirm } = req.body;

        if (confirm !== true) {
          return res.status(400).json({
            error: "Confirmation required",
            message:
              "ALID rotation is irreversible. Send { confirm: true } to proceed.",
            warning:
              "This will break continuity of anonymous IDs across exports.",
          });
        }

        const rotatedCount = await exportService.anonymizer.rotateALIDs();

        res.json({
          success: true,
          message: `Rotated ${rotatedCount} anonymous learner IDs`,
          rotatedCount,
        });
      } catch (error) {
        console.error("[ResearchExportRoutes] Error rotating ALIDs:", error);
        res.status(500).json({
          error: "Failed to rotate ALIDs",
          message: error.message,
        });
      }
    },
  );

  // ============================================================
  // GET SCHEMA VERSIONS
  // GET /schemas
  // ============================================================

  router.get("/schemas", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT version_id, version, export_type, is_current, created_at, release_notes
         FROM export_schema_versions
         ORDER BY export_type, created_at DESC`,
      );

      res.json({
        success: true,
        schemas: result.rows.map((row) => ({
          versionId: row.version_id,
          version: row.version,
          exportType: row.export_type,
          isCurrent: row.is_current,
          createdAt: row.created_at,
          releaseNotes: row.release_notes,
        })),
      });
    } catch (error) {
      console.error(
        "[ResearchExportRoutes] Error getting schema versions:",
        error,
      );
      res.status(500).json({
        error: "Failed to get schema versions",
        message: error.message,
      });
    }
  });

  return router;
}

export default createResearchExportRoutes;
