import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const upload = multer({ dest: UPLOADS_DIR });

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

/**
 * Validate that a file path is within the uploads directory
 * Prevents path traversal attacks
 */
function isPathSafe(filePath, baseDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  return (
    resolvedPath.startsWith(resolvedBase + path.sep) ||
    resolvedPath === resolvedBase
  );
}

// General rate limiter: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for file uploads: 5 uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 upload requests per windowMs
  message: "Too many upload requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(cors());
app.use(generalLimiter);

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// ==================== AUTHENTICATION ENDPOINTS ====================

// User signup
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, email, display_name, created_at`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash, displayName || username]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(201).json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    if (error.constraint === "users_username_key") {
      return res.status(409).json({ error: "Username already taken" });
    }
    if (error.constraint === "users_email_key") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// User login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, username, email, password_hash, display_name, is_active
       FROM users
       WHERE username = $1 OR email = $1`,
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Get current user
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, username, email, display_name, created_at, last_login_at
       FROM users
       WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ==================== STUDY SESSION ENDPOINTS ====================

// Record a study session
app.post("/api/study-sessions", authenticateToken, async (req, res) => {
  const { cardId, timeSpentMs, rating, difficultyRating } = req.body;

  if (!cardId || timeSpentMs === undefined || !rating) {
    return res.status(400).json({ error: "cardId, timeSpentMs, and rating are required" });
  }

  if (rating < 1 || rating > 4) {
    return res.status(400).json({ error: "Rating must be between 1 and 4" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO study_sessions (user_id, card_id, time_spent_ms, rating, difficulty_rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING session_id, studied_at, was_correct`,
      [req.userId, cardId, timeSpentMs, rating, difficultyRating || null]
    );

    res.status(201).json({
      success: true,
      session: result.rows[0],
    });
  } catch (error) {
    console.error("Record session error:", error);
    res.status(500).json({ error: "Failed to record study session" });
  }
});

// Batch record study sessions
app.post("/api/study-sessions/batch", authenticateToken, async (req, res) => {
  const { sessions } = req.body;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ error: "sessions array is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const results = [];
    for (const session of sessions) {
      const { cardId, timeSpentMs, rating, difficultyRating } = session;

      const result = await client.query(
        `INSERT INTO study_sessions (user_id, card_id, time_spent_ms, rating, difficulty_rating)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING session_id, studied_at`,
        [req.userId, cardId, timeSpentMs, rating, difficultyRating || null]
      );

      results.push(result.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      count: results.length,
      sessions: results,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Batch record error:", error);
    res.status(500).json({ error: "Failed to record study sessions" });
  } finally {
    client.release();
  }
});

// ==================== STATISTICS ENDPOINTS ====================

// Get user statistics
app.get("/api/statistics/user/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { period } = req.query; // 'today', 'week', 'month', 'all'

  try {
    let stats;

    if (period === "today") {
      const result = await pool.query(
        `SELECT date, cards_studied, unique_cards, total_time_ms,
                correct_answers, total_answers, retention_rate
         FROM user_statistics_daily
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId]
      );
      stats = result.rows[0] || {
        cards_studied: 0,
        unique_cards: 0,
        total_time_ms: 0,
        correct_answers: 0,
        total_answers: 0,
        retention_rate: 0,
      };
    } else if (period === "week") {
      const result = await pool.query(
        `SELECT
          SUM(cards_studied) as cards_studied,
          SUM(unique_cards) as unique_cards,
          SUM(total_time_ms) as total_time_ms,
          SUM(correct_answers) as correct_answers,
          SUM(total_answers) as total_answers,
          CASE
            WHEN SUM(total_answers) > 0
            THEN (SUM(correct_answers)::DECIMAL / SUM(total_answers) * 100)
            ELSE 0
          END as retention_rate
         FROM user_statistics_daily
         WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'`,
        [userId]
      );
      stats = result.rows[0];
    } else if (period === "month") {
      const result = await pool.query(
        `SELECT
          SUM(cards_studied) as cards_studied,
          SUM(unique_cards) as unique_cards,
          SUM(total_time_ms) as total_time_ms,
          SUM(correct_answers) as correct_answers,
          SUM(total_answers) as total_answers,
          CASE
            WHEN SUM(total_answers) > 0
            THEN (SUM(correct_answers)::DECIMAL / SUM(total_answers) * 100)
            ELSE 0
          END as retention_rate
         FROM user_statistics_daily
         WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );
      stats = result.rows[0];
    } else {
      // All-time stats
      const result = await pool.query(
        `SELECT * FROM user_statistics_total WHERE user_id = $1`,
        [userId]
      );
      stats = result.rows[0] || {
        total_cards_studied: 0,
        total_time_ms: 0,
        total_correct: 0,
        total_attempts: 0,
        retention_rate: 0,
        current_streak: 0,
        longest_streak: 0,
      };
    }

    res.json({ stats });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// Get daily statistics for a date range
app.get("/api/statistics/daily/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const result = await pool.query(
      `SELECT date, cards_studied, unique_cards, total_time_ms,
              correct_answers, total_answers, retention_rate
       FROM user_statistics_daily
       WHERE user_id = $1
         AND date >= $2
         AND date <= $3
       ORDER BY date ASC`,
      [userId, startDate || "1970-01-01", endDate || "2099-12-31"]
    );

    res.json({ dailyStats: result.rows });
  } catch (error) {
    console.error("Get daily statistics error:", error);
    res.status(500).json({ error: "Failed to get daily statistics" });
  }
});

// ==================== LEADERBOARD ENDPOINTS ====================

// Get leaderboard for a specific metric
app.get("/api/leaderboard/:metric", async (req, res) => {
  const { metric } = req.params;
  const { limit } = req.query;

  const validMetrics = ["total_cards", "total_time", "retention_rate", "current_streak"];
  if (!validMetrics.includes(metric)) {
    return res.status(400).json({ error: "Invalid metric type" });
  }

  try {
    // First, refresh the leaderboard cache
    await pool.query("SELECT refresh_leaderboard($1, $2)", [metric, parseInt(limit) || 100]);

    // Then fetch the cached results
    const result = await pool.query(
      `SELECT rank, user_id, username, display_name, value, updated_at
       FROM leaderboard_cache
       WHERE metric_type = $1
       ORDER BY rank ASC`,
      [metric]
    );

    res.json({
      metric,
      leaderboard: result.rows,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// Get user's rank for a specific metric
app.get("/api/statistics/rank/:userId/:metric", authenticateToken, async (req, res) => {
  const { userId, metric } = req.params;

  const validMetrics = ["total_cards", "total_time", "retention_rate", "current_streak"];
  if (!validMetrics.includes(metric)) {
    return res.status(400).json({ error: "Invalid metric type" });
  }

  try {
    let column, table, whereClause;

    if (metric === "total_cards") {
      column = "total_cards_studied";
      table = "user_statistics_total";
      whereClause = "total_cards_studied > 0";
    } else if (metric === "total_time") {
      column = "total_time_ms";
      table = "user_statistics_total";
      whereClause = "total_time_ms > 0";
    } else if (metric === "retention_rate") {
      column = "retention_rate";
      table = "user_statistics_total";
      whereClause = "total_attempts >= 50";
    } else if (metric === "current_streak") {
      column = "current_streak";
      table = "user_statistics_total";
      whereClause = "current_streak > 0";
    }

    const result = await pool.query(
      `WITH ranked_users AS (
        SELECT
          user_id,
          ${column} as value,
          ROW_NUMBER() OVER (ORDER BY ${column} DESC) as rank
        FROM ${table}
        WHERE ${whereClause}
      )
      SELECT rank, value
      FROM ranked_users
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ rank: null, value: 0 });
    }

    res.json({
      metric,
      rank: result.rows[0].rank,
      value: result.rows[0].value,
    });
  } catch (error) {
    console.error("Get rank error:", error);
    res.status(500).json({ error: "Failed to get rank" });
  }
});

