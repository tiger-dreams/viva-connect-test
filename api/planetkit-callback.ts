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
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body
    const body = await request.json() as PlanetKitCallback;

    console.log('[PlanetKit Callback] Received event:', {
      eventType: body.eventType,
      roomId: body.roomId,
      userId: body.userId,
      timestamp: body.timestamp,
    });

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

    // Validate required fields
    if (!eventType) {
      return new Response(
        JSON.stringify({ success: false, error: 'eventType is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
