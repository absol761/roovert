// Database utility for privacy-focused visitor tracking
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Singleton database instance
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  // On Vercel/serverless, SQLite won't work - return null or throw gracefully
  if (process.env.VERCEL || !existsSync(join(process.cwd(), 'data'))) {
    throw new Error('SQLite not available in serverless environment');
  }
  
  if (!db) {
    try {
      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      
      const dbPath = join(dataDir, 'visitors.db');
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL'); // Better performance for concurrent access
      
      // Initialize schema if tables don't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS unique_visitors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          visitor_hash TEXT NOT NULL UNIQUE,
          first_seen INTEGER NOT NULL,
          last_seen INTEGER NOT NULL,
          visit_count INTEGER DEFAULT 1
        );
        
        CREATE INDEX IF NOT EXISTS idx_visitor_hash ON unique_visitors(visitor_hash);
        CREATE INDEX IF NOT EXISTS idx_first_seen ON unique_visitors(first_seen);
        CREATE INDEX IF NOT EXISTS idx_last_seen ON unique_visitors(last_seen);
      `);
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
  return db;
}

// Close database connection (useful for cleanup)
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

