import { createHmac } from 'crypto';

// Agora RTC Token Builder
// 참고: https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey

const SECONDS_IN_SECOND = 1;

interface Privileges {
  kJoinChannel: number;
  kPublishAudioStream: number;
  kPublishVideoStream: number;
  kPublishDataStream: number;
}

const privileges: Privileges = {
  kJoinChannel: 1,
  kPublishAudioStream: 2,
  kPublishVideoStream: 3,
  kPublishDataStream: 4,
};

// Base64 URL-safe encoding
function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Pack uint32
function packUint32(value: number): string {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(value, 0);
  return buf.toString('binary');
}

// Pack uint16
function packUint16(value: number): string {
  const buf = Buffer.allocUnsafe(2);
  buf.writeUInt16BE(value, 0);
  return buf.toString('binary');
}

// Pack string
function packString(str: string): string {
  return packUint16(str.length) + str;
}

// Generate Agora RTC Token
export function generateAgoraRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  role: 'publisher' | 'subscriber' = 'publisher',
  privilegeExpiredTs: number = Math.floor(Date.now() / 1000) + 3600
): string {
  const version = '007';
  const uidStr = uid.toString();
  
  // Build message
  const message = packString(appId) +
                 packString(uidStr) +
                 packString(channelName) +
                 packUint32(privilegeExpiredTs) +
                 packUint32(role === 'publisher' ? 1 : 2);

  // Generate signature
  const signature = createHmac('sha256', appCertificate)
    .update(message, 'binary')
    .digest();

  // Pack content
  const content = packString(signature.toString('binary')) +
                 packString(appId) +
                 packString(uidStr) +
                 packString(channelName) +
                 packUint32(privilegeExpiredTs) +
                 packUint32(role === 'publisher' ? 1 : 2);

  // Return token
  return version + base64Encode(content);
}

// Alternative: Simple token generation (for testing only)
export function generateSimpleAgoraToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  expirationTimeInSeconds: number = 3600
): string {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const expiredTimestamp = currentTimestamp + expirationTimeInSeconds;
  
  // Create a simple token structure for testing
  const message = `${appId}${channelName}${uid}${expiredTimestamp}`;
  const signature = createHmac('sha256', appCertificate)
    .update(message)
    .digest('hex');
    
  const token = base64Encode(`${appId}:${signature}:${expiredTimestamp}`);
  return `007${token}`;
}