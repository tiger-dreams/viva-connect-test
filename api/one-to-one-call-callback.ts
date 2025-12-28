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
      rel_code_str,        // Timeout detection (NO_ANSWER)
      disconnect_reason,   // Timeout detection (1203)
      ...additionalData
    } = data;

    console.log('[1-to-1 Call Callback] Received callback:', {
      cc_call_id,
      event_type,
      userId,
      timestamp,
      sid,
      rel_code_str,
      disconnect_reason,
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

    // Check for timeout (rel_code_str === 'NO_ANSWER' OR disconnect_reason === '1203')
    if (rel_code_str === 'NO_ANSWER' || disconnect_reason === '1203' || disconnect_reason === 1203) {
      console.log('[1-to-1 Call Callback] Timeout detected (NO_ANSWER/1203)');

      try {
        // Get session data first (include 'failed' status for race condition)
        const sessionResult = await sql`
          SELECT sid, callee_user_id, audio_file_ids, language, status
          FROM agent_call_sessions
          WHERE (room_id = ${callId} OR sid = ${callId})
            AND status IN ('ringing', 'initiated', 'failed')
          LIMIT 1
        `;

        if (sessionResult.rowCount === 0) {
          console.warn('[1-to-1 Call Callback] Session not found for timeout:', callId);
        } else {
          const session = sessionResult.rows[0];

          // Update to missed status
          const updateResult = await sql`
            UPDATE agent_call_sessions
            SET
              status = 'missed',
              timeout_at = NOW(),
              ended_at = NOW(),
              data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
                timeout_detected_at: Date.now(),
                rel_code_str,
                disconnect_reason,
                timeout_source: 'planetkit_callback'
              })}::jsonb
            WHERE sid = ${session.sid}
              AND timeout_notification_sent = FALSE
            RETURNING id
          `;

          // Send LINE notification if update was successful (not already sent)
          if (updateResult.rowCount > 0) {
            const baseUrl = request.headers.origin || `https://${request.headers.host}`;
            await sendTimeoutNotification({
              sid: session.sid,
              calleeUserId: session.callee_user_id,
              audioFileIds: session.audio_file_ids,
              language: session.language || 'ko',
              baseUrl
            });

            // Mark notification as sent
            await sql`
              UPDATE agent_call_sessions
              SET timeout_notification_sent = TRUE
              WHERE sid = ${session.sid}
            `;

            console.log('[1-to-1 Call Callback] Timeout notification sent for SID:', session.sid);
          } else {
            console.log('[1-to-1 Call Callback] Notification already sent for SID:', session.sid);
          }
        }
      } catch (timeoutError: any) {
        console.error('[1-to-1 Call Callback] Error handling timeout:', timeoutError);
        // Don't fail the callback
      }

      // Store timeout event
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
            'TIMEOUT',
            'NO_ANSWER',
            ${timestamp ? parseInt(timestamp.toString()) : Date.now()},
            ${JSON.stringify({
              userId,
              cc_call_id,
              rel_code_str,
              disconnect_reason,
              ...additionalData
            })}
          )
        `;
        console.log('[1-to-1 Call Callback] Timeout event logged');
      } catch (eventError: any) {
        console.error('[1-to-1 Call Callback] Error logging timeout event:', eventError);
      }

      return response.status(200).json({
        success: true,
        message: 'Timeout processed successfully'
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

// Helper function to send timeout notification via LINE
async function sendTimeoutNotification(params: {
  sid: string;
  calleeUserId: string;
  audioFileIds: any;
  language: string;
  baseUrl: string;
}) {
  const { sid, calleeUserId, language, baseUrl } = params;

  const liffId = process.env.VITE_LIFF_ID;
  if (!liffId) {
    console.warn('[Timeout Notification] LIFF ID not configured');
    return;
  }

  try {
    // Get LINE Channel Access Token
    const tokenUrl = `${baseUrl}/api/get-line-token`;
    const tokenResponse = await fetch(tokenUrl);

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get LINE token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const channelAccessToken = tokenData.access_token;

    if (!channelAccessToken) {
      throw new Error('Invalid token response');
    }

    // Build retry schedule URL (calls LIFF app)
    const scheduleRetryUrl = `https://liff.line.me/${liffId}/schedule-retry?sid=${encodeURIComponent(sid)}`;

    // Message text (Korean or English)
    const messageText = language === 'ko'
      ? '통화 수락 대기가 종료되었습니다. 5분 후 다시 전화를 받으실 수 있습니다.'
      : 'Call acceptance timeout. You can receive a call again in 5 minutes.';

    const buttonRetryLabel = language === 'ko' ? '5분 후 다시 받기' : 'Retry in 5 min';

    // Send LINE push message with Button Template (single action)
    const lineApiResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: calleeUserId,
        messages: [
          {
            type: 'template',
            altText: messageText,
            template: {
              type: 'buttons',
              text: messageText,
              actions: [
                {
                  type: 'uri',
                  label: buttonRetryLabel,
                  uri: scheduleRetryUrl
                }
              ]
            }
          }
        ],
      }),
    });

    if (!lineApiResponse.ok) {
      const errorText = await lineApiResponse.text();
      console.error('[Timeout Notification] Failed to send LINE message:', errorText);
      throw new Error(`LINE API error: ${errorText}`);
    }

    console.log('[Timeout Notification] LINE message sent successfully');
  } catch (error: any) {
    console.error('[Timeout Notification] Error sending LINE message:', error);
    throw error;
  }
}
