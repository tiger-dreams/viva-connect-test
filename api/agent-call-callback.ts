import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Support both GET and POST methods
  if (request.method !== 'GET' && request.method !== 'POST') {
    return response.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Parse callback data (support both GET query params and POST body)
    const data = request.method === 'GET' ? request.query : request.body;

    const {
      sid,
      result,
      fail_reason,
      timestamp,
      ...additionalData
    } = data;

    console.log('[Agent Call Callback] Received callback:', {
      sid,
      result,
      fail_reason,
      timestamp,
      method: request.method
    });

    if (!sid) {
      return response.status(400).json({
        success: false,
        error: 'Missing required field: sid'
      });
    }

    // Determine new status based on result
    const newStatus = result === 'SUCCESS' ? 'ringing' : 'failed';

    // Update agent_call_sessions table
    try {
      const updateResult = await sql`
        UPDATE agent_call_sessions
        SET
          status = ${newStatus},
          data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
            result,
            fail_reason,
            timestamp,
            callback_received_at: Date.now()
          })}::jsonb
        WHERE sid = ${sid}
        RETURNING id
      `;

      if (updateResult.rowCount === 0) {
        console.warn('[Agent Call Callback] No session found with SID:', sid);
      } else {
        console.log('[Agent Call Callback] Updated session status to:', newStatus);
      }
    } catch (dbError: any) {
      console.error('[Agent Call Callback] Database update error:', dbError);
      // Don't fail the callback, just log the error
    }

    // Store event in agent_call_events table
    try {
      await sql`
        INSERT INTO agent_call_events (
          sid,
          event_type,
          status,
          timestamp,
          data
        ) VALUES (
          ${sid},
          'agent_call_status',
          ${result},
          ${timestamp ? parseInt(timestamp.toString()) : Date.now()},
          ${JSON.stringify({
            result,
            fail_reason,
            ...additionalData
          })}
        )
      `;

      console.log('[Agent Call Callback] Event logged successfully');
    } catch (eventError: any) {
      console.error('[Agent Call Callback] Error logging event:', eventError);
      // Don't fail the callback
    }

    // Return success response to PlanetKit
    return response.status(200).json({
      success: true,
      message: 'Callback processed successfully'
    });
  } catch (error: any) {
    console.error('[Agent Call Callback] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
