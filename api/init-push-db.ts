import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * Initialize Database Tables for Web Push Notifications
 * Beta Environment - Desktop Browser Support
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Push DB Init] Creating tables...');

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

    console.log('[Push DB Init] Created push_subscriptions table');

    // Create indexes for push_subscriptions
    await sql`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
      ON push_subscriptions(user_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created
      ON push_subscriptions(created_at DESC)
    `;

    console.log('[Push DB Init] Created indexes for push_subscriptions');

    // Create call_notifications table (for tracking sent notifications)
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

    console.log('[Push DB Init] Created call_notifications table');

    // Create indexes for call_notifications
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

    console.log('[Push DB Init] Created indexes for call_notifications');

    // Get table counts
    const subsCount = await sql`SELECT COUNT(*) FROM push_subscriptions`;
    const callsCount = await sql`SELECT COUNT(*) FROM call_notifications`;

    console.log('[Push DB Init] Tables initialized successfully');

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
  } catch (error: any) {
    console.error('[Push DB Init] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize database tables'
    });
  }
}
