const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine DB path from environment variable or default
let dbFilePath;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    dbFilePath = path.resolve(process.cwd(), process.env.DATABASE_URL.replace('file:', ''));
} else {
    dbFilePath = path.join(__dirname, '../../data/sqlite.db'); // Fallback to root or default
}

console.log('process.env.DATABASE_URL', process.env.DATABASE_URL)
console.log('dbFilePath', dbFilePath)

const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbFilePath);

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