// Upload and import Anki deck
app.post(
  "/api/decks/import",
  uploadLimiter,
  upload.single("deck"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate uploaded file path is within uploads directory
    if (!isPathSafe(req.file.path, UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    const client = await pool.connect();
    const tempDir = path.join(UPLOADS_DIR, `temp_${Date.now()}`);
    let ankiDb = null;

    try {
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(tempDir, true);

      // Validate temp directory is within uploads directory
      if (!isPathSafe(tempDir, UPLOADS_DIR)) {
        throw new Error("Invalid temp directory path");
      }

      // Open Anki's SQLite database (try different versions)
      let collectionPath = path.join(tempDir, "collection.anki21");
      if (!fs.existsSync(collectionPath)) {
        collectionPath = path.join(tempDir, "collection.anki21b");
      }
      if (!fs.existsSync(collectionPath)) {
        collectionPath = path.join(tempDir, "collection.anki2");
      }
      if (!fs.existsSync(collectionPath)) {
        throw new Error("Invalid .apkg file: no collection file found");
      }

      ankiDb = new Database(collectionPath, { readonly: true });

      await client.query("BEGIN");

      // Get deck info from Anki
      const _decks = ankiDb.prepare("SELECT * FROM col").get();
      const deckName = req.body.deckName || "Imported Deck";

      // Create deck in our database
      const deckResult = await client.query(
        `
      INSERT INTO decks (name, description, metadata)
      VALUES ($1, $2, $3)
      RETURNING deck_id
    `,
        [deckName, "Imported from Anki", JSON.stringify({})],
      );

      const deckId = deckResult.rows[0].deck_id;

      // Get all notes (cards) from Anki
      const notes = ankiDb.prepare("SELECT * FROM notes").all();

      let cardCount = 0;
      for (const note of notes) {
        const fields = note.flds.split("\x1f"); // Anki uses \x1f as separator

        if (fields.length >= 2) {
          await client.query(
            `
          INSERT INTO cards (deck_id, card_type, front_content, back_content, tags)
          VALUES ($1, $2, $3, $4, $5)
        `,
            [
              deckId,
              "basic",
              JSON.stringify({ html: fields[0], media: [] }),
              JSON.stringify({ html: fields[1], media: [] }),
              note.tags ? note.tags.split(" ") : [],
            ],
          );
          cardCount++;
        }
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        deckId,
        deckName,
        cardsImported: cardCount,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Import error:", error);
      return res.status(500).json({ error: error.message });
    } finally {
      // Close database connection if opened
      if (ankiDb) {
        try {
          ankiDb.close();
        } catch (e) {
          console.error("Error closing Anki database:", e);
        }
      }

      // Clean up temporary files - validate paths before deletion
      // Define a helper that robustly checks whether filePath is strictly inside dirPath:
      const isPathContained = (filePath, dirPath) => {
        try {
          const fileReal = fs.realpathSync(filePath);
          let dirReal = fs.realpathSync(dirPath);
          // Ensure consistent separator at end of directory real path
          if (!dirReal.endsWith(path.sep)) {
            dirReal = dirReal + path.sep;
          }
          return fileReal.startsWith(dirReal);
        } catch (e) {
          // Could not resolve path; treat as not contained
          return false;
        }
      };

      // Clean up temporary directory
      try {
        if (fs.existsSync(tempDir) && isPathContained(tempDir, UPLOADS_DIR)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.error("Error cleaning up temp directory:", e);
      }

      // Clean up uploaded file
      try {
        if (req.file?.path) {
          // Initialize variable on declaration to satisfy DeepSource JS-0119
          let uploadedFileRealPath = null;
          try {
            // Resolve the real path to handle symlinks (addresses CodeQL path injection)
            uploadedFileRealPath = fs.realpathSync(req.file.path);
          } catch (e) {
            // If realpathSync fails, keep as null
            uploadedFileRealPath = null;
          }
          // Only delete if path is valid and contained within UPLOADS_DIR
          if (
            uploadedFileRealPath &&
            fs.existsSync(uploadedFileRealPath) &&
            isPathContained(uploadedFileRealPath, UPLOADS_DIR)
          ) {
            fs.unlinkSync(uploadedFileRealPath);
          }
        }
      } catch (e) {
        console.error("Error cleaning up uploaded file:", e);
      }

      client.release();
    }
  },
);

// Get all decks
app.get("/api/decks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM decks ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deck with cards
app.get("/api/decks/:id", async (req, res) => {
  try {
    const deck = await pool.query("SELECT * FROM decks WHERE deck_id = $1", [
      req.params.id,
    ]);
    const cards = await pool.query("SELECT * FROM cards WHERE deck_id = $1", [
      req.params.id,
    ]);

    res.json({
      deck: deck.rows[0],
      cards: cards.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
