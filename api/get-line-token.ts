import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

/**
 * GET /api/get-line-token
 *
 * LINE Messaging API Channel Access Token v2.1 발급
 * Channel ID와 Channel Secret을 사용하여 JWT 생성 후 토큰 발급
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

    // JWT 생성 (Channel Secret을 HMAC key로 사용)
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (60 * 30); // 30분 후 만료

    console.log('[get-line-token] JWT parameters:', {
      issuer: channelId,
      subject: channelId,
      now,
      exp,
    });

    const secret = new TextEncoder().encode(channelSecret);

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(channelId)
      .setSubject(channelId)
      .setAudience('https://api.line.me/')
      .setExpirationTime(exp)
      .setIssuedAt(now)
      .sign(secret);

    console.log('[get-line-token] JWT generated successfully, requesting token from LINE API...');

    // LINE API로 Channel Access Token 요청
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
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
