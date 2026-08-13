import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    const searchParams = req.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'week'; // 'today' | 'week' | 'month'

    let dateFilterSql = `AND created_at >= NOW() - INTERVAL '7 days'`;
    if (timeframe === 'today') {
      dateFilterSql = `AND created_at >= CURRENT_DATE`;
    } else if (timeframe === 'month') {
      dateFilterSql = `AND created_at >= NOW() - INTERVAL '30 days'`;
    } else if (timeframe === 'all') {
      dateFilterSql = ``;
    }

    // Fetch stream info with business category
    const streamRes = await client.query(
      `SELECT qs.*, b.name AS business_name, b.category 
       FROM queue_streams qs 
       LEFT JOIN businesses b ON qs.business_id = b.id 
       WHERE qs.id = $1`,
      [streamId]
    );

    if (streamRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Queue stream not found' },
        { status: 404 }
      );
    }

    const stream = streamRes.rows[0];

    // Status counts filtered by timeframe
    const statusCountsRes = await client.query(
      `SELECT status, COUNT(*)::int AS count 
       FROM tokens 
       WHERE stream_id = $1 ${dateFilterSql}
       GROUP BY status`,
      [streamId]
    );

    const countsMap: Record<string, number> = {
      WAITING: 0,
      SERVING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      SKIPPED: 0,
    };

    statusCountsRes.rows.forEach((row) => {
      countsMap[row.status] = Number(row.count);
    });

    const totalIssued = Object.values(countsMap).reduce((a, b) => a + b, 0);

    // Average Service Duration (in minutes) for completed tokens
    const avgDurationRes = await client.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_serving_at - started_serving_at)) / 60)::float AS avg_mins
       FROM tokens
       WHERE stream_id = $1 AND status = 'COMPLETED' AND completed_serving_at IS NOT NULL AND started_serving_at IS NOT NULL ${dateFilterSql}`,
      [streamId]
    );

    const rawAvg = avgDurationRes.rows[0]?.avg_mins;
    const avgServiceTimeMins = rawAvg && !isNaN(rawAvg) 
      ? Math.round(Math.min(60, Math.max(1, rawAvg)) * 10) / 10 
      : Number(stream.pace_per_patient_mins || 15);

    // Customer Satisfaction Feedback Stats
    const feedbackStatsRes = await client.query(
      `SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS total_feedback
       FROM feedbacks
       WHERE stream_id = $1`,
      [streamId]
    );

    const avgRatingRaw = feedbackStatsRes.rows[0]?.avg_rating;
    const satisfactionScore = avgRatingRaw && !isNaN(avgRatingRaw)
      ? Math.round(avgRatingRaw * 10) / 10
      : 5.0;
    const totalFeedbackCount = Number(feedbackStatsRes.rows[0]?.total_feedback || 0);

    // Recent Feedbacks List
    const recentFeedbacksRes = await client.query(
      `SELECT f.id, f.rating, f.comment, f.created_at, t.token_number, t.customer_name
       FROM feedbacks f
       JOIN tokens t ON f.token_id = t.id
       WHERE f.stream_id = $1
       ORDER BY f.created_at DESC
       LIMIT 6`,
      [streamId]
    );

    // Access Channel Breakdown
    const channelRes = await client.query(
      `SELECT COALESCE(access_channel, 'WALK_IN') AS channel, COUNT(*)::int AS count
       FROM tokens
       WHERE stream_id = $1 ${dateFilterSql}
       GROUP BY access_channel`,
      [streamId]
    );

    const channelBreakdown = channelRes.rows.map((r) => ({
      channel: r.channel,
      count: Number(r.count),
    }));

    // Hourly distribution for graph
    const hourlyRes = await client.query(
      `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
       FROM tokens
       WHERE stream_id = $1 ${dateFilterSql}
       GROUP BY hour
       ORDER BY hour ASC`,
      [streamId]
    );

    const hourlyDistribution = hourlyRes.rows.map((r) => ({
      hour: r.hour,
      label: `${r.hour % 12 === 0 ? 12 : r.hour % 12}${r.hour >= 12 ? 'PM' : 'AM'}`,
      count: Number(r.count),
    }));

    // Recent Activity / Served Tokens History
    const recentRes = await client.query(
      `SELECT id, token_number, customer_name, customer_phone, status, access_channel, started_serving_at, completed_serving_at, created_at
       FROM tokens
       WHERE stream_id = $1
       ORDER BY updated_at DESC
       LIMIT 10`,
      [streamId]
    );

    return NextResponse.json({
      success: true,
      analytics: {
        timeframe,
        stream: {
          id: stream.id,
          business_name: stream.business_name || 'Business Venue',
          category: stream.category || 'general',
          stream_name: stream.stream_name || 'Main Queue',
          pace_per_patient_mins: Number(stream.pace_per_patient_mins || 15),
        },
        summary: {
          totalIssued,
          waiting: countsMap.WAITING,
          serving: countsMap.SERVING,
          completed: countsMap.COMPLETED,
          skipped: countsMap.SKIPPED,
          cancelled: countsMap.CANCELLED,
          completionRate: totalIssued > 0 ? Math.round((countsMap.COMPLETED / totalIssued) * 100) : 0,
          avgServiceTimeMins,
          satisfactionScore,
          totalFeedbackCount,
        },
        channelBreakdown,
        hourlyDistribution,
        recentFeedbacks: recentFeedbacksRes.rows,
        recentActivity: recentRes.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching queue analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
