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

// Zoom JWT Token Generation - Updated for Video SDK
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
    
    // Zoom Video SDK의 최소 필수 JWT payload (단순화)
    const payload = {
      iss: sdkKey,
      exp: exp,
      iat: now,
      aud: 'zoom',
      appKey: sdkKey,
      tokenExp: exp,
      tpc: sessionName.toLowerCase(), // topic/session name (소문자 변환)
      roleType: roleType
    };
    
    console.log('Generating Zoom token with payload:', payload);
    
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    console.log('Generated Zoom token length:', token.length);
    return token;
  } catch (error) {
    console.error('Zoom token generation error:', error);
    throw new Error(`Failed to generate Zoom token: ${error}`);
  }
};

// LiveKit Token Generation (브라우저 호환)
export const generateLiveKitToken = async (
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantName: string,
  expirationTimeInSeconds: number = 3600,
  isHost: boolean = false
): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    const secret = new TextEncoder().encode(apiSecret);
    
    // LiveKit JWT payload with conditional host permissions
    const payload: any = {
      iss: apiKey,
      nbf: now,
      exp: exp,
      iat: now,
      sub: participantName,
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canUpdateOwnMetadata: true,
      }
    };

    // Add host permissions if isHost is true
    if (isHost) {
      payload.video = {
        ...payload.video,
        // Host-specific permissions
        roomAdmin: true,           // Can remove participants and update room metadata
        canPublishData: true,      // Can publish data messages
        canUpdateMetadata: true,   // Can update room metadata
        canControlRoom: true,      // General room control permissions
      };
      console.log('Generating LiveKit HOST token with admin permissions');
    } else {
      console.log('Generating LiveKit PARTICIPANT token with standard permissions');
    }
    
    console.log('Token payload:', { roomName, participantName, isHost, permissions: payload.video });
    
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    console.log('Generated LiveKit token length:', token.length);
    return token;
  } catch (error) {
    console.error('LiveKit token generation error:', error);
    throw new Error(`Failed to generate LiveKit token: ${error}`);
  }
};

// PlanetKit Access Token Generation
export const generatePlanetKitToken = async (
  serviceId: string,
  apiKey: string,
  userId: string,
  roomId: string,
  expirationTimeInSeconds: number = 3600
): Promise<string> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expirationTimeInSeconds;
    
    // 개발용 임시 secret (실제 환경에서는 서버에서 생성해야 함)
    const tempSecret = new TextEncoder().encode(`planetkit-dev-${serviceId}`);
    
    // PlanetKit Access Token payload (예상 구조)
    const payload = {
      iss: serviceId,
      sub: userId,
      iat: now,
      exp: exp,
      nbf: now,
      room: roomId,
      permissions: {
        video: true,
        audio: true,
        screenShare: true,
        chat: true
      }
    };
    
    console.log('Generating PlanetKit token for:', { serviceId, userId, roomId });
    
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(tempSecret);

    console.log('Generated PlanetKit token length:', token.length);
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