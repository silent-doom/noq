import { NextRequest, NextResponse } from 'next/server';
import { logProductionIncident } from '@/lib/incidentLogger';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const path = body.path || req.headers.get('referer') || 'Unknown';

    await logProductionIncident({
      level: body.level || 'ERROR',
      category: body.category || 'CLIENT_EXCEPTION',
      message: body.message || 'Unknown client issue',
      stack: body.stack,
      path: path.slice(0, 250),
      userAgent: userAgent.slice(0, 500),
      metadata: body.metadata || {},
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to log client issue:', err);
    return NextResponse.json({ error: 'Failed to record issue' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const superAdminHeader = req.headers.get('x-superadmin-key');
    const isValidSuperAdmin =
      superAdminHeader &&
      superAdminHeader === (process.env.SUPERADMIN_SECRET || 'noq-vault-9842-x7k9p-mstr');

    const client = await db.connect();
    try {
      const logsRes = await client.query(
        `SELECT * FROM production_issue_logs ORDER BY created_at DESC LIMIT 50`
      );
      return NextResponse.json({ success: true, count: logsRes.rows.length, issues: logsRes.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Failed to fetch issue logs:', err);
    return NextResponse.json({ error: 'Failed to retrieve logs', details: err?.message }, { status: 500 });
  }
}
