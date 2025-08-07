import { SignJWT } from 'jose';

// Agora Token Generation
export const generateAgoraToken = async (
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: 'publisher' | 'subscriber' = 'publisher',
  expirationTimeInSeconds: number = 3600
): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    const secret = new TextEncoder().encode(appCertificate);
    
    const token = await new SignJWT({
      channel: channelName,
      uid,
      role: role === 'publisher' ? 1 : 2
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(appId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    return token;
  } catch (error) {
    throw new Error(`Failed to generate Agora token: ${error}`);
  }
};

// Zoom JWT Token Generation
export const generateZoomToken = async (
  sdkKey: string,
  sdkSecret: string,
  sessionName: string,
  roleType: number = 1,
  expirationTimeInSeconds: number = 3600
): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    const secret = new TextEncoder().encode(sdkSecret);
    
    const token = await new SignJWT({
      aud: 'zoom',
      appKey: sdkKey,
      tokenExp: exp,
      sessionName,
      roleType,
      userIdentity: '',
      sessionKey: ''
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(sdkKey)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    return token;
  } catch (error) {
    throw new Error(`Failed to generate Zoom token: ${error}`);
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