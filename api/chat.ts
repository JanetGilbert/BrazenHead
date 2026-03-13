/**
 * Server-side chat proxy endpoint for HuggingFace LLM.
 *
 * Forwards conversation messages to the HuggingFace OpenAI-compatible
 * chat completions API, keeping the API key server-side.
 *
 * Designed as a Vercel serverless function (api/chat.ts).
 *
 * Environment variables required:
 *   HUGGINGFACE_API_KEY      — HuggingFace Bearer token
 *   HUGGINGFACE_CHAT_MODEL   — (optional) model ID, default Qwen/Qwen2.5-7B-Instruct
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

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

  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing "messages" array in request body' });
  }

  try {
    const model = process.env.HUGGINGFACE_CHAT_MODEL || DEFAULT_MODEL;

    const response = await fetch(HF_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('HuggingFace chat error:', response.status, detail);
      return res.status(response.status).json({ error: 'Chat completion failed', detail });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Chat proxy error:', message);
    return res.status(500).json({ error: 'Chat proxy error', detail: message });
  }
}
