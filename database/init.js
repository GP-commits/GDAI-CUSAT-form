const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

function getDb() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbPath = path.join(DATA_DIR, 'submissions.db');
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrency
  db.exec('PRAGMA journal_mode = WAL');

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Section 1: Basic Information
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      branch TEXT NOT NULL,
      previous_club_experience TEXT,
      portfolio_link TEXT,

      -- Section 2: Role Selection
      role_applied TEXT NOT NULL,

      -- Sections 3-10: Role-specific answers (stored as JSON)
      role_answers TEXT NOT NULL DEFAULT '{}',

      -- Section 11: Final Questions
      second_role_choice TEXT,
      anything_else TEXT,
      available_for_interview TEXT NOT NULL,

      -- Metadata
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_role ON submissions(role_applied);
    CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
    CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
  `);

  return db;
}

module.exports = { getDb };
