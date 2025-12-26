import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const roomId = url.searchParams.get('roomId');
    const eventType = url.searchParams.get('eventType');
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build dynamic query
    let whereConditions: string[] = [];
    let values: any[] = [];
    let valueIndex = 1;

    // Date range filter
    whereConditions.push(`created_at >= NOW() - INTERVAL '${days} days'`);

    // Room ID filter
    if (roomId) {
      whereConditions.push(`room_id = $${valueIndex}`);
      values.push(roomId);
      valueIndex++;
    }

    // Event type filter
    if (eventType) {
      whereConditions.push(`event_type = $${valueIndex}`);
      values.push(eventType);
      valueIndex++;
    }

    // User ID filter (partial match)
    if (userId) {
      whereConditions.push(`user_id ILIKE $${valueIndex}`);
      values.push(`%${userId}%`);
      valueIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM planetkit_events ${whereClause}`;
    const countResult = await sql.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0]?.count || '0');

    // Get paginated results
    const query = `
      SELECT
        id,
        event_type,
        service_id,
        room_id,
        user_id,
        display_name,
        timestamp,
        created_at,
        data
      FROM planetkit_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;

    const result = await sql.query(query, [...values, limit, offset]);

    return new Response(
      JSON.stringify({
        success: true,
        data: result.rows,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('[Logs API] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch logs',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
