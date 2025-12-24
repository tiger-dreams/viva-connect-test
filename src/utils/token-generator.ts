import { SignJWT } from 'jose';

// PlanetKit Access Token Generation
// 참고: https://docs.lineplanet.me/getting-started/essentials/access-token
export const generatePlanetKitToken = async (
  serviceId: string,
  apiKey: string,
  userId: string,
  roomId: string,
  _expirationTimeInSeconds: number = 3600, // Note: PlanetKit doesn't use exp field per docs
  apiSecret?: string
): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000);

    // API Secret 필수 체크
    if (!apiSecret) {
      console.error('❌ API Secret이 제공되지 않았습니다.');
      throw new Error('API Secret is required for PlanetKit token generation');
    }

    // API Secret을 secret으로 사용
    const secret = new TextEncoder().encode(apiSecret);

    // PlanetKit 공식 문서의 필수 필드만 사용
    // 추가 필드를 넣으면 토큰 크기가 커지므로 금지됨
    // Note: exp, nbf, room 등의 필드는 의도적으로 제외됨
    const payload = {
      sub: serviceId,  // Service ID
      uid: userId,     // User ID
      iss: apiKey,     // API Key
      iat: now         // Creation timestamp
    };

    console.log('🔐 Generating PlanetKit token for:', {
      serviceId,
      userId,
      roomId,
      hasApiSecret: !!apiSecret,
      apiSecretLength: apiSecret.length
    });
    console.log('Token payload (official structure):', payload);

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    console.log('✅ Generated PlanetKit token length:', token.length);

    return token;
  } catch (error) {
    console.error('PlanetKit token generation error:', error);
    throw new Error(`Failed to generate PlanetKit token: ${error}`);
  }
};

// Validate token format
export const validateToken = (token: string): boolean => {
  try {
    // Simple JWT format validation
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
};

// Get token expiration
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    if (payload && payload.exp) {
      return new Date(payload.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
};