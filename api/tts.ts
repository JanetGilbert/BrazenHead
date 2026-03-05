/**
 * Server-side TTS proxy endpoint for Inworld.ai.
 *
 * Proxies TTS requests to the Inworld REST API, keeping the API key server-side.
 *
 * Designed as a Vercel serverless function (api/tts.ts).
 *
 * Environment variables required:
 *   INWORLD_API_KEY — Inworld Basic API key (from your dashboard)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    console.error('Missing INWORLD_API_KEY env var');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  try {
    const ttsResponse = await fetch(INWORLD_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: process.env.INWORLD_VOICE_ID ?? 'Dennis',
        model_id: process.env.INWORLD_MODEL_ID ?? 'inworld-tts-1.5-max',
        audio_config: {
          audio_encoding: 'LINEAR16',
          sample_rate_hertz: 48000,
        },
        timestamp_type: 'WORD',
      }),
    });

    if (!ttsResponse.ok) {
      const detail = await ttsResponse.text().catch(() => '');
      console.error('Inworld TTS error:', ttsResponse.status, detail);
      return res.status(ttsResponse.status).json({ error: 'TTS synthesis failed', detail });
    }

    const data = await ttsResponse.json();
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('TTS proxy error:', message);
    return res.status(500).json({ error: 'TTS proxy error' });
  }
}
