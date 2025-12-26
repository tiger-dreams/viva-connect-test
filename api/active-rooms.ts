import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

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

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const minutesBack = parseInt(url.searchParams.get('minutes') || '60');

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
        created_at >= NOW() - INTERVAL '${minutesBack} minutes'
        AND room_id IS NOT NULL
        AND event_type IN (
          'GCALL_EVT_START',
          'GCALL_EVT_END',
          'GCALL_EVT_USER_JOIN',
          'GCALL_EVT_USER_LEAVE'
        )
      ORDER BY created_at DESC
    `;

    // Process events to determine active rooms
    const roomMap = new Map<string, {
      participants: Map<string, { display_name: string | null; joined_at: string }>;
      last_activity: string;
      call_start_time: string | null;
      call_ended: boolean;
    }>();

    for (const event of eventsResult.rows) {
      const roomId = event.room_id;

      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, {
          participants: new Map(),
          last_activity: event.created_at,
          call_start_time: null,
          call_ended: false,
        });
      }

      const room = roomMap.get(roomId)!;

      // Update last activity time (most recent event)
      if (new Date(event.created_at) > new Date(room.last_activity)) {
        room.last_activity = event.created_at;
      }

      switch (event.event_type) {
        case 'GCALL_EVT_START':
          room.call_start_time = event.created_at;
          room.call_ended = false;
          break;

        case 'GCALL_EVT_END':
          room.call_ended = true;
          room.participants.clear(); // Clear all participants when call ends
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

    // Build response - only include rooms with active participants or recent activity
    const activeRooms: ActiveRoom[] = [];

    for (const [roomId, roomData] of roomMap.entries()) {
      // Include room if it has participants or had very recent activity (last 5 minutes)
      const lastActivityTime = new Date(roomData.last_activity);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const hasRecentActivity = lastActivityTime > fiveMinutesAgo;

      if (roomData.participants.size > 0 || (hasRecentActivity && !roomData.call_ended)) {
        const participants = Array.from(roomData.participants.entries()).map(
          ([userId, data]) => ({
            user_id: userId,
            display_name: data.display_name,
            joined_at: data.joined_at,
          })
        );

        activeRooms.push({
          room_id: roomId,
          participant_count: roomData.participants.size,
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

    return new Response(
      JSON.stringify({
        success: true,
        data: activeRooms,
        total: activeRooms.length,
        timestamp: new Date().toISOString(),
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
    console.error('[Active Rooms] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
