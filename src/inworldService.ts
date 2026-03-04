/**
 * Inworld.ai connection service.
 *
 * Manages the WebSocket session, microphone capture, TTS playback,
 * and dispatches phoneme events to the ThreeScene for lip-sync.
 */
import {
  InworldClient,
  MicrophoneMode,
} from '@inworld/web-core';
import type {
  InworldConnectionService,
  InworldPacket,
  AdditionalPhonemeInfo,
} from '@inworld/web-core';

// ─── Configuration ───────────────────────────────────────────────
// These come from environment variables set in .env.local
// and are injected by Vite at build time.
const INWORLD_SCENE = import.meta.env.VITE_INWORLD_SCENE as string; // e.g. "workspaces/{ws}/characters/{char}"
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT as string ?? '/api/token';

// ─── Types ───────────────────────────────────────────────────────
export type PhonemeCallback = (phoneme: string) => void;
export type TextCallback = (text: string, isFinal: boolean) => void;
export type ReadyCallback = () => void;
export type ErrorCallback = (message: string) => void;

export interface InworldServiceOptions {
  /** Called when a phoneme should be applied to the face mesh. */
  onPhoneme: PhonemeCallback;
  /** Called when Inworld sends text (character response). */
  onText?: TextCallback;
  /** Called when the connection is open and ready. */
  onReady?: ReadyCallback;
  /** Called on connection errors. */
  onError?: ErrorCallback;
}

// ─── Service ─────────────────────────────────────────────────────
let connection: InworldConnectionService | null = null;

/**
 * Initialise and connect to Inworld.
 * Returns the connection service for mic / text control.
 */
export async function connectInworld(
  options: InworldServiceOptions,
): Promise<InworldConnectionService> {
  const { onPhoneme, onText, onReady, onError } = options;

  const client = new InworldClient()
    .setConfiguration({
      capabilities: {
        audio: true,
        phonemes: true,
        emotions: true,
        interruptions: true,
        silence: true,
      },
    })
    .setScene(INWORLD_SCENE)
    .setGenerateSessionToken(async () => {
      const res = await fetch(TOKEN_ENDPOINT);
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
      return res.json();
    })
    .setOnPhoneme((phonemeData: AdditionalPhonemeInfo[]) => {
      // During TTS playback, this fires with the current phoneme(s).
      // We take the first entry — it represents what should be showing now.
      if (phonemeData.length > 0 && phonemeData[0].phoneme) {
        onPhoneme(phonemeData[0].phoneme);
      }
    })
    .setOnMessage((packet: InworldPacket) => {
      if (packet.isText() && onText) {
        const text = packet.text;
        onText(text.text, text.final);
      }
    })
    .setOnError((err) => {
      console.error('[Inworld]', err.message);
      onError?.(err.message);
    })
    .setOnReady(() => {
      console.log('[Inworld] Connection ready');
      onReady?.();
    })
    .setOnDisconnect(() => {
      console.log('[Inworld] Disconnected');
    });

  connection = client.build();
  await connection.open();

  return connection;
}

/**
 * Start capturing microphone audio and streaming to Inworld.
 */
export async function startMicrophone(): Promise<void> {
  if (!connection) throw new Error('Not connected');
  await connection.recorder.initPlayback();
  await connection.sendAudioSessionStart({
    mode: MicrophoneMode.EXPECT_AUDIO_END,
  });
  await connection.recorder.start();
}

/**
 * Stop the microphone audio session.
 */
export async function stopMicrophone(): Promise<void> {
  if (!connection) return;
  connection.recorder.stop();
  await connection.sendAudioSessionEnd();
}

/**
 * Send a text message to the current character.
 */
export async function sendText(text: string): Promise<void> {
  if (!connection) throw new Error('Not connected');
  await connection.sendText(text);
}

/**
 * Gracefully close the Inworld connection.
 */
export async function disconnect(): Promise<void> {
  if (!connection) return;
  await connection.close();
  connection = null;
}
