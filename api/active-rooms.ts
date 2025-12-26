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

    // Calculate the timestamp for N minutes ago
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();

    // Get all relevant events from the last N minutes
    // Include all event types to better track room activity
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
      online_count: number; // Track online count from callback
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

        // Handle other event types that indicate room activity
        case 'GCALL_EVT_STATUS_CHANGE':
        case 'GCALL_EVT_MEDIA_CHANGE':
        case 'GCALL_EVT_CALLBACK':
          // These events indicate room is active but don't change participant list
          break;
      }
    }

    // Build response - only include rooms with active participants
    const activeRooms: ActiveRoom[] = [];

    for (const [roomId, roomData] of roomMap.entries()) {
      // Include room if:
      // 1. online_count > 0 (from PlanetKit callback), OR
      // 2. It has tracked participants in our map
      const shouldInclude = roomData.online_count > 0 || roomData.participants.size > 0;

      if (shouldInclude) {
        const participants = Array.from(roomData.participants.entries()).map(
          ([userId, data]) => ({
            user_id: userId,
            display_name: data.display_name,
            joined_at: data.joined_at,
          })
        );

        // Use online_count as the authoritative participant count
        // Fall back to tracked participants if online_count is 0
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
