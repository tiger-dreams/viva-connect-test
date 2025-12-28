import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { Client } from '@upstash/qstash';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { sid, userId } = request.body;

    if (!sid) {
      return response.status(400).json({
        success: false,
        error: 'Missing required field: sid'
      });
    }

    console.log('[Schedule Retry] Request:', { sid, userId });

    // Get original call session
    const sessionResult = await sql`
      SELECT
        sid,
        caller_user_id,
        callee_user_id,
        audio_file_ids,
        language,
        retry_count,
        status
      FROM agent_call_sessions
      WHERE sid = ${sid}
    `;

    if (sessionResult.rowCount === 0) {
      return response.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessionResult.rows[0];

    // Check if user matches (security)
    if (userId && userId !== session.callee_user_id) {
      return response.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check retry limit (max 3 retries)
    if (session.retry_count >= 3) {
      return response.status(400).json({
        success: false,
        error: 'Maximum retry attempts reached',
        message: '최대 재시도 횟수에 도달했습니다.'
      });
    }

    // Check if retry already scheduled for this call
    const existingRetryResult = await sql`
      SELECT id, scheduled_at, status
      FROM agent_call_retry_queue
      WHERE original_sid = ${sid}
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingRetryResult.rowCount > 0) {
      const existingRetry = existingRetryResult.rows[0];
      const scheduledAt = new Date(existingRetry.scheduled_at);

      return response.status(200).json({
        success: true,
        alreadyScheduled: true,
        message: '이미 재시도가 예약되어 있습니다.',
        scheduledAt: scheduledAt.toISOString()
      });
    }

    // Calculate scheduled time (5 minutes from now)
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);

    // Insert into retry queue
    const retryResult = await sql`
      INSERT INTO agent_call_retry_queue (
        original_sid,
        callee_user_id,
        audio_file_ids,
        language,
        scheduled_at,
        status,
        retry_attempt,
        data
      ) VALUES (
        ${sid},
        ${session.callee_user_id},
        ${JSON.stringify(session.audio_file_ids)},
        ${session.language || 'ko'},
        ${scheduledAt.toISOString()},
        'pending',
        ${session.retry_count + 1},
        ${JSON.stringify({
          caller_user_id: session.caller_user_id,
          scheduled_by: 'user'
        })}
      )
      RETURNING id, scheduled_at
    `;

    const retry = retryResult.rows[0];

    // Update original session
    await sql`
      UPDATE agent_call_sessions
      SET
        status = 'retry_scheduled',
        retry_scheduled_at = ${scheduledAt.toISOString()},
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
          retry_queue_id: retry.id,
          retry_scheduled_at: scheduledAt.toISOString()
        })}::jsonb
      WHERE sid = ${sid}
    `;

    console.log('[Schedule Retry] Retry scheduled:', {
      queueId: retry.id,
      scheduledAt: scheduledAt.toISOString()
    });

    // Schedule delayed retry execution using Upstash QStash
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;

    try {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        const qstash = new Client({ token: qstashToken });

        // Schedule the retry call to execute in 5 minutes
        await qstash.publishJSON({
          url: `${baseUrl}/api/execute-retry`,
          body: {
            queueId: retry.id,
            originalSid: sid,
            calleeUserId: session.callee_user_id,
            audioFileIds: session.audio_file_ids,
            language: session.language || 'ko',
            retryAttempt: session.retry_count + 1
          },
          delay: 300 // 5 minutes in seconds
        });

        console.log('[Schedule Retry] QStash scheduled successfully');
      } else {
        console.warn('[Schedule Retry] QSTASH_TOKEN not configured, skipping automatic execution');
      }
    } catch (qstashError: any) {
      console.error('[Schedule Retry] Failed to schedule QStash:', qstashError);
      // Don't fail the API call, just log
    }

    // Send confirmation message to user
    try {
      await sendScheduleConfirmationMessage({
        calleeUserId: session.callee_user_id,
        scheduledAt: scheduledAt,
        language: session.language || 'ko',
        baseUrl
      });
    } catch (msgError: any) {
      console.error('[Schedule Retry] Failed to send confirmation message:', msgError);
      // Don't fail the API call, just log
    }

    return response.status(200).json({
      success: true,
      queueId: retry.id,
      scheduledAt: scheduledAt.toISOString(),
      message: '5분 후 다시 전화를 드리겠습니다.'
    });
  } catch (error: any) {
    console.error('[Schedule Retry] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Helper function to send confirmation message
async function sendScheduleConfirmationMessage(params: {
  calleeUserId: string;
  scheduledAt: Date;
  language: string;
  baseUrl: string;
}) {
  const { calleeUserId, scheduledAt, language, baseUrl } = params;

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

    // Format scheduled time for display (HH:MM)
    const timeString = scheduledAt.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Message text
    const messageText = language === 'ko'
      ? `✅ 재시도가 예약되었습니다.\n\n${timeString}에 통화 요청이 도착합니다.\n잠시만 기다려주세요.`
      : `✅ Retry scheduled.\n\nYou will receive a call at ${timeString}.\nPlease wait.`;

    // Send LINE push message
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
            type: 'text',
            text: messageText
          }
        ],
      }),
    });

    if (!lineApiResponse.ok) {
      const errorText = await lineApiResponse.text();
      console.error('[Schedule Confirmation] Failed to send LINE message:', errorText);
      throw new Error(`LINE API error: ${errorText}`);
    }

    console.log('[Schedule Confirmation] Confirmation message sent successfully');
  } catch (error: any) {
    console.error('[Schedule Confirmation] Error:', error);
    throw error;
  }
}
