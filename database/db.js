const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Unix socket connections (Cloud SQL via Cloud Run) don't support SSL —
// the proxy tunnel is already encrypted. Only use SSL for TCP connections.
const dbUrl = process.env.DATABASE_URL;
const isUnixSocket = dbUrl && dbUrl.includes('host=/');

const pool = new Pool(
  dbUrl
    ? {
        connectionString: dbUrl,
        ssl: (isProduction && !isUnixSocket) ? { rejectUnauthorized: false } : false,
      }
    : {
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASS     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME     || 'wedding',
      }
);

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guests (
      id               SERIAL PRIMARY KEY,
      name             TEXT    NOT NULL,
      type             TEXT    NOT NULL CHECK (type IN ('Y', 'N', 'C')),
      rsvp_submitted   INTEGER NOT NULL DEFAULT 0,
      attending        INTEGER,
      person1_meal     TEXT,
      person1_dietary  TEXT,
      bring_plus_one   INTEGER,
      person2_name     TEXT,
      person2_meal     TEXT,
      person2_dietary  TEXT
    )
  `);
}

async function resetSchema() {
  await pool.query('DROP TABLE IF EXISTS guests');
  await initSchema();
}

module.exports = { pool, initSchema, resetSchema };
