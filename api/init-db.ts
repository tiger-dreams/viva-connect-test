import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create planetkit_events table
    await sql`
      CREATE TABLE IF NOT EXISTS planetkit_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        service_id VARCHAR(100),
        room_id VARCHAR(200),
        user_id VARCHAR(200),
        display_name VARCHAR(200),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        data JSONB
      )
    `;

    // Create indexes for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_planetkit_events_room_id
      ON planetkit_events(room_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_planetkit_events_created_at
      ON planetkit_events(created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_planetkit_events_event_type
      ON planetkit_events(event_type)
    `;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database initialized successfully',
        table: 'planetkit_events',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to initialize database',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
