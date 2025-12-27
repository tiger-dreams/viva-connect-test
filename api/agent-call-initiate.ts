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
        console.log('[Agent Call Initiate] Full PlanetKit response:', JSON.stringify(planetKitResponse, null, 2));

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

    // Note: LINE message will be sent by PlanetKit notify callback (/api/notify-callback)
    // The notify callback will receive cc_param from PlanetKit and send it to the user via LINE message
    console.log('[Agent Call Initiate] Agent Call initiated successfully.');
    console.log('[Agent Call Initiate] Waiting for notify callback to deliver cc_param to user via LINE message.');

    return response.status(200).json({
      success: true,
      sid,
      mock: MOCK_MODE,
      message: 'Agent call initiated. Notify callback will send LINE message with cc_param.'
    });
  } catch (error: any) {
    console.error('[Agent Call Initiate] Error:', error);
    return response.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
