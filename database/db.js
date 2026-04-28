const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'wedding.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    has_plus_one INTEGER NOT NULL DEFAULT 0,
    rsvp_submitted INTEGER NOT NULL DEFAULT 0,
    attending INTEGER,
    meal_choice TEXT,
    bring_plus_one INTEGER,
    plus_one_name TEXT,
    plus_one_meal TEXT
  )
`);

module.exports = db;
