// PlanetKit Callback Event Types

export interface PlanetKitCallbackEvent {
  eventType: string;
  serviceId?: string;
  roomId?: string;
  userId?: string;
  displayName?: string;
  timestamp?: number;
  data?: Record<string, any>;
}

export interface StoredPlanetKitEvent extends PlanetKitCallbackEvent {
  id: number;
  created_at: string;
}

export const PlanetKitEventTypes = {
  ROOM_CREATE: 'GCALL_EVT_ROOM_CREATE',
  ROOM_DELETE: 'GCALL_EVT_ROOM_DELETE',
  USER_JOIN: 'GCALL_EVT_USER_JOIN',
  USER_LEAVE: 'GCALL_EVT_USER_LEAVE',
  CALL_START: 'GCALL_EVT_START',
  CALL_END: 'GCALL_EVT_END',
} as const;

export type PlanetKitEventType = typeof PlanetKitEventTypes[keyof typeof PlanetKitEventTypes];
