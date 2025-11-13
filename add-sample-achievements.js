import pool from "./db.js";
import { ulid } from "ulid";
import dotenv from "dotenv";

dotenv.config();

async function addSampleAchievements() {
  try {
    // Get the user ID (moonlitmountains)
    const userResult = await pool.query(
      "SELECT user_id FROM users WHERE username = 'moonlitmountains'",
    );

    if (userResult.rows.length === 0) {
      console.error("User not found!");
      process.exit(1);
    }

    const userId = userResult.rows[0].user_id;
    console.log(`Adding sample achievements for user: ${userId}`);

    // Define achievements to add
    const achievements = [
      // UNLOCKED achievements
      {
        achievementId: "achv_01", // Week Warrior - 7-day streak
        progress: 7,
        target: 7,
        unlocked: true,
        unlockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
      {
        achievementId: "achv_05", // Perfect Week
        progress: 7,
        target: 7,
        unlocked: true,
        unlockedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      },
      {
        achievementId: "achv_06", // First Steps - 100 cards reviewed
        progress: 100,
        target: 100,
        unlocked: true,
        unlockedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      },

      // IN PROGRESS achievements
      {
        achievementId: "achv_02", // Month Master - 30-day streak
        progress: 12, // Longest streak so far
        target: 30,
        unlocked: false,
        unlockedAt: null,
      },
      {
        achievementId: "achv_07", // Knowledge Seeker - 1,000 cards reviewed
        progress: 342, // Current review count
        target: 1000,
        unlocked: false,
        unlockedAt: null,
      },
      {
        achievementId: "achv_10", // Hundred Strong - 100 cards mastered
        progress: 87, // Current mastered count
        target: 100,
        unlocked: false,
        unlockedAt: null,
      },
      {
        achievementId: "achv_03", // Century Scholar - 100-day streak
        progress: 12, // Same as longest streak
        target: 100,
        unlocked: false,
        unlockedAt: null,
      },
    ];

    // Insert each achievement
    for (const achievement of achievements) {
      const userAchievementId = `uach_${ulid()}`;

      await pool.query(
        `INSERT INTO user_achievements (
          user_achievement_id, user_id, achievement_id,
          progress, target, unlocked, unlocked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, achievement_id) DO UPDATE SET
          progress = EXCLUDED.progress,
          target = EXCLUDED.target,
          unlocked = EXCLUDED.unlocked,
          unlocked_at = EXCLUDED.unlocked_at`,
        [
          userAchievementId,
          userId,
          achievement.achievementId,
          achievement.progress,
          achievement.target,
          achievement.unlocked,
          achievement.unlockedAt,
        ],
      );
    }

    console.log("✅ Sample achievements added successfully!\n");

    // Display summary
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const inProgressCount = achievements.filter((a) => !a.unlocked).length;

    console.log("Achievement Summary:");
    console.log(`  Unlocked: ${unlockedCount} achievements`);
    console.log("    🔥 Week Warrior - 7-day streak");
    console.log("    ✨ Perfect Week - Studied every day");
    console.log("    🌱 First Steps - 100 cards reviewed\n");

    console.log(`  In Progress: ${inProgressCount} achievements`);
    console.log("    ⭐ Month Master - 12/30 days");
    console.log("    📚 Knowledge Seeker - 342/1,000 cards");
    console.log("    🌟 Hundred Strong - 87/100 cards mastered");
    console.log("    💎 Century Scholar - 12/100 day streak");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding sample achievements:", error);
    process.exit(1);
  }
}

addSampleAchievements();
