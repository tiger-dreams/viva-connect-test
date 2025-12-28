import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Verify cron secret for security
  const cronSecret = request.headers['x-vercel-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    return response.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  console.log('[Check Timeouts] Starting backup timeout check...');

  try {
    // Find stale ringing calls (>65 seconds old) that haven't been marked as timed out
    // 65 seconds = 60 second timeout + 5 second buffer
    const timeoutThreshold = new Date(Date.now() - 65 * 1000);

    const staleCallsResult = await sql`
      SELECT
        sid,
        callee_user_id,
        audio_file_ids,
        language,
        created_at,
        status
      FROM agent_call_sessions
      WHERE status IN ('ringing', 'initiated')
        AND created_at < ${timeoutThreshold.toISOString()}
        AND timeout_notification_sent = FALSE
      ORDER BY created_at ASC
      LIMIT 20
    `;

    console.log(`[Check Timeouts] Found ${staleCallsResult.rowCount} stale calls`);

    const results = {
      processed: 0,
      notified: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const call of staleCallsResult.rows) {
      results.processed++;

      try {
        console.log(`[Check Timeouts] Processing stale call ${call.sid}, age: ${Date.now() - new Date(call.created_at).getTime()}ms`);

        // Update to missed status
        const updateResult = await sql`
          UPDATE agent_call_sessions
          SET
            status = 'missed',
            timeout_at = NOW(),
            ended_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
              timeout_detected_at: Date.now(),
              timeout_source: 'cron_backup',
              original_status: call.status
            })}::jsonb
          WHERE sid = ${call.sid}
            AND timeout_notification_sent = FALSE
          RETURNING id
        `;

        // Only send notification if update was successful (not already sent)
        if (updateResult.rowCount > 0) {
          const baseUrl = request.headers.origin || `https://${request.headers.host}`;

          // Send timeout notification
          await sendTimeoutNotification({
            sid: call.sid,
            calleeUserId: call.callee_user_id,
            audioFileIds: call.audio_file_ids,
            language: call.language || 'ko',
            baseUrl
          });

          // Mark notification as sent
          await sql`
            UPDATE agent_call_sessions
            SET timeout_notification_sent = TRUE
            WHERE sid = ${call.sid}
          `;

          // Log event
          await sql`
            INSERT INTO agent_call_events (
              sid,
              event_type,
              status,
              timestamp,
              data
            ) VALUES (
              ${call.sid},
              'TIMEOUT',
              'BACKUP_CHECK',
              ${Date.now()},
              ${JSON.stringify({
                timeout_source: 'cron_backup',
                original_status: call.status,
                call_age_ms: Date.now() - new Date(call.created_at).getTime()
              })}
            )
          `;

          results.notified++;
          console.log(`[Check Timeouts] Sent timeout notification for ${call.sid}`);
        } else {
          console.log(`[Check Timeouts] Notification already sent for ${call.sid}`);
        }

      } catch (callError: any) {
        console.error(`[Check Timeouts] Error processing call ${call.sid}:`, callError);
        results.failed++;
        results.errors.push({
          sid: call.sid,
          error: callError.message
        });
      }
    }

    console.log('[Check Timeouts] Check complete:', results);

    return response.status(200).json({
      success: true,
      message: 'Timeout check completed',
      results
    });

  } catch (error: any) {
    console.error('[Check Timeouts] Fatal error:', error);
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
    console.warn('[Check Timeouts] LIFF ID not configured');
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

    const buttonConfirmLabel = language === 'ko' ? '확인' : 'OK';
    const buttonRetryLabel = language === 'ko' ? '5분 후 다시 받기' : 'Retry in 5 min';

    // Send LINE push message with Button Template
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
                  label: buttonConfirmLabel,
                  uri: 'https://line.me/R/' // Just closes the message
                },
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
      console.error('[Check Timeouts] Failed to send LINE message:', errorText);
      throw new Error(`LINE API error: ${errorText}`);
    }

    console.log('[Check Timeouts] LINE message sent successfully');
  } catch (error: any) {
    console.error('[Check Timeouts] Error sending LINE message:', error);
    throw error;
  }
}
