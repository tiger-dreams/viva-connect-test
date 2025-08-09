export type SDKType = 'agora' | 'livekit' | 'planetkit';

export interface AgoraConfig {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: string;
  token?: string;
  role?: ParticipantRole;
  isHost?: boolean;
  participantName?: string; // 참가자 식별용 이름
}

export enum ParticipantRole {
  HOST = 'host',
  MODERATOR = 'moderator', 
  PARTICIPANT = 'participant'
}

export interface RolePermissions {
  canKickOut: boolean;
  canMuteOthers: boolean;
  canChangeRole: boolean;
  canManageRoom: boolean;
}

export interface LiveKitConfig {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  token?: string;
  role?: ParticipantRole;
  isHost?: boolean;
}

export interface PlanetKitConfig {
  serviceId: string;
  apiKey: string;
  userId: string;
  roomId: string;
  accessToken: string;
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
  role?: ParticipantRole;
  permissions?: RolePermissions;
  isHost?: boolean;
}