import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-openai-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const model = (req.query.model as string) || 'gpt-4o-realtime-preview-2024-12-17';
  const voice = (req.query.voice as string) || 'alloy';
  const apiKey = (req.headers['x-openai-key'] as string) || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing OpenAI API key' });
  }

  try {
    const sdp = typeof req.body === 'string' ? req.body : req.body?.toString?.() || '';
    const upstream = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp',
        'Accept': 'application/sdp',
      },
      body: sdp,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/sdp');
    return res.send(text);
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}


