import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/send-invite
 *
 * Body:
 * - toUserId: 메시지를 받을 LINE user ID (필수)
 * - fromUserName: 초대한 사용자 이름 (필수)
 * - roomId: 룸 ID (필수)
 * - liffId: LIFF ID (필수)
 *
 * LINE Messaging API를 통해 Push Message 발송
 */
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
      error: 'Method not allowed',
    });
  }

  try {
    const { toUserId, fromUserName, roomId, liffId } = request.body;

    // Validate required fields
    if (!toUserId || !fromUserName || !roomId || !liffId) {
      return response.status(400).json({
        success: false,
        error: 'Missing required fields: toUserId, fromUserName, roomId, liffId',
      });
    }

    // Get LINE Channel Access Token dynamically using v2.1 method
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;
    const tokenUrl = `${baseUrl}/api/get-line-token`;
    console.log('[send-invite] Requesting token from:', tokenUrl);

    const tokenResponse = await fetch(tokenUrl);

    console.log('[send-invite] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[send-invite] Failed to get LINE token:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
      });
      return response.status(500).json({
        success: false,
        error: `Failed to obtain LINE Channel Access Token: ${errorText}`,
      });
    }

    const tokenData = await tokenResponse.json();
    const channelAccessToken = tokenData.access_token;

    console.log('[send-invite] Token obtained successfully');

    if (!channelAccessToken) {
      return response.status(500).json({
        success: false,
        error: 'Invalid token response',
      });
    }

    // Build LIFF URL
    const liffUrl = `https://liff.line.me/${liffId}?room=${encodeURIComponent(roomId)}`;

    // LINE Messaging API Push Message
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
            text: `🎥 ${fromUserName}님이 화상 통화에 초대했습니다!\n\n룸 이름: ${roomId}\n\n아래 링크를 눌러 참여하세요:\n${liffUrl}`,
          },
        ],
      }),
    });

    if (!lineApiResponse.ok) {
      const errorText = await lineApiResponse.text();
      console.error('LINE API Error:', errorText);
      return response.status(lineApiResponse.status).json({
        success: false,
        error: `LINE API Error: ${errorText}`,
      });
    }

    return response.status(200).json({
      success: true,
      message: 'Invite sent successfully',
    });
  } catch (error) {
    console.error('Error sending invite:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
