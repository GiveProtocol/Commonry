import pool from './db.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  try {
    console.log('Running email verification migration...');

    const sql = fs.readFileSync('./add-email-verification.sql', 'utf8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('Email verification fields added to users table.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
