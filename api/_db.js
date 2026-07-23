// api/_db.js — Pool de conexión compartido a Neon Postgres
import pg from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
