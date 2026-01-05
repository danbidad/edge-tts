const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(path.join(dbDir, 'sqlite.db'));

// Auto-initialize schema (to avoid drizzle-kit dependency in this env)
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tts_logs (
        id INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        voice TEXT NOT NULL,
        rate TEXT NOT NULL DEFAULT '0%',
        filename TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
    );
`);

// Migration for existing tables (ignore error if column exists)
try {
    sqlite.exec("ALTER TABLE tts_logs ADD COLUMN rate TEXT NOT NULL DEFAULT '0%'");
} catch (e) {
    // Column likely already exists
}

const db = drizzle(sqlite);

module.exports = { db };
