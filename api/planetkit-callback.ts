import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

interface PlanetKitCallback {
  eventType: string;
  serviceId?: string;
  roomId?: string;
  userId?: string;
  displayName?: string;
  timestamp?: number;
  [key: string]: any;
}

export default async function handler(request: Request) {
  // Allow both GET and POST requests
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: PlanetKitCallback;
    let rawParams: any;

    // Parse request data based on method
    if (request.method === 'GET') {
      // Parse query parameters for GET requests
      const url = new URL(request.url);
      rawParams = Object.fromEntries(url.searchParams);
      console.log('[PlanetKit Callback] Received GET callback:', rawParams);

      // Map PlanetKit parameters to our format
      body = {
        eventType: determineEventType(rawParams),
        serviceId: rawParams.svc_id || rawParams.service_id || rawParams.svcId,
        roomId: rawParams.id || rawParams.room_id || rawParams.roomId,
        userId: rawParams.user_id || rawParams.userId,
        displayName: rawParams.display_name || rawParams.displayName,
        timestamp: parseInt(rawParams.ts || rawParams.timestamp || Date.now().toString()),
        ...rawParams, // Store all parameters
      };
    } else {
      // Parse JSON body for POST requests
      rawParams = await request.json();
      console.log('[PlanetKit Callback] Received POST callback:', rawParams);

      // Map PlanetKit parameters to our format (support both snake_case and camelCase)
      body = {
        eventType: rawParams.eventType || rawParams.event_type || determineEventType(rawParams),
        serviceId: rawParams.svc_id || rawParams.service_id || rawParams.svcId,
        roomId: rawParams.id || rawParams.room_id || rawParams.roomId,
        userId: rawParams.user_id || rawParams.userId,
        displayName: rawParams.display_name || rawParams.displayName,
        timestamp: parseInt(rawParams.ts || rawParams.timestamp || Date.now().toString()),
        ...rawParams, // Store all parameters
      };
    }

    // Extract key fields
    const {
      eventType,
      serviceId,
      roomId,
      userId,
      displayName,
      timestamp,
      ...additionalData
    } = body;

    // Log the parsed data
    console.log('[PlanetKit Callback] Parsed data:', {
      eventType,
      serviceId,
      roomId,
      userId,
      displayName,
      timestamp,
    });

    // Store event in database
    const result = await sql`
      INSERT INTO planetkit_events (
        event_type,
        service_id,
        room_id,
        user_id,
        display_name,
        timestamp,
        data
      ) VALUES (
        ${eventType},
        ${serviceId || null},
        ${roomId || null},
        ${userId || null},
        ${displayName || null},
        ${timestamp || Date.now()},
        ${JSON.stringify(additionalData)}
      )
      RETURNING id
    `;

    console.log('[PlanetKit Callback] Event stored with ID:', result.rows[0]?.id);

    // Send admin notifications for new room creation
    if (eventType === 'GCALL_EVT_START') {
      try {
        await sendAdminNotifications({
          roomId: roomId || 'Unknown',
          displayName: displayName || 'Unknown User',
          timestamp: timestamp || Date.now(),
        });
      } catch (notificationError) {
        // Log error but don't fail the callback
        console.error('[PlanetKit Callback] Failed to send admin notifications:', notificationError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event processed successfully',
        eventId: result.rows[0]?.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[PlanetKit Callback] Error:', error);
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

// Determine event type from PlanetKit callback parameters
// Based on PlanetKit Group Call Event callback documentation
function determineEventType(params: any): string {
  // If eventType is explicitly provided, use it
  if (params.eventType || params.event_type) {
    return params.eventType || params.event_type;
  }

  // Support both snake_case and camelCase
  const sc = params.sc; // Status Code: S=Started, C=Changed, E=Ended
  const msc = params.msc; // Media Status Code: C=Connected, D=Disconnected, T=Timeout, M=Media changed
  const ueType = params.ue_type || params.ueType; // User Event Type
  const startTime = params.start_time || params.startTime;
  const endTime = params.end_time || params.endTime;

  // Group call status code (sc)
  if (sc === 'E') {
    return 'GCALL_EVT_END'; // Group call ended
  }
  if (sc === 'S') {
    return 'GCALL_EVT_START'; // Group call started
  }

  // Media status code (msc) - participant events
  if (msc === 'C') {
    return 'GCALL_EVT_USER_JOIN'; // Participant connected
  }
  if (msc === 'D' || msc === 'T') {
    return 'GCALL_EVT_USER_LEAVE'; // Participant disconnected or timeout
  }
  if (msc === 'M') {
    return 'GCALL_EVT_MEDIA_CHANGE'; // Media changed (e.g., audio <-> video)
  }

  // Fallback: check timestamps
  if (endTime && endTime !== '0' && endTime !== 0) {
    return 'GCALL_EVT_END';
  }
  if (startTime && startTime !== '0' && startTime !== 0) {
    return 'GCALL_EVT_START';
  }

  // Legacy user event type
  if (ueType === 'JOIN') {
    return 'GCALL_EVT_USER_JOIN';
  }
  if (ueType === 'LEAVE') {
    return 'GCALL_EVT_USER_LEAVE';
  }

  // Default: generic callback with status change
  if (sc === 'C') {
    return 'GCALL_EVT_STATUS_CHANGE'; // Status changed
  }

  return 'GCALL_EVT_CALLBACK';
}

// Send notifications to admin users
async function sendAdminNotifications(params: {
  roomId: string;
  displayName: string;
  timestamp: number;
}) {
  const { roomId, displayName, timestamp } = params;

  // Get admin UIDs from environment variable
  const adminUids = process.env.VITE_ADMIN_UIDS?.split(',').map(id => id.trim()).filter(Boolean) || [];

  if (adminUids.length === 0) {
    console.log('[Admin Notifications] No admin UIDs configured');
    return;
  }

  console.log('[Admin Notifications] Sending notifications to admins:', adminUids);

  // Format timestamp
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Get LINE Channel Access Token
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:8080';

  const tokenUrl = `${baseUrl}/api/get-line-token`;

  try {
    const tokenResponse = await fetch(tokenUrl);

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get LINE token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const channelAccessToken = tokenData.access_token;

    if (!channelAccessToken) {
      throw new Error('Invalid token response');
    }

    // Send notifications to each admin
    const notificationPromises = adminUids.map(async (adminUid) => {
      const message = `🆕 새 룸이 생성되었습니다!\n\n룸: ${roomId}\n생성자: ${displayName}\n시간: ${formattedTime}`;

      try {
        const lineApiResponse = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: adminUid,
            messages: [
              {
                type: 'text',
                text: message,
              },
            ],
          }),
        });

        if (!lineApiResponse.ok) {
          const errorText = await lineApiResponse.text();
          console.error(`[Admin Notifications] Failed to send to ${adminUid}:`, errorText);
        } else {
          console.log(`[Admin Notifications] Successfully sent to ${adminUid}`);
        }
      } catch (error) {
        console.error(`[Admin Notifications] Error sending to ${adminUid}:`, error);
      }
    });

    // Wait for all notifications to complete
    await Promise.allSettled(notificationPromises);

  } catch (error) {
    console.error('[Admin Notifications] Error getting LINE token:', error);
    throw error;
  }
}
