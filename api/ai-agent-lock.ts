import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LockEntry {
  userId: string;
  userName: string;
  acquiredAt: number;
  lastHeartbeat: number;
}

const locks: Map<string, LockEntry> = new Map();

const LOCK_TTL_MS = 30_000;

function isLockExpired(entry: LockEntry): boolean {
  return Date.now() - entry.lastHeartbeat > LOCK_TTL_MS;
}

function getActiveLock(roomId: string): LockEntry | null {
  const entry = locks.get(roomId);
  if (!entry) return null;
  if (isLockExpired(entry)) {
    locks.delete(roomId);
    return null;
  }
  return entry;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { action, roomId, userId, userName } = request.body || {};

  if (!action || !roomId) {
    return response.status(400).json({ error: 'Missing required fields: action, roomId' });
  }

  switch (action) {
    case 'status': {
      const lock = getActiveLock(roomId);
      return response.status(200).json({
        locked: !!lock,
        holder: lock ? { userId: lock.userId, userName: lock.userName } : null,
      });
    }

    case 'acquire': {
      if (!userId || !userName) {
        return response.status(400).json({ error: 'Missing userId or userName for acquire' });
      }
      const existing = getActiveLock(roomId);
      if (existing) {
        if (existing.userId === userId) {
            existing.lastHeartbeat = Date.now();
          return response.status(200).json({ success: true, acquired: true });
        }
        return response.status(409).json({
          success: false,
          acquired: false,
          holder: { userId: existing.userId, userName: existing.userName },
        });
      }
      const now = Date.now();
      locks.set(roomId, { userId, userName, acquiredAt: now, lastHeartbeat: now });
      return response.status(200).json({ success: true, acquired: true });
    }

    case 'release': {
      if (!userId) {
        return response.status(400).json({ error: 'Missing userId for release' });
      }
      const existing = getActiveLock(roomId);
      if (existing && existing.userId === userId) {
        locks.delete(roomId);
      }
      return response.status(200).json({ success: true });
    }

    case 'heartbeat': {
      if (!userId) {
        return response.status(400).json({ error: 'Missing userId for heartbeat' });
      }
      const existing = getActiveLock(roomId);
      if (existing && existing.userId === userId) {
        existing.lastHeartbeat = Date.now();
        return response.status(200).json({ success: true, alive: true });
      }
      return response.status(200).json({ success: false, alive: false });
    }

    default:
      return response.status(400).json({ error: `Unknown action: ${action}` });
  }
}
