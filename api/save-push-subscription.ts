import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * Save Push Subscription to Database
 * Beta Environment - Desktop Browser Support
 */
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
    const { userId, subscription } = request.body;

    // Validate input
    if (!userId) {
      return response.status(400).json({ error: 'Missing userId' });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return response.status(400).json({ error: 'Invalid subscription object' });
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return response.status(400).json({ error: 'Missing subscription keys' });
    }

    // Get user agent for debugging
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Store subscription in database (upsert)
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

    console.log('[Push Subscription] Saved for user:', userId);
    console.log('[Push Subscription] Endpoint:', subscription.endpoint.substring(0, 50) + '...');

    return response.status(200).json({
      success: true,
      message: 'Push subscription saved successfully',
      userId
    });
  } catch (error: any) {
    console.error('[Push Subscription] Save error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Failed to save push subscription'
    });
  }
}
