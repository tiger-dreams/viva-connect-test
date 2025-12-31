import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import webpush from 'web-push';

/**
 * Unified Web Push API
 * Handles all Web Push related operations
 *
 * Actions:
 * - GET  ?action=init-db      : Initialize database tables
 * - POST ?action=subscribe    : Save push subscription
 * - POST ?action=notify       : Send push notification
 */

// Configure VAPID keys
if (process.env.VITE_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@viva-connect-test.vercel.app',
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const action = request.query.action as string;

  if (!action) {
    return response.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    switch (action) {
      case 'init-db':
        return await handleInitDatabase(request, response);
      case 'subscribe':
        return await handleSubscribe(request, response);
      case 'notify':
        return await handleNotify(request, response);
      default:
        return response.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[Web Push] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Initialize Database Tables
 * GET /api/web-push?action=init-db
 */
async function handleInitDatabase(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Web Push] Initializing database tables...');

  // Create push_subscriptions table
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(200) UNIQUE NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created
    ON push_subscriptions(created_at DESC)
  `;

  // Create call_notifications table
  await sql`
    CREATE TABLE IF NOT EXISTS call_notifications (
      id SERIAL PRIMARY KEY,
      call_id VARCHAR(200) UNIQUE NOT NULL,
      caller_user_id VARCHAR(200) NOT NULL,
      callee_user_id VARCHAR(200) NOT NULL,
      room_id VARCHAR(200),
      status VARCHAR(50) DEFAULT 'sent',
      sent_at TIMESTAMP DEFAULT NOW(),
      responded_at TIMESTAMP NULL,
      response VARCHAR(50),
      data JSONB
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_call_notifications_call
    ON call_notifications(call_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_call_notifications_caller
    ON call_notifications(caller_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_call_notifications_callee
    ON call_notifications(callee_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_call_notifications_sent
    ON call_notifications(sent_at DESC)
  `;

  // Get table counts
  const subsCount = await sql`SELECT COUNT(*) FROM push_subscriptions`;
  const callsCount = await sql`SELECT COUNT(*) FROM call_notifications`;

  console.log('[Web Push] Database initialized successfully');

  return response.status(200).json({
    success: true,
    message: 'Web Push database tables initialized',
    tables: {
      push_subscriptions: {
        created: true,
        count: parseInt(subsCount.rows[0].count)
      },
      call_notifications: {
        created: true,
        count: parseInt(callsCount.rows[0].count)
      }
    }
  });
}

/**
 * Save Push Subscription
 * POST /api/web-push?action=subscribe
 */
async function handleSubscribe(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, subscription } = request.body;

  if (!userId) {
    return response.status(400).json({ error: 'Missing userId' });
  }

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return response.status(400).json({ error: 'Invalid subscription object' });
  }

  if (!subscription.keys.p256dh || !subscription.keys.auth) {
    return response.status(400).json({ error: 'Missing subscription keys' });
  }

  const userAgent = request.headers['user-agent'] || 'unknown';

  await sql`
    INSERT INTO push_subscriptions (
      user_id,
      endpoint,
      p256dh_key,
      auth_key,
      user_agent,
      created_at,
      updated_at
    )
    VALUES (
      ${userId},
      ${subscription.endpoint},
      ${subscription.keys.p256dh},
      ${subscription.keys.auth},
      ${userAgent},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      endpoint = ${subscription.endpoint},
      p256dh_key = ${subscription.keys.p256dh},
      auth_key = ${subscription.keys.auth},
      user_agent = ${userAgent},
      updated_at = NOW()
  `;

  console.log('[Web Push] Subscription saved for user:', userId);

  return response.status(200).json({
    success: true,
    message: 'Push subscription saved successfully',
    userId
  });
}

/**
 * Send Push Notification
 * POST /api/web-push?action=notify
 */
async function handleNotify(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const {
    targetUserId,
    callerId,
    callerName,
    roomId,
    callId = `call-${Date.now()}`
  } = request.body;

  if (!targetUserId || !callerId || !callerName || !roomId) {
    return response.status(400).json({
      error: 'Missing required fields: targetUserId, callerId, callerName, roomId'
    });
  }

  console.log('[Web Push] Sending notification:', {
    targetUserId,
    callerId,
    callerName,
    roomId,
    callId
  });

  // Get user's push subscription
  const result = await sql`
    SELECT endpoint, p256dh_key, auth_key, user_agent
    FROM push_subscriptions
    WHERE user_id = ${targetUserId}
  `;

  if (result.rows.length === 0) {
    console.warn('[Web Push] No subscription found for user:', targetUserId);
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

  const payload = JSON.stringify({
    title: '📞 Incoming Call',
    body: `${callerName} is calling you`,
    callId,
    callerId,
    callerName,
    roomId
  });

  try {
    const pushResult = await webpush.sendNotification(pushSubscription, payload);

    console.log('[Web Push] Notification sent:', {
      statusCode: pushResult.statusCode,
      targetUserId
    });

    // Log notification
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
    // Handle subscription expiration
    if (error.statusCode === 410) {
      console.warn('[Web Push] Subscription expired, removing from database');

      await sql`
        DELETE FROM push_subscriptions
        WHERE user_id = ${targetUserId}
      `;

      return response.status(410).json({
        success: false,
        error: 'Push subscription expired',
        removed: true
      });
    }

    throw error;
  }
}
