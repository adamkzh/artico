import * as SQLite from 'expo-sqlite';

// Open database
const db = SQLite.openDatabaseSync('artico.db');

let initPromise: Promise<void> | null = null;

// Initialize database
export const initDatabase = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Create tables if they don't exist
      await db.runAsync(
        'CREATE TABLE IF NOT EXISTS artworks (id TEXT PRIMARY KEY, type TEXT, museum_name TEXT, museum_location TEXT, title TEXT, artist TEXT, image_uri TEXT, description TEXT, created_at INTEGER, session_id TEXT, audio_url TEXT, liked INTEGER DEFAULT 0)'
      );
      await db.runAsync(
        'CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, type TEXT, artwork_id TEXT, role TEXT, text TEXT, audio_path TEXT, created_at INTEGER)'
      );

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      // Reset initPromise so a retry is possible
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

export default db;
