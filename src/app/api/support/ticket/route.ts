import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSupportTicket, updateSupportTicketStatus, ensureSupportTableExists } from '@/lib/supportTickets';
import { logApiError } from '@/lib/incidentLogger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactName, contactPhone, subject, description, category, businessId, businessName, streamId, tokenId, source } = body;

    if (!contactName || !contactPhone || !subject || !description) {
      return NextResponse.json(
        { error: 'Name, contact phone, issue title, and description are required' },
        { status: 400 }
      );
    }

    const ticket = await createSupportTicket({
      contactName,
      contactPhone,
      subject,
      description,
      category: category || 'URGENT_BUG',
      businessId,
      businessName,
      streamId,
      tokenId,
      source: source || 'BUSINESS',
    });

    return NextResponse.json({
      success: true,
      message: 'Your report has been dispatched directly to the engineering team. Ticket reference created.',
      ticket,
    });
  } catch (error: any) {
    await logApiError(req, 'CLIENT_EXCEPTION', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit issue report' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSupportTableExists(client);
    const res = await client.query(
      `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100`
    );
    return NextResponse.json({ success: true, count: res.rows.length, tickets: res.rows });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch support tickets' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, status } = body;

    if (!ticketId || !status) {
      return NextResponse.json({ error: 'Ticket ID and status required' }, { status: 400 });
    }

    const updated = await updateSupportTicketStatus(Number(ticketId), status);
    return NextResponse.json({ success: true, ticket: updated });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ error: error?.message || 'Failed to update ticket' }, { status: 500 });
  }
}
