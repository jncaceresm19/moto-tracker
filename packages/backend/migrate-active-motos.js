// Migration: Create active_motos table
// Run: node migrate-active-motos.js

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

try {
  // Create active_motos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_motos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      motorcycle_id TEXT NOT NULL REFERENCES motorcycles(id),
      activated_at INTEGER NOT NULL,
      activation_lat REAL,
      activation_lon REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_active_motos_user_id ON active_motos(user_id);
  `);

  // Create unique index (only one active moto per user)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_motos_user_unique ON active_motos(user_id);
  `);

  console.log('✅ Migration completed: active_motos table created');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
