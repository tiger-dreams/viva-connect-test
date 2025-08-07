export type SDKType = 'agora' | 'livekit';

export interface AgoraConfig {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: string;
  token?: string;
}

export interface LiveKitConfig {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  token?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
}

export interface VideoMetrics {
  frameRate: number;
  resolution: string;
  bitrate: number;
  packetLoss: number;
}

export interface Participant {
  id: string;
  name: string;
  isVideoOn: boolean;
  isAudioOn: boolean;
  isScreenSharing: boolean;
}