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
      cc_call_id,
      event_type,
      userId,
      timestamp,
      sid,
      ...additionalData
    } = data;

    console.log('[1-to-1 Call Callback] Received callback:', {
      cc_call_id,
      event_type,
      userId,
      timestamp,
      sid,
      method: request.method,
      allParams: data
    });

    // Use sid or cc_call_id as identifier
    const callId = cc_call_id || sid;

    if (!callId) {
      console.warn('[1-to-1 Call Callback] No call ID found, but processing anyway');
      // Don't fail, just log and return success for dry run compatibility
      return response.status(200).json({
        success: true,
        message: 'Callback received (no call ID found, dry run?)'
      });
    }

    // Handle different event types
    if (event_type === 'CONNECTED') {
      // Call was answered - update status to 'answered'
      try {
        const updateResult = await sql`
          UPDATE agent_call_sessions
          SET
            status = 'answered',
            answered_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
              connected_at: Date.now(),
              cc_call_id,
              callId
            })}::jsonb
          WHERE room_id = ${callId} OR sid = ${callId}
          RETURNING id, sid
        `;

        if (updateResult.rowCount === 0) {
          console.warn('[1-to-1 Call Callback] No session found for callId:', callId);
        } else {
          console.log('[1-to-1 Call Callback] Updated session status to answered, SID:', updateResult.rows[0]?.sid);
        }
      } catch (dbError: any) {
        console.error('[1-to-1 Call Callback] Database update error:', dbError);
        // Don't fail the callback
      }
    } else if (event_type === 'DISCONNECTED') {
      // Call ended - update status to 'ended'
      try {
        const updateResult = await sql`
          UPDATE agent_call_sessions
          SET
            status = 'ended',
            ended_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
              disconnected_at: Date.now(),
              cc_call_id,
              callId
            })}::jsonb
          WHERE room_id = ${callId} OR sid = ${callId}
          RETURNING id, sid
        `;

        if (updateResult.rowCount === 0) {
          console.warn('[1-to-1 Call Callback] No session found for callId:', callId);
        } else {
          console.log('[1-to-1 Call Callback] Updated session status to ended, SID:', updateResult.rows[0]?.sid);
        }
      } catch (dbError: any) {
        console.error('[1-to-1 Call Callback] Database update error:', dbError);
        // Don't fail the callback
      }
    } else {
      console.log('[1-to-1 Call Callback] Unknown or missing event type:', event_type);
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
          ${callId},
          ${event_type || 'UNKNOWN'},
          ${event_type || 'UNKNOWN'},
          ${timestamp ? parseInt(timestamp.toString()) : Date.now()},
          ${JSON.stringify({
            userId,
            cc_call_id,
            ...additionalData
          })}
        )
      `;

      console.log('[1-to-1 Call Callback] Event logged successfully');
    } catch (eventError: any) {
      console.error('[1-to-1 Call Callback] Error logging event:', eventError);
      // Don't fail the callback
    }

    // Return success response to PlanetKit
    return response.status(200).json({
      success: true,
      message: 'Callback processed successfully'
    });
  } catch (error: any) {
    console.error('[1-to-1 Call Callback] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
