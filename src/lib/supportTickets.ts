import { db } from './db';
import { logProductionIncident } from './incidentLogger';

export interface SupportTicketPayload {
  source?: 'BUSINESS' | 'CUSTOMER' | 'OPERATOR';
  businessId?: string;
  businessName?: string;
  streamId?: string;
  tokenId?: string;
  contactName: string;
  contactPhone: string;
  category: 'AUDIO_ALERT' | 'QR_SCAN' | 'BILLING' | 'HARDWARE_TV' | 'URGENT_BUG' | 'OTHER';
  subject: string;
  description: string;
}

let tableEnsured = false;

export async function ensureSupportTableExists(client: any) {
  if (tableEnsured) return;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(30) UNIQUE NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'BUSINESS',
        business_id VARCHAR(255),
        business_name VARCHAR(255),
        stream_id VARCHAR(255),
        token_id VARCHAR(255),
        contact_name VARCHAR(150) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
    `);
    tableEnsured = true;
  } catch (err) {
    console.error('Failed to ensure support_tickets table:', err);
  }
}

/**
 * Creates a support and issue report ticket in PostgreSQL.
 */
export async function createSupportTicket(ticket: SupportTicketPayload) {
  const client = await db.connect();
  try {
    await ensureSupportTableExists(client);

    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const res = await client.query(
      `INSERT INTO support_tickets (
        ticket_number, source, business_id, business_name, stream_id, token_id,
        contact_name, contact_phone, category, subject, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OPEN')
      RETURNING *`,
      [
        ticketNumber,
        ticket.source || 'BUSINESS',
        ticket.businessId || null,
        ticket.businessName || null,
        ticket.streamId || null,
        ticket.tokenId || null,
        ticket.contactName.trim().slice(0, 150),
        ticket.contactPhone.trim().slice(0, 50),
        ticket.category || 'URGENT_BUG',
        ticket.subject.trim().slice(0, 255),
        ticket.description.trim(),
      ]
    );

    const savedTicket = res.rows[0];

    // Log incident in DB for immediate cross-telemetry visibility
    await logProductionIncident({
      level: 'WARN',
      category: 'CLIENT_EXCEPTION',
      message: `[SUPPORT TICKET ${ticketNumber}]: ${ticket.subject} (by ${ticket.contactName} - ${ticket.contactPhone})`,
      metadata: { ticketNumber, ...ticket },
    });

    return savedTicket;
  } finally {
    client.release();
  }
}

/**
 * Updates support ticket resolution status.
 */
export async function updateSupportTicketStatus(ticketId: number, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') {
  const client = await db.connect();
  try {
    await ensureSupportTableExists(client);
    const res = await client.query(
      `UPDATE support_tickets 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, ticketId]
    );
    return res.rows[0];
  } finally {
    client.release();
  }
}
