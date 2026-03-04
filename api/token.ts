/**
 * Server-side token generation endpoint for Inworld.ai.
 *
 * This is designed as a Vercel serverless function (api/token.ts),
 * but can also be imported into an Express server.
 *
 * Environment variables required:
 *   INWORLD_KEY     — Inworld API key
 *   INWORLD_SECRET  — Inworld API secret
 *   INWORLD_SCENE   — Full scene resource name
 *                      e.g. "workspaces/{ws}/characters/{char}"
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { InworldClient } from '@inworld/nodejs-sdk';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.INWORLD_KEY;
  const secret = process.env.INWORLD_SECRET;
  const scene = process.env.INWORLD_SCENE;

  if (!key || !secret || !scene) {
    console.error('Missing INWORLD_KEY, INWORLD_SECRET, or INWORLD_SCENE env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const client = new InworldClient()
      .setApiKey({ key, secret })
      .setScene(scene);

    const token = await client.generateSessionToken();

    // Return in the shape that @inworld/web-core SessionToken expects
    return res.status(200).json({
      token: token.token,
      type: token.type,
      expirationTime: token.expirationTime.toISOString(),
      sessionId: token.sessionId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Token generation failed:', message);
    return res.status(500).json({ error: 'Token generation failed' });
  }
}
