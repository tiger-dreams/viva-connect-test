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

    // Get session language and store cc_param in database
    let sessionLanguage = 'en'; // Default to English for international users
    try {
      // First, get the language from the session
      const sessionResult = await sql`
        SELECT language FROM agent_call_sessions WHERE sid = ${sid}
      `;

      if (sessionResult.rowCount > 0 && sessionResult.rows[0].language) {
        sessionLanguage = sessionResult.rows[0].language;
      }

      // Then update with cc_param
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

      console.log('[Notify Callback] Updated session with cc_param for SID:', sid, 'language:', sessionLanguage);
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

    // Build deeplink with cc_param and autoAccept flag
    const deepLink = `https://liff.line.me/${liffId}/agent-call-meeting?sid=${encodeURIComponent(String(sid))}&cc_param=${encodeURIComponent(String(param))}&autoAccept=true`;

    // Multi-language support based on session language (default: English for international users)
    const isKorean = sessionLanguage === 'ko';
    const messageText = isKorean
      ? `📞 전화가 왔습니다!\n\n60초 이내에 수락해주세요.`
      : `📞 Incoming call!\n\nPlease accept within 60 seconds.`;

    const buttonText = isKorean ? '전화 받기' : 'Accept Call';

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

      // Send LINE push message with Button Template (clicky-able link)
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
              type: 'template',
              altText: messageText,
              template: {
                type: 'buttons',
                text: messageText,
                actions: [
                  {
                    type: 'uri',
                    label: buttonText,
                    uri: deepLink
                  }
                ]
              }
            }
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
