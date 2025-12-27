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
      error: 'Method not allowed. Use GET.'
    });
  }

  try {
    // Parse query parameters
    const {
      sid,
      from_service_id,
      from_user_id,
      to_service_id,
      to_user_id,
      type,
      param, // This is cc_param! (base64 encoded)
      stid,
      app_svr_data
    } = request.query;

    console.log('[Notify Callback] Received notify callback:', {
      sid,
      from_service_id,
      from_user_id,
      to_service_id,
      to_user_id,
      type,
      param: param ? `${String(param).substring(0, 20)}...` : null,
      stid,
      app_svr_data,
      fullQuery: request.query
    });

    if (!sid || !param) {
      console.error('[Notify Callback] Missing required fields:', { sid, hasParam: !!param });
      return response.status(400).json({
        success: false,
        error: 'Missing required fields: sid, param'
      });
    }

    // Store cc_param in database
    try {
      await sql`
        UPDATE agent_call_sessions
        SET
          data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
            cc_param: param,
            from_service_id,
            from_user_id,
            to_service_id,
            to_user_id,
            call_type: type,
            notify_received_at: Date.now()
          })}::jsonb
        WHERE sid = ${sid}
      `;

      console.log('[Notify Callback] Updated session with cc_param for SID:', sid);
    } catch (dbError: any) {
      console.error('[Notify Callback] Database update error:', dbError);
      // Don't fail the callback - we'll still try to send LINE message
    }

    // Send LINE message with cc_param
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;
    const liffId = process.env.VITE_LIFF_ID;

    if (!liffId) {
      console.warn('[Notify Callback] LIFF ID not configured, cannot send LINE message');
      // Still return 200 to PlanetKit
      return response.status(200).json({
        success: true,
        message: 'Notify callback received but LINE message not sent (LIFF ID missing)'
      });
    }

    // Build deeplink with cc_param
    const deepLink = `https://liff.line.me/${liffId}?room=${encodeURIComponent(String(sid))}&mode=agent-call&sid=${encodeURIComponent(String(sid))}&cc_param=${encodeURIComponent(String(param))}`;

    const message = type === 'V'
      ? `📹 비디오 통화가 왔습니다!\n\n아래 링크를 눌러 수락하세요:\n${deepLink}`
      : `📞 전화가 왔습니다!\n\n아래 링크를 눌러 수락하세요:\n${deepLink}`;

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

      // Send LINE push message
      const lineApiResponse = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          to: to_user_id,
          messages: [
            {
              type: 'text',
              text: message,
            },
          ],
        }),
      });

      if (!lineApiResponse.ok) {
        const errorText = await lineApiResponse.text();
        console.error('[Notify Callback] Failed to send LINE message:', errorText);
        // Still return 200 to PlanetKit - we received the notify
        return response.status(200).json({
          success: true,
          message: 'Notify callback received but LINE message failed'
        });
      }

      console.log('[Notify Callback] LINE message sent successfully with cc_param');

      return response.status(200).json({
        success: true,
        message: 'Notify callback processed and LINE message sent'
      });
    } catch (lineError: any) {
      console.error('[Notify Callback] Error sending LINE message:', lineError);
      // Still return 200 to PlanetKit
      return response.status(200).json({
        success: true,
        message: `Notify callback received but LINE message failed: ${lineError.message}`
      });
    }
  } catch (error: any) {
    console.error('[Notify Callback] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
