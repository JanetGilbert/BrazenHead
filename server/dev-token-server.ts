/**
 * Local development token server.
 *
 * Run with: npx tsx server/dev-token-server.ts
 * (or add "dev:server" script to package.json)
 *
 * Serves the /api/token endpoint on port 3001.
 * Vite's dev proxy forwards /api/* to this server.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { InworldClient } from '@inworld/nodejs-sdk';

dotenv.config({ path: '.env.local' });

const PORT = 3001;
const app = express();
app.use(cors());

app.get('/api/token', async (_req, res) => {
  const key = process.env.INWORLD_KEY;
  const secret = process.env.INWORLD_SECRET;
  const scene = process.env.INWORLD_SCENE;

  if (!key || !secret || !scene) {
    console.error('Missing INWORLD_KEY, INWORLD_SECRET, or INWORLD_SCENE in .env.local');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const client = new InworldClient()
      .setApiKey({ key, secret })
      .setScene(scene);

    const token = await client.generateSessionToken();

    return res.json({
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
});

app.listen(PORT, () => {
  console.log(`[dev-token-server] listening on http://localhost:${PORT}`);
});
