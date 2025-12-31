import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import webpush from 'web-push';

/**
 * Send Web Push Notification for Incoming Call
 * Beta Environment - Desktop Browser Support
 */

// Configure VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@viva-connect-test.vercel.app',
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
} else {
  console.error('[Notify Call] VAPID keys not configured!');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      targetUserId,
      callerId,
      callerName,
      roomId,
      callId = `call-${Date.now()}`
    } = request.body;

    // Validate input
    if (!targetUserId || !callerId || !callerName || !roomId) {
      return response.status(400).json({
        error: 'Missing required fields: targetUserId, callerId, callerName, roomId'
      });
    }

    console.log('[Notify Call] Request:', {
      targetUserId,
      callerId,
      callerName,
      roomId,
      callId
    });

    // Get user's push subscription from database
    const result = await sql`
      SELECT endpoint, p256dh_key, auth_key, user_agent
      FROM push_subscriptions
      WHERE user_id = ${targetUserId}
    `;

    if (result.rows.length === 0) {
      console.warn('[Notify Call] No push subscription found for user:', targetUserId);
      return response.status(404).json({
        success: false,
        error: 'No push subscription found for user'
      });
    }

    const subscriptionData = result.rows[0];

    const pushSubscription = {
      endpoint: subscriptionData.endpoint,
      keys: {
        p256dh: subscriptionData.p256dh_key,
        auth: subscriptionData.auth_key
      }
    };

    // Prepare notification payload
    const payload = JSON.stringify({
      title: '📞 Incoming Call',
      body: `${callerName} is calling you`,
      callId,
      callerId,
      callerName,
      roomId
    });

    console.log('[Notify Call] Sending push notification...');
    console.log('[Notify Call] Payload:', payload);
    console.log('[Notify Call] Endpoint:', pushSubscription.endpoint.substring(0, 50) + '...');

    // Send web push notification
    const pushResult = await webpush.sendNotification(pushSubscription, payload);

    console.log('[Notify Call] Push sent successfully:', {
      statusCode: pushResult.statusCode,
      body: pushResult.body
    });

    // Log notification in database
    await sql`
      INSERT INTO call_notifications (
        call_id,
        caller_user_id,
        callee_user_id,
        room_id,
        status,
        sent_at,
        data
      )
      VALUES (
        ${callId},
        ${callerId},
        ${targetUserId},
        ${roomId},
        'sent',
        NOW(),
        ${JSON.stringify({ callerName, userAgent: subscriptionData.user_agent })}
      )
    `;

    return response.status(200).json({
      success: true,
      message: 'Call notification sent successfully',
      callId,
      targetUserId
    });
  } catch (error: any) {
    console.error('[Notify Call] Error:', error);

    // Handle subscription expiration (410 Gone)
    if (error.statusCode === 410) {
      console.warn('[Notify Call] Subscription expired, removing from database');

      try {
        await sql`
          DELETE FROM push_subscriptions
          WHERE user_id = ${request.body.targetUserId}
        `;

        return response.status(410).json({
          success: false,
          error: 'Push subscription expired',
          removed: true
        });
      } catch (dbError) {
        console.error('[Notify Call] Failed to remove expired subscription:', dbError);
      }
    }

    return response.status(500).json({
      success: false,
      error: error.message || 'Failed to send call notification'
    });
  }
}
