import jwt from 'jsonwebtoken';

// Agora Token Generation
export const generateAgoraToken = (
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: 'publisher' | 'subscriber' = 'publisher',
  expirationTimeInSeconds: number = 3600
): string => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    const payload = {
      iss: appId,
      exp,
      iat: now,
      channel: channelName,
      uid,
      role: role === 'publisher' ? 1 : 2
    };

    return jwt.sign(payload, appCertificate, { algorithm: 'HS256' });
  } catch (error) {
    throw new Error(`Failed to generate Agora token: ${error}`);
  }
};

// Zoom JWT Token Generation
export const generateZoomToken = (
  sdkKey: string,
  sdkSecret: string,
  sessionName: string,
  roleType: number = 1,
  expirationTimeInSeconds: number = 3600
): string => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    const payload = {
      iss: sdkKey,
      iat: now,
      exp,
      aud: 'zoom',
      appKey: sdkKey,
      tokenExp: exp,
      sessionName,
      roleType,
      userIdentity: '',
      sessionKey: ''
    };

    return jwt.sign(payload, sdkSecret, { algorithm: 'HS256' });
  } catch (error) {
    throw new Error(`Failed to generate Zoom token: ${error}`);
  }
};

// Validate token format
export const validateToken = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token);
    return decoded !== null && typeof decoded === 'object';
  } catch {
    return false;
  }
};

// Get token expiration
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
};