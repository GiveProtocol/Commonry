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
import { ulid } from "ulid";
import crypto from "crypto";
import { sendVerificationEmail } from "./email-service.js";

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
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user by username from database
 */
async function getUserByUsername(username) {
  const result = await pool.query(
    "SELECT user_id FROM users WHERE username = $1",
    [username.toLowerCase()],
  );
  return result.rows[0] || null;
}

/**
 * Check if a specific privacy setting is enabled for a user
 */
async function checkPrivacySetting(userId, settingName) {
  const result = await pool.query(
    `SELECT ${settingName} FROM privacy_settings WHERE user_id = $1`,
    [userId],
  );
  // Default to true if no privacy settings exist
  return result.rows[0]?.[settingName] !== false;
}

/**
 * Generate ULID with prefix
 */
function generateULID(prefix) {
  return `${prefix}_${ulid()}`;
}

// ==================== AUTHENTICATION ENDPOINTS ====================

// User signup
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Generate ULID for user
    const userId = generateULID("usr");

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token (random 32-byte hex string)
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create user with verification fields
    const result = await pool.query(
      `INSERT INTO users (user_id, username, email, password_hash, display_name,
                         email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
       RETURNING user_id, username, email, display_name, created_at`,
      [
        userId,
        username.toLowerCase(),
        email.toLowerCase(),
        passwordHash,
        displayName || username,
        verificationToken,
        expiresAt,
      ],
    );

    const user = result.rows[0];

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email,
        user.display_name,
        verificationToken,
      );
      console.log(`✅ Verification email sent to ${user.email}`);
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError);
      // Don't fail signup if email fails, but log it
    }

    // Return success without JWT token
    res.status(201).json({
      message:
        "Account created successfully. Please check your email to verify your account.",
      email: user.email,
      requiresVerification: true,
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

// Email verification
app.get("/api/auth/verify-email/:token", async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Verification token is required" });
  }

  try {
    // Find user with matching token
    const result = await pool.query(
      `SELECT user_id, username, email, display_name, email_verified,
              verification_token_expires
       FROM users
       WHERE verification_token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error:
          "This verification link is invalid or has already been used. If you already verified your email, please try logging in.",
        invalidToken: true,
      });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(200).json({
        message: "Email already verified. You can now log in.",
        alreadyVerified: true,
      });
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(user.verification_token_expires);

    if (now > expiresAt) {
      return res.status(400).json({
        error: "Verification link has expired. Please request a new one.",
        expired: true,
      });
    }

    // Mark email as verified and clear token
    await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE user_id = $1`,
      [user.user_id],
    );

    console.log(`✅ Email verified for user: ${user.email}`);

    res.status(200).json({
      message: "Email verified successfully! You can now log in.",
      verified: true,
      username: user.username,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// Resend verification email
app.post("/api/auth/resend-verification", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Find user by email
    const result = await pool.query(
      `SELECT user_id, username, email, display_name, email_verified
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        message:
          "If an account with that email exists and is not verified, a new verification email will be sent.",
      });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({
        error: "This email is already verified. Please log in.",
        alreadyVerified: true,
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update token in database
    await pool.query(
      `UPDATE users
       SET verification_token = $1,
           verification_token_expires = $2
       WHERE user_id = $3`,
      [verificationToken, expiresAt, user.user_id],
    );

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email,
        user.display_name,
        verificationToken,
      );
      console.log(`✅ Resent verification email to: ${user.email}`);
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      message:
        "A new verification email has been sent. Please check your inbox.",
      email: user.email,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// User login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, username, email, password_hash, display_name, is_active, email_verified
       FROM users
       WHERE username = $1 OR email = $1`,
      [username.toLowerCase()],
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

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error:
          "Please verify your email before logging in. Check your inbox for the verification link.",
        emailNotVerified: true,
        email: user.email,
      });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id],
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
      [req.userId],
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

// ==================== PROFILE ENDPOINTS ====================

// Get user profile by username
app.get("/api/profile/:username", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user basic info and profile fields
    const userResult = await pool.query(
      `SELECT user_id, username, display_name, bio, pronouns, location,
              avatar_url, learning_topics, created_at
       FROM users
       WHERE username = $1 AND is_active = true`,
      [username.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Get privacy settings to determine what to show
    const privacyResult = await pool.query(
      `SELECT privacy_preset, show_statistics, show_decks, show_forum_activity,
              show_followers, show_achievements, show_goals
       FROM privacy_settings
       WHERE user_id = $1`,
      [user.user_id],
    );

    const privacy = privacyResult.rows[0] || {
      show_statistics: true,
      show_decks: true,
      show_forum_activity: true,
      show_followers: true,
      show_achievements: true,
      show_goals: false,
    };

    res.json({
      profile: {
        userId: user.user_id,
        username: user.username,
        displayName: user.display_name,
        bio: user.bio,
        pronouns: user.pronouns,
        location: user.location,
        avatarUrl: user.avatar_url,
        learningTopics: user.learning_topics,
        memberSince: user.created_at,
      },
      privacy,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Update current user's profile
app.put("/api/profile", authenticateToken, async (req, res) => {
  const { displayName, bio, pronouns, location, avatarUrl, learningTopics } =
    req.body;

  // Validate bio length
  if (bio && bio.length > 300) {
    return res
      .status(400)
      .json({ error: "Bio must be 300 characters or less" });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           bio = COALESCE($2, bio),
           pronouns = COALESCE($3, pronouns),
           location = COALESCE($4, location),
           avatar_url = COALESCE($5, avatar_url),
           learning_topics = COALESCE($6, learning_topics)
       WHERE user_id = $7
       RETURNING user_id, username, display_name, bio, pronouns, location,
                 avatar_url, learning_topics`,
      [
        displayName,
        bio,
        pronouns,
        location,
        avatarUrl,
        learningTopics,
        req.userId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Get user statistics
app.get("/api/profile/:username/stats", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user ID from username
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = user.user_id;

    // Check privacy settings
    const showStats = await checkPrivacySetting(userId, "show_statistics");

    if (!showStats) {
      return res.status(403).json({ error: "User statistics are private" });
    }

    // Get or create statistics record
    let statsResult = await pool.query(
      "SELECT * FROM user_statistics WHERE user_id = $1",
      [userId],
    );

    if (statsResult.rows.length === 0) {
      // Create default statistics record
      const statId = generateULID("stat");
      await pool.query(
        `INSERT INTO user_statistics (stat_id, user_id)
         VALUES ($1, $2)`,
        [statId, userId],
      );

      statsResult = await pool.query(
        "SELECT * FROM user_statistics WHERE user_id = $1",
        [userId],
      );
    }

    res.json({ stats: statsResult.rows[0] });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// Get user privacy settings
app.get(
  "/api/profile/:username/privacy",
  authenticateToken,
  async (req, res) => {
    const { username } = req.params;

    try {
      // Get user ID from username
      const userResult = await pool.query(
        "SELECT user_id FROM users WHERE username = $1",
        [username.toLowerCase()],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = userResult.rows[0].user_id;

      // Only allow users to see their own privacy settings
      if (userId !== req.userId) {
        return res
          .status(403)
          .json({ error: "Cannot view other users' privacy settings" });
      }

      const result = await pool.query(
        "SELECT * FROM privacy_settings WHERE user_id = $1",
        [userId],
      );

      if (result.rows.length === 0) {
        // Create default privacy settings
        const settingId = generateULID("priv");
        await pool.query(
          `INSERT INTO privacy_settings (setting_id, user_id)
         VALUES ($1, $2)`,
          [settingId, userId],
        );

        const newResult = await pool.query(
          "SELECT * FROM privacy_settings WHERE user_id = $1",
          [userId],
        );

        return res.json({ privacy: newResult.rows[0] });
      }

      res.json({ privacy: result.rows[0] });
      return null;
    } catch (error) {
      console.error("Get privacy settings error:", error);
      res.status(500).json({ error: "Failed to get privacy settings" });
      return null;
    }
  },
);

// Update user privacy settings
app.put("/api/profile/privacy", authenticateToken, async (req, res) => {
  const {
    privacyPreset,
    showStatistics,
    showDecks,
    showForumActivity,
    showFollowers,
    showAchievements,
    showGoals,
  } = req.body;

  try {
    // Check if privacy settings exist
    const existingResult = await pool.query(
      "SELECT setting_id FROM privacy_settings WHERE user_id = $1",
      [req.userId],
    );

    let result;

    if (existingResult.rows.length === 0) {
      // Create new privacy settings
      const settingId = generateULID("priv");
      result = await pool.query(
        `INSERT INTO privacy_settings (
           setting_id, user_id, privacy_preset, show_statistics, show_decks,
           show_forum_activity, show_followers, show_achievements, show_goals
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          settingId,
          req.userId,
          privacyPreset || "community_member",
          showStatistics !== undefined ? showStatistics : true,
          showDecks !== undefined ? showDecks : true,
          showForumActivity !== undefined ? showForumActivity : true,
          showFollowers !== undefined ? showFollowers : true,
          showAchievements !== undefined ? showAchievements : true,
          showGoals !== undefined ? showGoals : false,
        ],
      );
    } else {
      // Update existing privacy settings
      result = await pool.query(
        `UPDATE privacy_settings
         SET privacy_preset = COALESCE($1, privacy_preset),
             show_statistics = COALESCE($2, show_statistics),
             show_decks = COALESCE($3, show_decks),
             show_forum_activity = COALESCE($4, show_forum_activity),
             show_followers = COALESCE($5, show_followers),
             show_achievements = COALESCE($6, show_achievements),
             show_goals = COALESCE($7, show_goals),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $8
         RETURNING *`,
        [
          privacyPreset,
          showStatistics,
          showDecks,
          showForumActivity,
          showFollowers,
          showAchievements,
          showGoals,
          req.userId,
        ],
      );
    }

    res.json({ privacy: result.rows[0] });
  } catch (error) {
    console.error("Update privacy settings error:", error);
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

// Get all achievements
app.get("/api/achievements", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT achievement_id, name, description, category, badge_icon,
              criteria, display_order, rarity
       FROM achievements
       ORDER BY display_order ASC`,
    );

    res.json({ achievements: result.rows });
  } catch (error) {
    console.error("Get achievements error:", error);
    res.status(500).json({ error: "Failed to get achievements" });
  }
});

// Get user achievements
app.get("/api/profile/:username/achievements", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user ID from username
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = user.user_id;

    // Check privacy settings
    const showAchievements = await checkPrivacySetting(
      userId,
      "show_achievements",
    );

    if (!showAchievements) {
      return res.status(403).json({ error: "User achievements are private" });
    }

    // Get user achievements with achievement details
    const result = await pool.query(
      `SELECT ua.user_achievement_id, ua.progress, ua.target, ua.unlocked,
              ua.unlocked_at, a.achievement_id, a.name, a.description,
              a.category, a.badge_icon, a.criteria, a.rarity
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.achievement_id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked DESC, a.display_order ASC`,
      [userId],
    );

    res.json({ achievements: result.rows });
  } catch (error) {
    console.error("Get user achievements error:", error);
    res.status(500).json({ error: "Failed to get user achievements" });
  }
});

// Follow a user
app.post(
  "/api/profile/follow/:username",
  authenticateToken,
  async (req, res) => {
    const { username } = req.params;

    try {
      // Get user ID from username
      const userResult = await pool.query(
        "SELECT user_id FROM users WHERE username = $1 AND is_active = true",
        [username.toLowerCase()],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const followingId = userResult.rows[0].user_id;

      // Cannot follow yourself
      if (followingId === req.userId) {
        return res.status(400).json({ error: "Cannot follow yourself" });
      }

      // Check if already following
      const existingFollow = await pool.query(
        "SELECT follow_id FROM user_follows WHERE follower_id = $1 AND following_id = $2",
        [req.userId, followingId],
      );

      if (existingFollow.rows.length > 0) {
        return res.status(400).json({ error: "Already following this user" });
      }

      // Create follow relationship
      const followId = generateULID("flw");
      const result = await pool.query(
        `INSERT INTO user_follows (follow_id, follower_id, following_id)
       VALUES ($1, $2, $3)
       RETURNING follow_id, created_at`,
        [followId, req.userId, followingId],
      );

      res.status(201).json({
        success: true,
        follow: result.rows[0],
      });
      return null;
    } catch (error) {
      console.error("Follow user error:", error);
      res.status(500).json({ error: "Failed to follow user" });
      return null;
    }
  },
);

// Unfollow a user
app.delete(
  "/api/profile/follow/:username",
  authenticateToken,
  async (req, res) => {
    const { username } = req.params;

    try {
      // Get user ID from username
      const userResult = await pool.query(
        "SELECT user_id FROM users WHERE username = $1",
        [username.toLowerCase()],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const followingId = userResult.rows[0].user_id;

      // Delete follow relationship
      const result = await pool.query(
        `DELETE FROM user_follows
       WHERE follower_id = $1 AND following_id = $2
       RETURNING follow_id`,
        [req.userId, followingId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Not following this user" });
      }

      res.json({ success: true });
      return null;
    } catch (error) {
      console.error("Unfollow user error:", error);
      res.status(500).json({ error: "Failed to unfollow user" });
      return null;
    }
  },
);

// Get user's followers
app.get("/api/profile/:username/followers", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user ID from username
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = user.user_id;

    // Check privacy settings
    const showFollowers = await checkPrivacySetting(userId, "show_followers");

    if (!showFollowers) {
      return res.status(403).json({ error: "User followers list is private" });
    }

    // Get followers
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.display_name, u.avatar_url,
              uf.created_at as followed_at
       FROM user_follows uf
       JOIN users u ON uf.follower_id = u.user_id
       WHERE uf.following_id = $1 AND u.is_active = true
       ORDER BY uf.created_at DESC`,
      [userId],
    );

    res.json({ followers: result.rows });
  } catch (error) {
    console.error("Get followers error:", error);
    res.status(500).json({ error: "Failed to get followers" });
  }
});

// Get users that a user is following
app.get("/api/profile/:username/following", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user ID from username
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = user.user_id;

    // Check privacy settings
    const showFollowers = await checkPrivacySetting(userId, "show_followers");

    if (!showFollowers) {
      return res.status(403).json({ error: "User following list is private" });
    }

    // Get following
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.display_name, u.avatar_url,
              uf.created_at as followed_at
       FROM user_follows uf
       JOIN users u ON uf.following_id = u.user_id
       WHERE uf.follower_id = $1 AND u.is_active = true
       ORDER BY uf.created_at DESC`,
      [userId],
    );

    res.json({ following: result.rows });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).json({ error: "Failed to get following list" });
  }
});

// ==================== STUDY SESSION ENDPOINTS ====================

// Record a study session
app.post("/api/study-sessions", authenticateToken, async (req, res) => {
  const { cardId, timeSpentMs, rating, difficultyRating } = req.body;

  if (!cardId || timeSpentMs === undefined || !rating) {
    return res
      .status(400)
      .json({ error: "cardId, timeSpentMs, and rating are required" });
  }

  if (rating < 1 || rating > 4) {
    return res.status(400).json({ error: "Rating must be between 1 and 4" });
  }

  try {
    // Generate ULID for session
    const sessionId = generateULID("rev");

    const result = await pool.query(
      `INSERT INTO study_sessions (session_id, user_id, card_id, time_spent_ms, rating, difficulty_rating)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING session_id, studied_at, was_correct`,
      [
        sessionId,
        req.userId,
        cardId,
        timeSpentMs,
        rating,
        difficultyRating || null,
      ],
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

      // Generate ULID for each session
      const sessionId = generateULID("rev");

      const result = await client.query(
        `INSERT INTO study_sessions (session_id, user_id, card_id, time_spent_ms, rating, difficulty_rating)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING session_id, studied_at`,
        [
          sessionId,
          req.userId,
          cardId,
          timeSpentMs,
          rating,
          difficultyRating || null,
        ],
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
        [userId],
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
        [userId],
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
        [userId],
      );
      stats = result.rows[0];
    } else {
      // All-time stats
      const result = await pool.query(
        `SELECT * FROM user_statistics_total WHERE user_id = $1`,
        [userId],
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
app.get(
  "/api/statistics/daily/:userId",
  authenticateToken,
  async (req, res) => {
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
        [userId, startDate || "1970-01-01", endDate || "2099-12-31"],
      );

      res.json({ dailyStats: result.rows });
    } catch (error) {
      console.error("Get daily statistics error:", error);
      res.status(500).json({ error: "Failed to get daily statistics" });
    }
  },
);

// ==================== LEADERBOARD ENDPOINTS ====================

// Get leaderboard for a specific metric
app.get("/api/leaderboard/:metric", async (req, res) => {
  const { metric } = req.params;
  const { limit } = req.query;

  const validMetrics = [
    "total_cards",
    "total_time",
    "retention_rate",
    "current_streak",
  ];
  if (!validMetrics.includes(metric)) {
    return res.status(400).json({ error: "Invalid metric type" });
  }

  try {
    // First, refresh the leaderboard cache
    await pool.query("SELECT refresh_leaderboard($1, $2)", [
      metric,
      parseInt(limit) || 100,
    ]);

    // Then fetch the cached results
    const result = await pool.query(
      `SELECT rank, user_id, username, display_name, value, updated_at
       FROM leaderboard_cache
       WHERE metric_type = $1
       ORDER BY rank ASC`,
      [metric],
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
app.get(
  "/api/statistics/rank/:userId/:metric",
  authenticateToken,
  async (req, res) => {
    const { userId, metric } = req.params;

    const validMetrics = [
      "total_cards",
      "total_time",
      "retention_rate",
      "current_streak",
    ];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ error: "Invalid metric type" });
    }

    try {
      let column = "";
      let table = "";
      let whereClause = "";

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
        [userId],
      );

      if (result.rows.length === 0) {
        return res.json({ rank: null, value: 0 });
      }

      return res.json({
        metric,
        rank: result.rows[0].rank,
        value: result.rows[0].value,
      });
    } catch (error) {
      console.error("Get rank error:", error);
      return res.status(500).json({ error: "Failed to get rank" });
    }
  },
);

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
