import pool from "./db.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  try {
    // Get migration file from command line argument
    const migrationFile = process.argv[2];

    if (!migrationFile) {
      console.error("❌ Please provide a migration file path");
      console.log("Usage: node run-migration.js <path-to-migration.sql>");
      throw new Error("Please provide a migration file path");
    }

    console.log(`Running migration: ${migrationFile}...`);

    const sql = fs.readFileSync(migrationFile, "utf8");

    await pool.query(sql);

    console.log("✅ Migration completed successfully!");

    process.exitCode = 0;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

runMigration();
