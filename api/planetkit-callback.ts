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
function determineEventType(params: any): string {
  // If eventType is explicitly provided, use it
  if (params.eventType || params.event_type) {
    return params.eventType || params.event_type;
  }

  // Support both snake_case and camelCase
  const sc = params.sc; // Status Code
  const ueType = params.ue_type || params.ueType; // User Event Type
  const startTime = params.start_time || params.startTime;
  const endTime = params.end_time || params.endTime;

  // Call ended
  if (endTime && endTime !== '0' && endTime !== 0) {
    return 'CALL_END';
  }

  // Call started
  if (startTime && startTime !== '0' && startTime !== 0) {
    return 'CALL_START';
  }

  // User joined
  if (ueType === 'JOIN' || sc === 'S') {
    return 'USER_JOIN';
  }

  // User left
  if (ueType === 'LEAVE') {
    return 'USER_LEAVE';
  }

  // Default: generic callback
  return 'CALLBACK_RECEIVED';
}
