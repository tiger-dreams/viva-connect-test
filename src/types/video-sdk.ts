export type SDKType = 'planetkit';

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

export interface PlanetKitConfig {
  serviceId: string;
  apiKey: string;
  apiSecret: string;
  userId: string;
  roomId: string;
  accessToken: string;
  environment: 'eval' | 'real' | ''; // Evaluation vs Real 환경 선택 (빈 값 = 미선택)
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