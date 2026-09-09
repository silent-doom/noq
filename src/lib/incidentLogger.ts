import { db } from './db';

export interface IncidentLogPayload {
  level?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: 'PASS_GENERATION' | 'AUDIO_TTS' | 'WEBSOCKET_ABLY' | 'PAYMENT' | 'DATABASE' | 'CLIENT_EXCEPTION';
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

let tableEnsured = false;

async function ensureTableExists(client: any) {
  if (tableEnsured) return;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS production_issue_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(20) NOT NULL DEFAULT 'ERROR',
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        path VARCHAR(255),
        user_agent TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_issue_logs_created_at ON production_issue_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_issue_logs_category ON production_issue_logs(category);
    `);
    tableEnsured = true;
  } catch (err) {
    console.error('Failed to ensure production_issue_logs table:', err);
  }
}

/**
 * Persists runtime errors and client diagnostics into PostgreSQL database and server logs.
 */
export async function logProductionIncident(incident: IncidentLogPayload): Promise<void> {
  const level = incident.level || 'ERROR';
  const timestamp = new Date().toISOString();
  
  // Console logging with structured tag
  console.error(`[PROD_INCIDENT_${level}][${incident.category}][${timestamp}] ${incident.message}`, {
    path: incident.path,
    metadata: incident.metadata,
    stack: incident.stack,
  });

  try {
    const client = await db.connect();
    try {
      await ensureTableExists(client);
      await client.query(
        `INSERT INTO production_issue_logs (level, category, message, stack, path, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          level,
          incident.category,
          incident.message,
          incident.stack || null,
          incident.path || null,
          incident.userAgent || null,
          incident.metadata ? JSON.stringify(incident.metadata) : null,
        ]
      );
    } finally {
      client.release();
    }
  } catch (dbErr) {
    console.error('[logProductionIncident DB Failure]:', dbErr);
  }
}
