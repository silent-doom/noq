import { Pool } from 'pg';

// Prevents multiple connection pool instances in Next.js hot-reloading
const globalForPg = global as unknown as { pgPool: Pool };

export const db =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = db;