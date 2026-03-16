/**
 * Server-side TTS proxy endpoint for Google Cloud Text-to-Speech.
 *
 * Proxies TTS requests to the Google Cloud Text-to-Speech API, keeping the API key server-side.
 *
 * Designed as a Vercel serverless function (api/tts.ts).
 *
 * Environment variables required:
 *   GOOGLE_TTS_KEY — Google Cloud Text-to-Speech API key
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) {
    console.error('Missing GOOGLE_TTS_KEY env var');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  try {
    const ttsResponse = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-A',
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 48000,
        },
      }),
    });

    if (!ttsResponse.ok) {
      const detail = await ttsResponse.text().catch(() => '');
      console.error('Google TTS error:', ttsResponse.status, detail);
      return res.status(ttsResponse.status).json({ error: 'TTS synthesis failed', detail });
    }

    const data = await ttsResponse.json();
    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('TTS proxy error:', message);
    return res.status(500).json({ error: 'TTS proxy error' });
  }
}
