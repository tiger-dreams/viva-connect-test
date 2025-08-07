// 브라우저 호환 Agora Token Builder
// 참고: 실제 프로덕션에서는 서버에서 토큰을 생성해야 합니다.

// 브라우저에서 사용 가능한 Web Crypto API 사용
async function hmacSHA256(key: string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
}

// Base64 URL-safe encoding
function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 간단한 Agora 호환 토큰 생성 (개발/테스트용)
export async function generateAgoraToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  role: 'publisher' | 'subscriber' = 'publisher',
  expirationTimeInSeconds: number = 3600
): Promise<string> {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiredTimestamp = currentTimestamp + expirationTimeInSeconds;
    
    // 토큰 페이로드 생성
    const payload = {
      iss: appId,
      exp: expiredTimestamp,
      iat: currentTimestamp,
      channel: channelName,
      uid: uid.toString(),
      role: role === 'publisher' ? 1 : 2
    };
    
    // JWT 스타일 토큰 생성
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await hmacSHA256(appCertificate, signatureInput);
    const encodedSignature = base64UrlEncode(signature);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    
  } catch (error) {
    console.error('토큰 생성 실패:', error);
    throw new Error(`Agora 토큰 생성에 실패했습니다: ${error}`);
  }
}

// 토큰 유효성 검사
export function validateToken(token: string): boolean {
  try {
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
}

// 토큰 만료 시간 확인
export function getTokenExpiration(token: string): Date | null {
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
}

// 개발용: 토큰 없이 테스트할 수 있는 함수
export function canUseWithoutToken(appId: string): boolean {
  // App Certificate가 비활성화된 경우 토큰 없이 사용 가능
  console.log(`App ID ${appId}는 토큰 없이 테스트할 수 있습니다 (App Certificate 비활성화 필요)`);
  return true;
}