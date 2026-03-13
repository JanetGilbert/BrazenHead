/**
 * Local development TTS proxy server.
 *
 * Run with: npx tsx server/dev-token-server.ts
 * (or: npm run dev:server)
 *
 * Proxies /api/tts requests to the Inworld TTS REST API,
 * keeping the API key server-side.
 *
 * Vite's dev proxy forwards /api/* to this server on port 3001.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { InferenceClient } from '@huggingface/inference';

dotenv.config({ path: '.env.local' });

const PORT = 3001;
const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.raw({ type: 'audio/*', limit: '20mb' }));

// ─── STT proxy (HuggingFace Whisper) ────────────────────────────
app.post('/api/stt', async (req, res) => {
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
    const contentType = req.headers['content-type'] || 'audio/webm';
    const audioBlob = new Blob([req.body], { type: contentType });
    const result = await client.automaticSpeechRecognition({
      model: 'openai/whisper-large-v3',
      provider: 'hf-inference',
      data: audioBlob,
    });
    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('STT proxy error:', message);
    return res.status(500).json({ error: 'STT proxy error', detail: message });
  }
});

app.post('/api/tts', async (req, res) => {
  const apiKey = process.env.INWORLD_API_KEY;

  if (!apiKey) {
    console.error('Missing INWORLD_API_KEY in .env.local');
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
        voiceId : process.env.INWORLD_VOICE_ID ?? 'Dennis',
        modelId: process.env.INWORLD_MODEL_ID ?? 'inworld-tts-1.5-max',
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
    return res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('TTS proxy error:', message);
    return res.status(500).json({ error: 'TTS proxy error' });
  }
});

// ─── Save test data endpoint (dev only) ──────────────────────────
const TEST_DATA_DIR = path.resolve(import.meta.dirname, '..', 'test_data');

app.post('/api/save-test-data', (req, res) => {
  const { audioContent, timestampInfo, label } = req.body ?? {};
  if (!audioContent) {
    return res.status(400).json({ error: 'Missing audioContent' });
  }

  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

  const tag = label || Date.now().toString();
  const safeName = tag.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);

  // Save raw audio bytes
  const audioBuffer = Buffer.from(audioContent, 'base64');
  fs.writeFileSync(path.join(TEST_DATA_DIR, `${safeName}.pcm`), audioBuffer);

  // Save phoneme / timestamp data
  if (timestampInfo) {
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, `${safeName}.json`),
      JSON.stringify(timestampInfo, null, 2),
    );
  }

  console.log(`[save-test-data] Saved ${safeName}.pcm + .json`);
  return res.json({ saved: safeName });
});

// ─── Serve test data files (dev only) ────────────────────────────
app.get('/api/test-data/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const filePath = path.join(TEST_DATA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (filename.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json');
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  return res.send(fs.readFileSync(filePath));
});

app.listen(PORT, () => {
  console.log(`[dev-tts-proxy] listening on http://localhost:${PORT}`);
});
