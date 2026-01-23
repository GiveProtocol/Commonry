/**
 * Research Consent Routes
 *
 * User API endpoints for managing research data consent.
 * All routes require authentication.
 *
 * Endpoints:
 * - GET    /api/user/research-consent      - Get current consent status
 * - POST   /api/user/research-consent      - Update consent (opt-in/out)
 * - GET    /api/user/research-consent/info - Get research program information
 */

import { Router } from "express";

// Current consent form version
const CONSENT_VERSION = "1.0.0";

// Research program information
const RESEARCH_INFO = {
  version: CONSENT_VERSION,
  title: "Commonry Research Data Program",
  summary:
    "Help improve spaced repetition learning by contributing your anonymized study data to research.",
  description: `
By participating in the Commonry Research Data Program, you allow us to include your
anonymized learning data in research exports. This data helps researchers understand
how people learn and improve spaced repetition algorithms.

**What data is collected:**
- Study session metrics (duration, cards studied, accuracy)
- Review event patterns (response times, difficulty ratings)
- Aggregate statistics (streaks, total study time)
- Card content analysis (complexity, domain, word counts)

**Privacy protections:**
- All data is anonymized before export
- Your user ID is replaced with a rotating anonymous ID
- Timestamps are converted to relative offsets
- IP addresses and personal information are never exported
- Client/browser info is reduced to general categories only

**Your rights:**
- You can opt out at any time
- Opting out removes your data from future exports
- Previously exported data cannot be recalled (it's anonymous)
- You can request a copy of your raw data separately
`.trim(),
  dataCategories: [
    {
      name: "Study Sessions",
      description: "When you study, how long, and how many cards you review",
      fields: [
        "Session duration",
        "Cards studied count",
        "Correct/incorrect counts",
        "Average response time",
      ],
    },
    {
      name: "Review Events",
      description: "Individual card review interactions",
      fields: [
        "Response quality (1-5)",
        "Response time",
        "Card difficulty factor",
        "Review interval",
      ],
    },
    {
      name: "Learning Statistics",
      description: "Aggregate learning metrics",
      fields: [
        "Total reviews",
        "Study streaks",
        "Overall accuracy",
        "Cards mastered",
      ],
    },
    {
      name: "Card Analysis",
      description: "Content characteristics of cards you study",
      fields: [
        "Content domain (math, language, etc.)",
        "Complexity level",
        "Word counts",
      ],
    },
  ],
  privacyMeasures: [
    "Anonymous learner IDs rotated quarterly",
    "No email, name, or account info exported",
    "IP addresses never included",
    "Timestamps converted to relative offsets",
    "User agents reduced to platform category",
    "Only aggregated/anonymized data exported",
  ],
  contactEmail: "research@commonry.com",
  lastUpdated: "2025-01-22",
};

/**
 * Create research consent routes
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {Function} authenticateToken - Authentication middleware
 * @returns {Router} Express router
 */
export function createResearchConsentRoutes(pool, authenticateToken) {
  const router = Router();

  // ============================================================
  // GET CONSENT STATUS
  // GET /research-consent
  // ============================================================

  router.get("/research-consent", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT research_consent, research_consent_date, research_consent_version,
                data_retention_preference
         FROM privacy_settings
         WHERE user_id = $1`,
        [req.userId],
      );

      if (result.rows.length === 0) {
        // User has no privacy settings yet
        return res.json({
          success: true,
          consent: {
            hasConsented: false,
            consentDate: null,
            consentVersion: null,
            dataRetentionPreference: "standard",
            currentVersion: CONSENT_VERSION,
            needsUpdate: false,
          },
        });
      }

      const settings = result.rows[0];
      const hasConsented = settings.research_consent === true;
      const needsUpdate =
        hasConsented && settings.research_consent_version !== CONSENT_VERSION;

      res.json({
        success: true,
        consent: {
          hasConsented,
          consentDate: settings.research_consent_date,
          consentVersion: settings.research_consent_version,
          dataRetentionPreference:
            settings.data_retention_preference || "standard",
          currentVersion: CONSENT_VERSION,
          needsUpdate,
        },
      });
    } catch (error) {
      console.error("[ResearchConsentRoutes] Error getting consent:", error);
      res.status(500).json({
        error: "Failed to get consent status",
        message: error.message,
      });
    }
  });

  // ============================================================
  // UPDATE CONSENT
  // POST /research-consent
  // ============================================================

  router.post("/research-consent", authenticateToken, async (req, res) => {
    try {
      const { consent, dataRetentionPreference } = req.body;

      // Validate consent is boolean
      if (typeof consent !== "boolean") {
        return res.status(400).json({
          error: "Invalid consent value",
          message: "consent must be true or false",
        });
      }

      // Validate data retention preference if provided
      const validRetention = ["standard", "minimum", "extended"];
      if (
        dataRetentionPreference &&
        !validRetention.includes(dataRetentionPreference)
      ) {
        return res.status(400).json({
          error: "Invalid data retention preference",
          validValues: validRetention,
        });
      }

      // Upsert privacy settings with consent
      const result = await pool.query(
        `INSERT INTO privacy_settings (setting_id, user_id, research_consent, research_consent_date, research_consent_version, data_retention_preference)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           research_consent = $3,
           research_consent_date = CURRENT_TIMESTAMP,
           research_consent_version = CASE WHEN $3 = true THEN $4 ELSE NULL END,
           data_retention_preference = COALESCE($5, privacy_settings.data_retention_preference),
           updated_at = CURRENT_TIMESTAMP
         RETURNING research_consent, research_consent_date, research_consent_version, data_retention_preference`,
        [
          `ps_${req.userId}`,
          req.userId,
          consent,
          consent ? CONSENT_VERSION : null,
          dataRetentionPreference || "standard",
        ],
      );

      const settings = result.rows[0];

      // If user opted in, create their ALID
      if (consent) {
        try {
          await pool.query("SELECT get_or_create_alid($1)", [req.userId]);
        } catch (alidError) {
          console.error(
            "[ResearchConsentRoutes] Error creating ALID:",
            alidError,
          );
          // Don't fail the request - ALID will be created on first export
        }
      }

      console.log(
        `[ResearchConsentRoutes] User ${req.userId} ${consent ? "opted in" : "opted out"} of research`,
      );

      res.json({
        success: true,
        message: consent
          ? "Thank you for participating in research!"
          : "You have opted out of the research program.",
        consent: {
          hasConsented: settings.research_consent,
          consentDate: settings.research_consent_date,
          consentVersion: settings.research_consent_version,
          dataRetentionPreference: settings.data_retention_preference,
          currentVersion: CONSENT_VERSION,
          needsUpdate: false,
        },
      });
    } catch (error) {
      console.error("[ResearchConsentRoutes] Error updating consent:", error);
      res.status(500).json({
        error: "Failed to update consent",
        message: error.message,
      });
    }
  });

  // ============================================================
  // GET RESEARCH PROGRAM INFO
  // GET /research-consent/info
  // ============================================================

  router.get("/research-consent/info", async (req, res) => {
    // This endpoint doesn't require authentication
    // Anyone can view information about the research program
    res.json({
      success: true,
      info: RESEARCH_INFO,
    });
  });

  return router;
}

export default createResearchConsentRoutes;
