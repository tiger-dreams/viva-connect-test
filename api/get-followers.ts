import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface UserProfile {
  user_id: string;
  display_name: string;
  last_seen: string;
  total_calls: number;
}

/**
 * GET /api/get-followers
 *
 * 앱을 사용한 적이 있는 모든 사용자 목록 조회 (planetkit_events 기반)
 * 어드민 권한이 있는 사용자만 호출 가능
 *
 * Query params:
 * - requesterId: 요청한 사용자의 LINE user ID (어드민 권한 확인용)
 * - days: 조회 기간 (기본값: 90일)
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
    const { requesterId, days = '90' } = request.query;

    console.log('[get-followers] Request:', { requesterId, days });

    // 어드민 권한 확인
    const adminUids = process.env.VITE_ADMIN_UIDS?.split(',').map(id => id.trim()) || [];

    if (!requesterId || typeof requesterId !== 'string') {
      return response.status(400).json({
        success: false,
        error: 'requesterId parameter is required',
      });
    }

    if (!adminUids.includes(requesterId)) {
      console.log('[get-followers] Access denied:', { requesterId, adminUids });
      return response.status(403).json({
        success: false,
        error: 'Access denied. Admin permission required.',
      });
    }

    // planetkit_events 테이블에서 앱을 사용한 모든 사용자 조회
    const daysNumber = parseInt(days as string);
    const cutoffTime = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000).toISOString();

    console.log('[get-followers] Query parameters:', {
      requesterId,
      daysNumber,
      cutoffTime,
    });

    const usersResult = await sql`
      SELECT
        user_id,
        display_name,
        MAX(created_at) as last_seen,
        COUNT(DISTINCT room_id) as total_calls
      FROM planetkit_events
      WHERE
        user_id IS NOT NULL
        AND user_id != ${requesterId}
        AND display_name IS NOT NULL
        AND created_at >= ${cutoffTime}
        AND event_type IN ('GCALL_EVT_USER_JOIN', 'GCALL_EVT_START')
      GROUP BY user_id, display_name
      ORDER BY last_seen DESC
      LIMIT 100
    `;

    const users: UserProfile[] = usersResult.rows.map(row => ({
      user_id: row.user_id,
      display_name: row.display_name,
      last_seen: row.last_seen,
      total_calls: parseInt(row.total_calls),
    }));

    console.log('[get-followers] Users found:', {
      count: users.length,
      users: users.map(u => ({
        userId: u.user_id,
        displayName: u.display_name,
        totalCalls: u.total_calls,
      })),
    });

    return response.status(200).json({
      success: true,
      data: users,
      total: users.length,
    });
  } catch (error) {
    console.error('[get-followers] Error fetching users:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
