import pg from 'pg';
import { env } from './env.js';
const { Pool } = pg;
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 20, idleTimeoutMillis: 30000, statement_timeout: 15000 });
export async function tx(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
