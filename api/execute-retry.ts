import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

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
    const {
      queueId,
      originalSid,
      calleeUserId,
      audioFileIds,
      language,
      retryAttempt
    } = request.body;

    console.log('[Execute Retry] Processing retry:', {
      queueId,
      originalSid,
      calleeUserId,
      retryAttempt
    });

    // Check if retry is still pending
    const retryCheck = await sql`
      SELECT status
      FROM agent_call_retry_queue
      WHERE id = ${queueId}
    `;

    if (retryCheck.rowCount === 0) {
      console.warn('[Execute Retry] Retry not found:', queueId);
      return response.status(404).json({
        success: false,
        error: 'Retry not found'
      });
    }

    if (retryCheck.rows[0].status !== 'pending') {
      console.log('[Execute Retry] Retry already processed:', retryCheck.rows[0].status);
      return response.status(200).json({
        success: true,
        message: 'Retry already processed'
      });
    }

    // Check if user is currently in an active call
    const activeCallResult = await sql`
      SELECT sid, status
      FROM agent_call_sessions
      WHERE callee_user_id = ${calleeUserId}
        AND status IN ('ringing', 'answered', 'initiated')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (activeCallResult.rowCount > 0) {
      console.log(`[Execute Retry] User ${calleeUserId} is in active call, skipping`);

      // Mark as failed (user busy)
      await sql`
        UPDATE agent_call_retry_queue
        SET
          status = 'failed',
          executed_at = NOW(),
          error_message = 'User in active call'
        WHERE id = ${queueId}
      `;

      return response.status(200).json({
        success: false,
        message: 'User is currently in an active call'
      });
    }

    // Get service ID from original session
    const origSessionResult = await sql`
      SELECT caller_service_id, callee_service_id
      FROM agent_call_sessions
      WHERE sid = ${originalSid}
      LIMIT 1
    `;

    const serviceId = origSessionResult.rows[0]?.callee_service_id || process.env.VITE_PLANETKIT_EVAL_SERVICE_ID;

    // Initiate agent call
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;
    const initiateUrl = `${baseUrl}/api/agent-call-initiate`;

    const initiateResponse = await fetch(initiateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toUserId: calleeUserId,
        toServiceId: serviceId,
        callerUserId: 'AGENT',
        callerServiceId: serviceId,
        audioFileIds: audioFileIds,
        language: language || 'ko',
        isRetry: true,
        parentSid: originalSid,
        retryAttempt: retryAttempt
      }),
    });

    if (!initiateResponse.ok) {
      const errorText = await initiateResponse.text();
      throw new Error(`Failed to initiate call: ${initiateResponse.status} ${errorText}`);
    }

    const initiateData = await initiateResponse.json();
    const newSid = initiateData.sid;

    console.log(`[Execute Retry] Successfully initiated retry call, new SID: ${newSid}`);

    // Mark retry as completed
    await sql`
      UPDATE agent_call_retry_queue
      SET
        status = 'completed',
        retry_sid = ${newSid},
        executed_at = NOW()
      WHERE id = ${queueId}
    `;

    // Update original session's retry count
    await sql`
      UPDATE agent_call_sessions
      SET
        retry_count = retry_count + 1
      WHERE sid = ${originalSid}
    `;

    return response.status(200).json({
      success: true,
      message: 'Retry executed successfully',
      newSid
    });

  } catch (error: any) {
    console.error('[Execute Retry] Error:', error);

    // Try to mark retry as failed
    try {
      const { queueId } = request.body;
      if (queueId) {
        await sql`
          UPDATE agent_call_retry_queue
          SET
            status = 'failed',
            executed_at = NOW(),
            error_message = ${error.message || 'Unknown error'}
          WHERE id = ${queueId}
        `;
      }
    } catch (dbError) {
      console.error('[Execute Retry] Failed to update retry status:', dbError);
    }

    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
