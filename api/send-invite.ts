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

    // Get LINE Channel Access Token from environment
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN is not set in environment variables');
      return response.status(500).json({
        success: false,
        error: 'LINE Channel Access Token is not configured',
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
