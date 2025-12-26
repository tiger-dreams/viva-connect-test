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

    if (!userId || typeof userId !== 'string') {
      return response.status(400).json({
        success: false,
        error: 'userId parameter is required',
      });
    }

    const daysNumber = parseInt(days as string);
    const cutoffTime = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000).toISOString();

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

    if (userRoomIds.length === 0) {
      return response.status(200).json({
        success: true,
        data: [],
      });
    }

    // 2. 그 room들에서 함께 참여했던 다른 사용자들 찾기
    const otherUsersResult = await sql`
      SELECT
        user_id,
        display_name,
        MAX(created_at) as last_call_time,
        COUNT(DISTINCT room_id) as call_count
      FROM planetkit_events
      WHERE
        room_id = ANY(${userRoomIds})
        AND user_id IS NOT NULL
        AND user_id != ${userId}
        AND display_name IS NOT NULL
        AND event_type IN ('GCALL_EVT_USER_JOIN', 'GCALL_EVT_START')
        AND created_at >= ${cutoffTime}
      GROUP BY user_id, display_name
      ORDER BY last_call_time DESC
    `;

    const callHistory: CallHistoryUser[] = otherUsersResult.rows.map(row => ({
      user_id: row.user_id,
      display_name: row.display_name,
      last_call_time: row.last_call_time,
      call_count: parseInt(row.call_count),
    }));

    return response.status(200).json({
      success: true,
      data: callHistory,
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
