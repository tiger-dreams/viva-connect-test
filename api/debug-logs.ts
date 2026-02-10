// In-memory log store (Vercel serverless, best-effort)
const MAX_LOGS = 300;

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

// Module-level store — persists across warm invocations
const logs: LogEntry[] = (globalThis as any).__debugLogs ?? [];
(globalThis as any).__debugLogs = logs;

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const entries: LogEntry[] = Array.isArray(req.body) ? req.body : [req.body];
    for (const e of entries) {
      if (e?.msg) {
        logs.push({ ts: e.ts || new Date().toISOString(), level: e.level || 'log', msg: String(e.msg) });
      }
    }
    // Trim oldest
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    return res.status(200).json({ stored: entries.length });
  }

  if (req.method === 'DELETE') {
    logs.splice(0, logs.length);
    return res.status(200).json({ cleared: true });
  }

  // GET — return logs, optionally filter by ?since=ISO
  const since = req.query?.since ? new Date(req.query.since as string).getTime() : 0;
  const filtered = since ? logs.filter(l => new Date(l.ts).getTime() > since) : logs;

  if (req.query?.format === 'text') {
    const text = filtered.map(l => `[${l.ts}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(text || '(no logs)');
  }

  return res.status(200).json({ count: filtered.length, logs: filtered });
}
