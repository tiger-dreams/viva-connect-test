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

  console.log('[Execute Retries] Starting retry execution...');

  try {
    // Get pending retries that are ready to execute
    const retriesResult = await sql`
      SELECT
        id,
        original_sid,
        retry_sid,
        callee_user_id,
        audio_file_ids,
        language,
        scheduled_at,
        retry_attempt,
        data
      FROM agent_call_retry_queue
      WHERE status = 'pending'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 10
    `;

    console.log(`[Execute Retries] Found ${retriesResult.rowCount} pending retries`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [] as any[]
    };

    for (const retry of retriesResult.rows) {
      results.processed++;

      try {
        console.log(`[Execute Retries] Processing retry ${retry.id} for user ${retry.callee_user_id}`);

        // Check if user is currently in an active call
        const activeCallResult = await sql`
          SELECT sid, status
          FROM agent_call_sessions
          WHERE callee_user_id = ${retry.callee_user_id}
            AND status IN ('ringing', 'answered', 'initiated')
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (activeCallResult.rowCount > 0) {
          console.log(`[Execute Retries] User ${retry.callee_user_id} is in active call, skipping`);
          results.skipped++;

          // Don't mark as failed, leave as pending for next run
          continue;
        }

        // Initiate agent call
        const baseUrl = request.headers.origin || `https://${request.headers.host}`;
        const initiateUrl = `${baseUrl}/api/agent-call-initiate`;

        const initiateResponse = await fetch(initiateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calleeUserId: retry.callee_user_id,
            audioFileIds: retry.audio_file_ids,
            language: retry.language || 'ko',
            isRetry: true,
            parentSid: retry.original_sid,
            retryAttempt: retry.retry_attempt
          }),
        });

        if (!initiateResponse.ok) {
          const errorText = await initiateResponse.text();
          throw new Error(`Failed to initiate call: ${initiateResponse.status} ${errorText}`);
        }

        const initiateData = await initiateResponse.json();
        const newSid = initiateData.sid;

        console.log(`[Execute Retries] Successfully initiated retry call, new SID: ${newSid}`);

        // Mark retry as completed
        await sql`
          UPDATE agent_call_retry_queue
          SET
            status = 'completed',
            retry_sid = ${newSid},
            executed_at = NOW()
          WHERE id = ${retry.id}
        `;

        // Update original session's retry count
        await sql`
          UPDATE agent_call_sessions
          SET
            retry_count = retry_count + 1
          WHERE sid = ${retry.original_sid}
        `;

        results.succeeded++;
        console.log(`[Execute Retries] Retry ${retry.id} completed successfully`);

      } catch (retryError: any) {
        console.error(`[Execute Retries] Error processing retry ${retry.id}:`, retryError);

        // Mark retry as failed
        await sql`
          UPDATE agent_call_retry_queue
          SET
            status = 'failed',
            executed_at = NOW(),
            error_message = ${retryError.message || 'Unknown error'}
          WHERE id = ${retry.id}
        `;

        results.failed++;
        results.errors.push({
          retryId: retry.id,
          error: retryError.message
        });
      }
    }

    console.log('[Execute Retries] Execution complete:', results);

    return response.status(200).json({
      success: true,
      message: 'Retry execution completed',
      results
    });

  } catch (error: any) {
    console.error('[Execute Retries] Fatal error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
