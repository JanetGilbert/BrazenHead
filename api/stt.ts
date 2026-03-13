/**
 * Server-side STT proxy endpoint for HuggingFace Whisper.
 *
 * Forwards audio to the HuggingFace Inference API, keeping the API key server-side.
 *
 * Designed as a Vercel serverless function (api/stt.ts).
 *
 * Environment variables required:
 *   HUGGINGFACE_API_KEY — HuggingFace Bearer token
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { InferenceClient } from '@huggingface/inference';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    console.error('Missing HUGGINGFACE_API_KEY');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Missing audio data' });
  }

  try {
    const client = new InferenceClient(apiKey);
    const result = await client.automaticSpeechRecognition({
      model: process.env.HUGGINGFACE_STT,
      data: req.body,
    });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('STT proxy error:', message);
    return res.status(500).json({ error: 'STT proxy error', detail: message });
  }
}
