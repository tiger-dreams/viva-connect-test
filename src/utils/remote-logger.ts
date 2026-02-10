/**
 * Remote Logger — intercepts console.log/warn/error and ships them to /api/debug-logs
 * Call `initRemoteLogger()` once at app startup to activate.
 */

const ENDPOINT = '/api/debug-logs';
const BATCH_INTERVAL_MS = 2000;
const MAX_MSG_LEN = 500;

interface LogEntry { ts: string; level: string; msg: string; }

let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let active = false;

function serialize(args: any[]): string {
  return args.map(a => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ').slice(0, MAX_MSG_LEN);
}

function push(level: string, args: any[]) {
  buffer.push({ ts: new Date().toISOString(), level, msg: serialize(args) });
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.splice(0);
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  } catch {
    // fail silently — don't recurse
  }
}

export function initRemoteLogger() {
  if (active) return;
  active = true;

  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...a) => { orig.log(...a); push('log', a); };
  console.warn = (...a) => { orig.warn(...a); push('warn', a); };
  console.error = (...a) => { orig.error(...a); push('error', a); };

  // Also capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    push('error', [`[UnhandledRejection] ${e.reason?.message ?? e.reason}`]);
  });

  flushTimer = setInterval(flush, BATCH_INTERVAL_MS);
  push('log', ['[RemoteLogger] activated']);
}

export function stopRemoteLogger() {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  active = false;
}
