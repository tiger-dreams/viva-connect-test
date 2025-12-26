import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/get-line-token
 *
 * LINE Messaging API Channel Access Token v2 발급
 * Channel ID와 Channel Secret을 사용하여 OAuth 2.0 client credentials flow로 토큰 발급
 */
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
      error: 'Method not allowed',
    });
  }

  try {
    // Get Channel credentials from environment variables
    const channelId = process.env.LINE_CHANNEL_ID;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    console.log('[get-line-token] Environment check:', {
      hasChannelId: !!channelId,
      hasChannelSecret: !!channelSecret,
      channelIdLength: channelId?.length,
      channelSecretLength: channelSecret?.length,
    });

    if (!channelId || !channelSecret) {
      console.error('Missing environment variables: LINE_CHANNEL_ID or LINE_CHANNEL_SECRET');
      return response.status(500).json({
        success: false,
        error: 'LINE Channel credentials not configured. Please set LINE_CHANNEL_ID and LINE_CHANNEL_SECRET in environment variables.',
      });
    }

    // LINE API로 Channel Access Token 요청 (OAuth 2.0 client credentials flow)
    console.log('[get-line-token] Requesting token from LINE API using client credentials...');

    const tokenResponse = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    console.log('[get-line-token] LINE API response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[get-line-token] LINE Token API Error:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
      });
      return response.status(tokenResponse.status).json({
        success: false,
        error: `Failed to get LINE token: ${errorText}`,
      });
    }

    const tokenData = await tokenResponse.json();

    console.log('[get-line-token] Token generated successfully:', {
      hasAccessToken: !!tokenData.access_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
    });

    return response.status(200).json({
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (error) {
    console.error('[get-line-token] Error getting LINE token:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
