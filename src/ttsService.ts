/**
 * TTS service with client-side viseme generation.
 *
 * Sends text to the TTS API via our backend proxy,
 * receives audio (base64), generates lip-sync visemes
 * from the text + audio amplitude, and drives mouth
 * animation via timed viseme callbacks.
 */
import { generateVisemes } from './visemeGenerator';

// ─── Configuration ───────────────────────────────────────────────
const TTS_ENDPOINT = import.meta.env.VITE_TTS_ENDPOINT as string ?? '/api/tts';

/** Set to true to save each TTS response (audio + phonemes) to test_data/ via the dev server. */
export const SAVE_TEST_DATA = false;

// ─── Types ───────────────────────────────────────────────────────
export interface PhoneData {
  phoneSymbol: string;
  startTimeSeconds: number;
  durationSeconds: number;
  visemeSymbol: string;
}

export interface WordAlignment {
  words: string[];
  wordStartTimeSeconds: number[];
  wordEndTimeSeconds: number[];
  phoneticDetails: {
    wordIndex: number;
    phones: PhoneData[];
  }[];
}

export interface TTSResponse {
  audioContent: string;          // base64-encoded audio
  timestampInfo?: {
    wordAlignment?: WordAlignment;
  };
}

export type VisemeCallback = (visemeSymbol: string) => void;
export type ErrorCallback = (message: string) => void;

// ─── Audio context (lazy init) ───────────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext({ sampleRate: 48000 });
  }
  return audioCtx;
}

// ─── Active playback tracking ────────────────────────────────────
let activeTimers: number[] = [];

/**
 * Call the backend TTS proxy and return the full response.
 */
export async function synthesize(text: string): Promise<TTSResponse> {
  const res = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TTS request failed (${res.status}): ${detail}`);
  }

  const response: TTSResponse = await res.json();

  if (SAVE_TEST_DATA) {
    saveTestData(response, text);
  }

  return response;
}

/**
 * Persist a TTS response to disk via the dev server (for offline test data).
 */
function saveTestData(response: TTSResponse, label: string): void {
  fetch('/api/save-test-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioContent: response.audioContent,
      timestampInfo: response.timestampInfo,
      label,
    }),
  }).catch((err) => console.warn('[saveTestData]', err));
}

/**
 * Decode base64 LINEAR16 PCM audio into an AudioBuffer.
 */
function decodeLinear16(base64Audio: string, sampleRate: number): AudioBuffer {
  const ctx = getAudioContext();
  const raw = atob(base64Audio);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  // Check if it's a WAV (RIFF header) and skip past it
  let pcmStart = 0;
  if (
    bytes.length > 44 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46
  ) {
    pcmStart = 44;
  }

  const pcmBytes = bytes.subarray(pcmStart);
  const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
  audioBuffer.copyToChannel(float32, 0);
  return audioBuffer;
}

/**
 * Play audio and schedule viseme callbacks at the correct times.
 *
 * Returns a promise that resolves when playback finishes.
 */
export async function playWithVisemes(
  response: TTSResponse,
  onViseme: VisemeCallback,
  onError?: ErrorCallback,
  text?: string,
): Promise<void> {
  // Cancel any previous playback
  stopPlayback();

  const ctx = getAudioContext();

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = decodeLinear16(response.audioContent, 48000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Audio decode failed';
    onError?.(msg);
    throw err;
  }

  // Prefer API-provided visemes; fall back to text-based generation
  let phones = extractPhones(response);
  if (phones.length === 0 && text) {
    const samples = audioBuffer.getChannelData(0);
    phones = generateVisemes(text, samples, audioBuffer.sampleRate);
  }

  for (const phone of phones) {
    const timerId = window.setTimeout(() => {
      onViseme(phone.visemeSymbol);
    }, phone.startTimeSeconds * 1000);
    activeTimers.push(timerId);
  }

  // Schedule a "silence" viseme after the last phone ends
  if (phones.length > 0) {
    const lastPhone = phones[phones.length - 1];
    const endTime = (lastPhone.startTimeSeconds + lastPhone.durationSeconds) * 1000;
    const silenceTimer = window.setTimeout(() => {
      onViseme('sil');
    }, endTime);
    activeTimers.push(silenceTimer);
  }

  // Play the audio
  return new Promise<void>((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start(0);
  });
}

/**
 * Stop any active playback and clear scheduled viseme timers.
 */
export function stopPlayback(): void {
  for (const id of activeTimers) {
    window.clearTimeout(id);
  }
  activeTimers = [];
}

/**
 * Extract a flat, time-sorted list of phone entries from the response.
 */
function extractPhones(response: TTSResponse): PhoneData[] {
  const alignment = response.timestampInfo?.wordAlignment;
  if (!alignment?.phoneticDetails) return [];

  const phones: PhoneData[] = [];
  for (const detail of alignment.phoneticDetails) {
    for (const phone of detail.phones) {
      phones.push(phone);
    }
  }

  // Sort by start time to be safe
  phones.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  return phones;
}

/**
 * Convenience: synthesize + play in one call.
 */
export async function speakText(
  text: string,
  onViseme: VisemeCallback,
  onError?: ErrorCallback,
): Promise<void> {
  const response = await synthesize(text);
  await playWithVisemes(response, onViseme, onError, text);
}

/**
 * Load a saved test data pair (Test.pcm + Test.json) from the dev server
 * and play it back with lip-sync, bypassing TTS synthesis entirely.
 */
export async function playTestData(
  onViseme: VisemeCallback,
  onError?: ErrorCallback,
): Promise<void> {
  const [pcmRes, jsonRes] = await Promise.all([
    fetch('/api/test-data/Test.pcm'),
    fetch('/api/test-data/Test.json'),
  ]);

  if (!pcmRes.ok || !jsonRes.ok) {
    const msg = 'Failed to load test data (Test.pcm / Test.json)';
    onError?.(msg);
    throw new Error(msg);
  }

  const pcmBuffer = await pcmRes.arrayBuffer();
  const bytes = new Uint8Array(pcmBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const audioContent = btoa(binary);
  const timestampInfo = await jsonRes.json();

  const response: TTSResponse = { audioContent, timestampInfo };
  await playWithVisemes(response, onViseme, onError);
}
