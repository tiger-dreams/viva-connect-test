import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface CallHistoryUser {
  user_id: string;
  display_name: string;
  last_call_time: string;
  call_count: number;
}

/**
 * GET /api/call-history
 *
 * Query params:
 * - userId: 현재 사용자의 LINE user ID (필수)
 * - days: 조회 기간 (기본값: 30일)
 *
 * Returns: 통화 이력이 있는 사용자 목록
 */
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

  try {
    const { userId, days = '30' } = request.query;

    console.log('[call-history] Request:', { userId, days });

    if (!userId || typeof userId !== 'string') {
      return response.status(400).json({
        success: false,
        error: 'userId parameter is required',
      });
    }

    const daysNumber = parseInt(days as string);
    const cutoffTime = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000).toISOString();

    console.log('[call-history] Query parameters:', {
      userId,
      daysNumber,
      cutoffTime,
    });

    // 1. 현재 사용자가 참여한 room_id 목록 찾기
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

    console.log('[call-history] User rooms found:', {
      count: userRoomIds.length,
      roomIds: userRoomIds,
    });

    if (userRoomIds.length === 0) {
      console.log('[call-history] No rooms found for user, returning empty list');
      return response.status(200).json({
        success: true,
        data: [],
      });
    }

    // 2. 그 room들에서 실제로 동시에 통화했던 다른 사용자들 찾기
    // 같은 룸에서 시간 차이가 10분 이내인 JOIN 이벤트가 있는 사용자만 조회
    const otherUsersResult = await sql`
      WITH user_sessions AS (
        -- 현재 사용자의 세션들
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
        -- 다른 사용자들의 세션들
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

    console.log('[call-history] Other users found:', {
      count: callHistory.length,
      users: callHistory.map(u => ({
        userId: u.user_id,
        displayName: u.display_name,
        callCount: u.call_count,
      })),
    });

    return response.status(200).json({
      success: true,
      data: callHistory,
    });
  } catch (error) {
    console.error('[call-history] Error fetching call history:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
