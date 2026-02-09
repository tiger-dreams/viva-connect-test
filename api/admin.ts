import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * Unified Admin API
 * Handles all admin-related operations
 *
 * Actions:
 * - GET ?action=active-rooms  : Get active rooms (from active-rooms.ts)
 * - GET ?action=call-history  : Get call history for a user (from call-history.ts)
 * - GET ?action=logs          : Get PlanetKit event logs (from logs.ts)
 */

interface ActiveRoom {
  room_id: string;
  participant_count: number;
  participants: Array<{
    user_id: string;
    display_name: string | null;
    joined_at: string;
  }>;
  last_activity: string;
  call_start_time: string | null;
}

interface CallHistoryUser {
  user_id: string;
  display_name: string;
  last_call_time: string;
  call_count: number;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const action = request.query.action as string;

  if (!action) {
    return response.status(400).json({
      success: false,
      error: 'Missing action parameter',
    });
  }

  try {
    switch (action) {
      case 'active-rooms':
        return await handleActiveRooms(request, response);
      case 'call-history':
        return await handleCallHistory(request, response);
      case 'logs':
        return await handleLogs(request, response);
      default:
        return response.status(400).json({
          success: false,
          error: 'Invalid action',
        });
    }
  } catch (error: any) {
    console.error('[Admin API] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * Handle Active Rooms
 * GET /api/admin?action=active-rooms&minutes=60
 */
async function handleActiveRooms(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  try {
    const minutesBack = parseInt((request.query.minutes as string) || '60');

    // Calculate the timestamp for N minutes ago
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();

    // Get all relevant events from the last N minutes
    const eventsResult = await sql`
      SELECT
        room_id,
        event_type,
        user_id,
        display_name,
        created_at,
        data
      FROM planetkit_events
      WHERE
        created_at >= ${cutoffTime}
        AND room_id IS NOT NULL
      ORDER BY created_at ASC
    `;

    // Process events to determine active rooms
    const roomMap = new Map<string, {
      participants: Map<string, { display_name: string | null; joined_at: string }>;
      last_activity: string;
      call_start_time: string | null;
      call_ended: boolean;
      online_count: number;
    }>();

    // Process events in chronological order (ASC) to build current state
    for (const event of eventsResult.rows) {
      const roomId = event.room_id;

      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, {
          participants: new Map(),
          last_activity: event.created_at,
          call_start_time: null,
          call_ended: false,
          online_count: 0,
        });
      }

      const room = roomMap.get(roomId)!;

      // Always update last activity time
      room.last_activity = event.created_at;

      // Extract online count from callback data (stored as string)
      const eventData = event.data || {};
      const onlineCount = parseInt(eventData.online || '0');
      room.online_count = onlineCount;

      // Handle different event types
      switch (event.event_type) {
        case 'GCALL_EVT_START':
          room.call_start_time = event.created_at;
          room.call_ended = false;
          break;

        case 'GCALL_EVT_END':
          room.call_ended = true;
          room.online_count = 0;
          room.participants.clear();
          break;

        case 'GCALL_EVT_USER_JOIN':
          if (event.user_id && !room.call_ended) {
            room.participants.set(event.user_id, {
              display_name: event.display_name || null,
              joined_at: event.created_at,
            });
          }
          break;

        case 'GCALL_EVT_USER_LEAVE':
          if (event.user_id) {
            room.participants.delete(event.user_id);
          }
          break;
      }
    }

    // Build response - only include rooms with active participants
    const activeRooms: ActiveRoom[] = [];

    for (const [roomId, roomData] of roomMap.entries()) {
      const shouldInclude = roomData.online_count > 0 || roomData.participants.size > 0;

      if (shouldInclude) {
        const participants = Array.from(roomData.participants.entries()).map(
          ([userId, data]) => ({
            user_id: userId,
            display_name: data.display_name,
            joined_at: data.joined_at,
          })
        );

        const participantCount = roomData.online_count > 0
          ? roomData.online_count
          : roomData.participants.size;

        activeRooms.push({
          room_id: roomId,
          participant_count: participantCount,
          participants,
          last_activity: roomData.last_activity,
          call_start_time: roomData.call_start_time,
        });
      }
    }

    // Sort by last activity (most recent first)
    activeRooms.sort((a, b) =>
      new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    );

    return response.status(200).json({
      success: true,
      data: activeRooms,
      total: activeRooms.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin API] Error in active-rooms:', error);
    throw error;
  }
}

/**
 * Handle Call History
 * GET /api/admin?action=call-history&userId=xxx&days=30
 */
async function handleCallHistory(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  try {
    const { userId, days = '30' } = request.query;

    console.log('[Admin API] call-history request:', { userId, days });

    if (!userId || typeof userId !== 'string') {
      return response.status(400).json({
        success: false,
        error: 'userId parameter is required',
      });
    }

    const daysNumber = parseInt(days as string);
    const cutoffTime = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000).toISOString();

    console.log('[Admin API] Query parameters:', {
      userId,
      daysNumber,
      cutoffTime,
    });

    // 1. Find rooms the user participated in
    const userRoomsResult = await sql`
      SELECT DISTINCT room_id
      FROM planetkit_events
      WHERE
        user_id = ${userId}
        AND room_id IS NOT NULL
        AND created_at >= ${cutoffTime}
        AND event_type IN ('GCALL_EVT_USER_JOIN', 'GCALL_EVT_START')
    `;

    const userRoomIds = userRoomsResult.rows.map(row => row.room_id);

    console.log('[Admin API] User rooms found:', {
      count: userRoomIds.length,
      roomIds: userRoomIds,
    });

    if (userRoomIds.length === 0) {
      console.log('[Admin API] No rooms found for user, returning empty list');
      return response.status(200).json({
        success: true,
        data: [],
      });
    }

    // 2. Find other users who were in the same rooms at the same time
    const otherUsersResult = await sql`
      WITH user_sessions AS (
        SELECT DISTINCT
          room_id,
          created_at,
          created_at - INTERVAL '10 minutes' as session_start,
          created_at + INTERVAL '10 minutes' as session_end
        FROM planetkit_events
        WHERE
          user_id = ${userId}
          AND room_id = ANY(${userRoomIds})
          AND event_type IN ('GCALL_EVT_USER_JOIN', 'GCALL_EVT_START')
          AND created_at >= ${cutoffTime}
      ),
      other_user_sessions AS (
        SELECT DISTINCT
          e.user_id,
          e.display_name,
          e.room_id,
          e.created_at
        FROM planetkit_events e
        INNER JOIN user_sessions us
          ON e.room_id = us.room_id
          AND e.created_at BETWEEN us.session_start AND us.session_end
        WHERE
          e.user_id IS NOT NULL
          AND e.user_id != ${userId}
          AND e.display_name IS NOT NULL
          AND e.event_type IN ('GCALL_EVT_USER_JOIN', 'GCALL_EVT_START')
          AND e.created_at >= ${cutoffTime}
      )
      SELECT
        user_id,
        display_name,
        MAX(created_at) as last_call_time,
        COUNT(DISTINCT room_id) as call_count
      FROM other_user_sessions
      GROUP BY user_id, display_name
      ORDER BY last_call_time DESC
    `;

    const callHistory: CallHistoryUser[] = otherUsersResult.rows.map(row => ({
      user_id: row.user_id,
      display_name: row.display_name,
      last_call_time: row.last_call_time,
      call_count: parseInt(row.call_count),
    }));

    const filteredCallHistory = callHistory.filter(u => u.user_id !== userId);

    console.log('[Admin API] Other users found:', {
      count: filteredCallHistory.length,
    });

    return response.status(200).json({
      success: true,
      data: filteredCallHistory,
    });
  } catch (error: any) {
    console.error('[Admin API] Error in call-history:', error);
    throw error;
  }
}

/**
 * Handle Logs
 * GET /api/admin?action=logs&days=7&roomId=xxx&eventType=xxx&userId=xxx&limit=100&offset=0
 */
async function handleLogs(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  try {
    const days = parseInt((request.query.days as string) || '7');
    const roomId = request.query.roomId as string;
    const eventType = request.query.eventType as string;
    const userId = request.query.userId as string;
    const limit = parseInt((request.query.limit as string) || '100');
    const offset = parseInt((request.query.offset as string) || '0');

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

    return response.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error: any) {
    console.error('[Admin API] Error in logs:', error);
    throw error;
  }
}
