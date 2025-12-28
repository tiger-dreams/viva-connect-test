import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    console.log('[Init Agent Call DB] Starting database initialization...');

    // Create agent_call_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS agent_call_sessions (
        id SERIAL PRIMARY KEY,
        sid VARCHAR(200) UNIQUE NOT NULL,
        caller_user_id VARCHAR(200) NOT NULL,
        callee_user_id VARCHAR(200) NOT NULL,
        caller_service_id VARCHAR(100),
        callee_service_id VARCHAR(100),
        room_id VARCHAR(200),
        status VARCHAR(50) NOT NULL DEFAULT 'initiated',
        audio_file_ids JSONB,
        language VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        answered_at TIMESTAMP NULL,
        ended_at TIMESTAMP NULL,
        data JSONB
      )
    `;

    console.log('[Init Agent Call DB] Created agent_call_sessions table');

    // Create indexes for agent_call_sessions
    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_sid
      ON agent_call_sessions(sid)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_callee
      ON agent_call_sessions(callee_user_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_status
      ON agent_call_sessions(status)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_created_at
      ON agent_call_sessions(created_at DESC)
    `;

    console.log('[Init Agent Call DB] Created indexes for agent_call_sessions');

    // Create agent_call_events table
    await sql`
      CREATE TABLE IF NOT EXISTS agent_call_events (
        id SERIAL PRIMARY KEY,
        sid VARCHAR(200) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(50),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        data JSONB
      )
    `;

    console.log('[Init Agent Call DB] Created agent_call_events table');

    // Create indexes for agent_call_events
    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_events_sid
      ON agent_call_events(sid)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_events_type
      ON agent_call_events(event_type)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_events_created_at
      ON agent_call_events(created_at DESC)
    `;

    console.log('[Init Agent Call DB] Created indexes for agent_call_events');

    // Add retry-related columns to agent_call_sessions
    try {
      await sql`
        ALTER TABLE agent_call_sessions
        ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS timeout_notification_sent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS parent_sid VARCHAR(200) NULL,
        ADD COLUMN IF NOT EXISTS is_retry BOOLEAN DEFAULT FALSE
      `;
      console.log('[Init Agent Call DB] Added retry columns to agent_call_sessions');
    } catch (alterError: any) {
      console.warn('[Init Agent Call DB] Error adding retry columns (may already exist):', alterError.message);
    }

    // Create indexes for retry columns
    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_timeout_at
      ON agent_call_sessions(timeout_at)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_retry_scheduled
      ON agent_call_sessions(retry_scheduled_at)
      WHERE retry_scheduled_at IS NOT NULL AND status = 'missed'
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_parent_sid
      ON agent_call_sessions(parent_sid)
    `;

    console.log('[Init Agent Call DB] Created retry indexes for agent_call_sessions');

    // Create agent_call_retry_queue table
    await sql`
      CREATE TABLE IF NOT EXISTS agent_call_retry_queue (
        id SERIAL PRIMARY KEY,
        original_sid VARCHAR(200) NOT NULL,
        retry_sid VARCHAR(200) NULL,
        callee_user_id VARCHAR(200) NOT NULL,
        audio_file_ids JSONB NOT NULL,
        language VARCHAR(10) DEFAULT 'ko',
        scheduled_at TIMESTAMP NOT NULL,
        executed_at TIMESTAMP NULL,
        status VARCHAR(50) DEFAULT 'pending',
        retry_attempt INTEGER DEFAULT 1,
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        data JSONB
      )
    `;

    console.log('[Init Agent Call DB] Created agent_call_retry_queue table');

    // Create indexes for agent_call_retry_queue
    await sql`
      CREATE INDEX IF NOT EXISTS idx_retry_queue_scheduled
      ON agent_call_retry_queue(scheduled_at)
      WHERE status = 'pending'
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_retry_queue_original_sid
      ON agent_call_retry_queue(original_sid)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_retry_queue_callee
      ON agent_call_retry_queue(callee_user_id)
    `;

    console.log('[Init Agent Call DB] Created indexes for agent_call_retry_queue');

    return response.status(200).json({
      success: true,
      message: 'Agent Call database initialized successfully',
      tables: ['agent_call_sessions', 'agent_call_events', 'agent_call_retry_queue']
    });
  } catch (error: any) {
    console.error('[Init Agent Call DB] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
