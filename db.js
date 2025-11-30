import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL from environment, with fallback to individual params
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL configuration for production
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export default pool;
