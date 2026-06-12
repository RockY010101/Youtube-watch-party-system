// db.js — SQLite initialization using sql.js (pure JS/WASM, no native build needed)
//
// sql.js works differently from better-sqlite3:
//   • It's a WebAssembly build of SQLite — no C++ compilation required.
//   • The database lives IN MEMORY during runtime.
//   • We manually save the DB to disk after every write using:
//       db.export() → fs.writeFileSync()
//   • On startup we load the file back into memory (if it exists).

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Resolve paths ───────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'watch_party.db');

// ─── Singleton ────────────────────────────────────────────────────────────────
// _db is cached so getDb() only initialises once no matter how many files import it
let _db = null;

export async function getDb() {
  if (_db) return _db;

  // 1. Initialise the WASM runtime
  const SQL = await initSqlJs();

  // 2. Load existing file OR create a fresh DB
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    console.log(`[db] loaded existing SQLite file from ${DB_PATH}`);
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true }); // create /data dir if absent
    _db = new SQL.Database();
    console.log(`[db] created new in-memory SQLite database`);
  }

  // 3. Safety pragmas
  _db.run('PRAGMA foreign_keys = ON;');

  // 4. Create schema (safe to run every boot — IF NOT EXISTS guards it)
  _db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      code        TEXT PRIMARY KEY,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      user_id      TEXT NOT NULL,
      room_code    TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'participant',
      joined_at    INTEGER NOT NULL,
      PRIMARY KEY (user_id, room_code),
      FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
    );
  `);

  // 5. Flush to disk immediately so the file always exists after first boot
  persist(_db);
  console.log(`[db] schema ready — persisted to ${DB_PATH}`);

  return _db;
}

// ─── persist() ───────────────────────────────────────────────────────────────
// Call after any INSERT / UPDATE / DELETE to flush in-memory DB to disk.
// db.export() returns a Uint8Array of the raw SQLite binary.
export function persist(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}
