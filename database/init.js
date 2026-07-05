const { createClient } = require('@libsql/client');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    // Fallback to local SQLite file for development if Turso is not configured yet
    console.log("No TURSO credentials found, using local file (for local development only)");
    dbInstance = createClient({
      url: 'file:./local.db'
    });
  } else {
    dbInstance = createClient({
      url,
      authToken,
    });
  }

  // Initialize tables (async, but we don't await it here to avoid blocking startup. 
  // It will execute quickly before first requests arrive).
  dbInstance.executeMultiple(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      branch TEXT NOT NULL,
      previous_club_experience TEXT,
      portfolio_link TEXT,
      role_applied TEXT NOT NULL,
      role_answers TEXT NOT NULL DEFAULT '{}',
      second_role_choice TEXT,
      anything_else TEXT,
      available_for_interview TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_role ON submissions(role_applied);
    CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
    CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
  `).catch(err => console.error("Database initialization failed:", err));

  return dbInstance;
}

module.exports = { getDb };
