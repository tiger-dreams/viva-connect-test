import type { VercelRequest, VercelResponse } from '@vercel/node';

interface FollowerProfile {
  user_id: string;
  display_name: string;
  picture_url?: string;
  status_message?: string;
}

/**
 * GET /api/get-followers
 *
 * LINE Official Account의 팔로워 목록 조회
 * 어드민 권한이 있는 사용자만 호출 가능
 *
 * Query params:
 * - requesterId: 요청한 사용자의 LINE user ID (어드민 권한 확인용)
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
    const { requesterId } = request.query;

    console.log('[get-followers] Request:', { requesterId });

    // 어드민 권한 확인
    const adminUids = process.env.VITE_ADMIN_UIDS?.split(',').map(id => id.trim()) || [];

    if (!requesterId || typeof requesterId !== 'string') {
      return response.status(400).json({
        success: false,
        error: 'requesterId parameter is required',
      });
    }

    if (!adminUids.includes(requesterId)) {
      console.log('[get-followers] Access denied:', { requesterId, adminUids });
      return response.status(403).json({
        success: false,
        error: 'Access denied. Admin permission required.',
      });
    }

    // Get Channel Access Token
    const baseUrl = request.headers.origin || `https://${request.headers.host}`;
    const tokenUrl = `${baseUrl}/api/get-line-token`;

    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[get-followers] Failed to get LINE token:', errorText);
      return response.status(500).json({
        success: false,
        error: 'Failed to obtain LINE Channel Access Token',
      });
    }

    const tokenData = await tokenResponse.json();
    const channelAccessToken = tokenData.access_token;

    if (!channelAccessToken) {
      return response.status(500).json({
        success: false,
        error: 'Invalid token response',
      });
    }

    // Get follower IDs (paginated)
    const allFollowerIds: string[] = [];
    let start: string | undefined = undefined;

    console.log('[get-followers] Fetching follower IDs...');

    do {
      const url = start
        ? `https://api.line.me/v2/bot/followers/ids?start=${start}`
        : 'https://api.line.me/v2/bot/followers/ids';

      const followersResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${channelAccessToken}`,
        },
      });

      if (!followersResponse.ok) {
        const errorText = await followersResponse.text();
        console.error('[get-followers] LINE API Error:', errorText);
        return response.status(followersResponse.status).json({
          success: false,
          error: `LINE API Error: ${errorText}`,
        });
      }

      const followersData = await followersResponse.json();
      allFollowerIds.push(...followersData.userIds);
      start = followersData.next;

      console.log('[get-followers] Fetched batch:', {
        batchSize: followersData.userIds.length,
        hasMore: !!start,
        totalSoFar: allFollowerIds.length,
      });
    } while (start);

    console.log('[get-followers] Total followers found:', allFollowerIds.length);

    // Get profiles for each follower (batch processing)
    // LINE API는 bulk profile API가 없으므로 개별 호출 필요
    // 너무 많은 경우 제한할 수 있음
    const MAX_PROFILES = 100;
    const followerIdsToFetch = allFollowerIds.slice(0, MAX_PROFILES);

    console.log('[get-followers] Fetching profiles for', followerIdsToFetch.length, 'followers');

    const profilePromises = followerIdsToFetch.map(async (userId) => {
      try {
        const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${channelAccessToken}`,
          },
        });

        if (!profileResponse.ok) {
          console.warn('[get-followers] Failed to get profile for', userId);
          return null;
        }

        const profileData = await profileResponse.json();
        return {
          user_id: userId,
          display_name: profileData.displayName,
          picture_url: profileData.pictureUrl,
          status_message: profileData.statusMessage,
        } as FollowerProfile;
      } catch (error) {
        console.error('[get-followers] Error fetching profile for', userId, error);
        return null;
      }
    });

    const profiles = (await Promise.all(profilePromises)).filter((p): p is FollowerProfile => p !== null);

    console.log('[get-followers] Successfully fetched', profiles.length, 'profiles');

    return response.status(200).json({
      success: true,
      data: profiles,
      total: allFollowerIds.length,
      returned: profiles.length,
    });
  } catch (error) {
    console.error('[get-followers] Error fetching followers:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
