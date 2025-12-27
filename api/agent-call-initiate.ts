import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface AgentCallInitiateRequest {
  toUserId: string;
  toServiceId: string;
  callerUserId: string;
  callerServiceId: string;
  audioFileIds: string[];
  language?: 'ko' | 'en';
}

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
    const body: AgentCallInitiateRequest = request.body;
    const {
      toUserId,
      toServiceId,
      callerUserId,
      callerServiceId,
      audioFileIds,
      language = 'ko'
    } = body;

    console.log('[Agent Call Initiate] Request:', {
      toUserId,
      toServiceId,
      callerUserId,
      audioFileIds,
      language
    });

    // Validation
    if (!toUserId || !toServiceId) {
      return response.status(400).json({
        success: false,
        error: 'Missing required fields: toUserId, toServiceId'
      });
    }

    // Check if Mock Mode is enabled
    const MOCK_MODE = process.env.PLANETKIT_AGENT_CALL_MOCK_MODE === 'true';

    let sid: string;
    let planetKitResponse: any = null;

    if (MOCK_MODE) {
      // Mock Mode: Generate mock SID without calling actual API
      sid = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log('[Agent Call Initiate] MOCK MODE: Generated mock SID:', sid);
    } else {
      // Real Mode: Call PlanetKit Agent Call API
      const baseUrl = process.env.PLANETKIT_AGENT_CALL_BASE_URL || 'https://vpnx-stn-api.line-apps-rc.com';
      const apiKey = process.env.VITE_PLANETKIT_EVAL_API_KEY;
      const apiSecret = process.env.VITE_PLANETKIT_EVAL_API_SECRET;

      if (!apiKey || !apiSecret) {
        return response.status(500).json({
          success: false,
          error: 'PlanetKit API credentials not configured'
        });
      }

      // Build PlanetKit API URL
      const apiUrl = `${baseUrl}/tas/v2/agt_call/audio_caller/${toServiceId}/${toUserId}`;

      // Basic Authentication: base64(API_KEY + ":" + API_SECRET)
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      // Build request body
      const planetKitBody = {
        requestContext: {
          userId: callerUserId,
          serviceId: callerServiceId
        },
        mediaSourceType: 'STORED_SOURCE',
        storedSource: {
          storedAudioSources: audioFileIds.map(contentId => ({
            contentId
          })),
          playWaitTime: 1000,
          playCount: 2
        },
        recordOnCloud: false,
        useResponderPreparation: false
      };

      console.log('[Agent Call Initiate] Calling PlanetKit API:', apiUrl);
      console.log('[Agent Call Initiate] Request body:', JSON.stringify(planetKitBody, null, 2));

      try {
        const planetKitRes = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(planetKitBody)
        });

        if (!planetKitRes.ok) {
          const errorText = await planetKitRes.text();
          console.error('[Agent Call Initiate] PlanetKit API error:', planetKitRes.status, errorText);
          return response.status(planetKitRes.status).json({
            success: false,
            error: `PlanetKit API error: ${planetKitRes.status} ${errorText}`
          });
        }

        planetKitResponse = await planetKitRes.json();
        sid = planetKitResponse.sid || planetKitResponse.data?.sid;

        if (!sid) {
          console.error('[Agent Call Initiate] No SID in PlanetKit response:', planetKitResponse);
          return response.status(500).json({
            success: false,
            error: 'No SID returned from PlanetKit API'
          });
        }

        console.log('[Agent Call Initiate] PlanetKit API success, SID:', sid);
      } catch (fetchError: any) {
        console.error('[Agent Call Initiate] Error calling PlanetKit API:', fetchError);
        return response.status(500).json({
          success: false,
          error: `Failed to call PlanetKit API: ${fetchError.message}`
        });
      }
    }

    // Store session in database (use sid as room_id for Agent Call)
    try {
      await sql`
        INSERT INTO agent_call_sessions (
          sid,
          caller_user_id,
          callee_user_id,
          caller_service_id,
          callee_service_id,
          room_id,
          status,
          audio_file_ids,
          language,
          data
        ) VALUES (
          ${sid},
          ${callerUserId},
          ${toUserId},
          ${callerServiceId},
          ${toServiceId},
          ${sid},
          'initiated',
          ${JSON.stringify(audioFileIds)},
          ${language},
          ${JSON.stringify({ mock: MOCK_MODE, planetKitResponse })}
        )
      `;

      console.log('[Agent Call Initiate] Session stored in database');
    } catch (dbError: any) {
      console.error('[Agent Call Initiate] Database error:', dbError);
      return response.status(500).json({
        success: false,
        error: `Failed to store session: ${dbError.message}`
      });
    }

    // Send LINE message with deep link (use sid as room parameter)
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;
    const liffId = process.env.VITE_LIFF_ID;

    if (!liffId) {
      console.warn('[Agent Call Initiate] LIFF ID not configured, skipping LINE message');
      return response.status(200).json({
        success: true,
        sid,
        mock: MOCK_MODE,
        warning: 'LIFF ID not configured, LINE message not sent'
      });
    }

    const deepLink = `https://liff.line.me/${liffId}?room=${encodeURIComponent(sid)}&mode=agent-call&sid=${encodeURIComponent(sid)}`;

    const message = language === 'ko'
      ? `📞 전화가 왔습니다!\n\n아래 링크를 눌러 수락하세요:\n${deepLink}`
      : `📞 You have an incoming call!\n\nTap the link to accept:\n${deepLink}`;

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
          to: toUserId,
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
        console.error('[Agent Call Initiate] Failed to send LINE message:', errorText);
        return response.status(200).json({
          success: true,
          sid,
          roomId,
          mock: MOCK_MODE,
          warning: 'Agent call initiated but LINE message failed'
        });
      }

      console.log('[Agent Call Initiate] LINE message sent successfully');

      return response.status(200).json({
        success: true,
        sid,
        roomId,
        mock: MOCK_MODE,
        message: 'Agent call initiated and LINE message sent'
      });
    } catch (lineError: any) {
      console.error('[Agent Call Initiate] Error sending LINE message:', lineError);
      return response.status(200).json({
        success: true,
        sid,
        roomId,
        mock: MOCK_MODE,
        warning: `Agent call initiated but LINE message failed: ${lineError.message}`
      });
    }
  } catch (error: any) {
    console.error('[Agent Call Initiate] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
