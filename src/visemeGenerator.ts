/**
 * Generates viseme timing data from text + decoded audio,
 * replacing the need for server-side phoneme data from Inworld.
 *
 * Pipeline:
 *   1. Convert text → viseme symbol sequence via grapheme rules
 *   2. Detect speech start/end from audio amplitude
 *   3. Distribute viseme timing proportionally across speech region
 *
 * The output matches the PhoneData[] format used by the existing
 * lip-sync scheduler in ttsService.ts.
 */

import type { PhoneData } from './ttsService';

// ─── Grapheme → Viseme Mapping ───────────────────────────────────

/** Digraph patterns, checked before single characters. */
const DIGRAPHS: [string, string][] = [
  // Consonant clusters
  ['th', 'th'],
  ['sh', 'cdgknstxyz'],
  ['ch', 'cdgknstxyz'],
  ['wh', 'qw'],
  ['ph', 'fv'],
  ['qu', 'qw'],
  ['ng', 'cdgknstxyz'],
  ['ck', 'cdgknstxyz'],
  // Vowel digraphs
  ['ee', 'ee'],
  ['ea', 'ee'],
  ['ie', 'ee'],
  ['oo', 'o'],
  ['ou', 'o'],
  ['ow', 'o'],
  ['oi', 'o'],
  ['oy', 'o'],
  ['ai', 'aei'],
  ['ay', 'aei'],
  ['au', 'o'],
  ['aw', 'o'],
];

const SINGLE_CHAR: Record<string, string> = {
  a: 'aei', e: 'aei', i: 'aei', u: 'aei',
  o: 'o',
  b: 'bmp', m: 'bmp', p: 'bmp',
  f: 'fv', v: 'fv',
  l: 'l',
  r: 'r',
  w: 'qw',
  c: 'cdgknstxyz', d: 'cdgknstxyz', g: 'cdgknstxyz',
  h: 'cdgknstxyz', j: 'cdgknstxyz', k: 'cdgknstxyz',
  n: 'cdgknstxyz', s: 'cdgknstxyz', t: 'cdgknstxyz',
  x: 'cdgknstxyz', z: 'cdgknstxyz',
};

/** Relative duration weight per viseme (vowels hold longer). */
const VISEME_WEIGHT: Record<string, number> = {
  sil: 0.3,
  aei: 1.5,
  o: 1.5,
  ee: 1.4,
  bmp: 0.8,
  fv: 0.8,
  l: 1.0,
  r: 1.0,
  th: 0.9,
  qw: 0.9,
  cdgknstxyz: 0.7,
};

// ─── Text → Viseme Sequence ─────────────────────────────────────

/** Convert a single word into a sequence of viseme symbols. */
function wordToVisemes(word: string): string[] {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return [];

  // Rough silent-e heuristic: drop trailing 'e' when preceded by consonant
  const effective =
    lower.length > 2 &&
    lower.endsWith('e') &&
    !/[aeiouy]/.test(lower[lower.length - 2])
      ? lower.slice(0, -1)
      : lower;

  const visemes: string[] = [];
  let i = 0;

  while (i < effective.length) {
    // Try digraphs first
    if (i + 1 < effective.length) {
      const pair = effective.slice(i, i + 2);
      const match = DIGRAPHS.find(([d]) => d === pair);
      if (match) {
        visemes.push(match[1]);
        i += 2;
        continue;
      }
    }

    const ch = effective[i];

    // 'y': consonant at word start, vowel elsewhere
    if (ch === 'y') {
      visemes.push(i === 0 ? 'cdgknstxyz' : 'ee');
      i++;
      continue;
    }

    const v = SINGLE_CHAR[ch];
    if (v) visemes.push(v);
    i++;
  }

  return visemes;
}

/**
 * Build a flat viseme sequence from text.
 * Inserts 'sil' between words, collapses consecutive identical visemes.
 */
function textToVisemeSequence(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const sequence: string[] = [];

  for (let w = 0; w < words.length; w++) {
    if (w > 0) sequence.push('sil');

    for (const v of wordToVisemes(words[w])) {
      // Collapse consecutive duplicates
      if (sequence.length === 0 || sequence[sequence.length - 1] !== v) {
        sequence.push(v);
      }
    }
  }

  return sequence;
}

// ─── Audio Speech Bounds Detection ──────────────────────────────

/**
 * Scan audio samples to find where speech begins and ends,
 * using a simple RMS-amplitude threshold.
 */
function findSpeechBounds(
  samples: Float32Array,
  sampleRate: number,
): { start: number; end: number } {
  const windowSize = Math.floor(sampleRate * 0.02); // 20 ms windows
  const hopSize = Math.floor(windowSize / 2);
  const numWindows = Math.max(
    1,
    Math.floor((samples.length - windowSize) / hopSize) + 1,
  );

  // Compute RMS per window
  const rms: number[] = [];
  for (let i = 0; i < numWindows; i++) {
    const offset = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize && offset + j < samples.length; j++) {
      const s = samples[offset + j];
      sum += s * s;
    }
    rms.push(Math.sqrt(sum / windowSize));
  }

  const maxRms = Math.max(...rms);
  if (maxRms === 0) {
    return { start: 0, end: samples.length / sampleRate };
  }

  const threshold = maxRms * 0.05;

  let startWindow = 0;
  for (let i = 0; i < numWindows; i++) {
    if (rms[i] > threshold) { startWindow = i; break; }
  }

  let endWindow = numWindows - 1;
  for (let i = numWindows - 1; i >= 0; i--) {
    if (rms[i] > threshold) { endWindow = i; break; }
  }

  return {
    start: (startWindow * hopSize) / sampleRate,
    end: Math.min(
      ((endWindow * hopSize) + windowSize) / sampleRate,
      samples.length / sampleRate,
    ),
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Generate timed PhoneData[] from text and decoded audio samples.
 *
 * @param text       The spoken text
 * @param samples    Float32 channel data from the decoded AudioBuffer
 * @param sampleRate Audio sample rate (e.g. 48 000)
 */
export function generateVisemes(
  text: string,
  samples: Float32Array,
  sampleRate: number,
): PhoneData[] {
  const sequence = textToVisemeSequence(text);
  if (sequence.length === 0) return [];

  const { start, end } = findSpeechBounds(samples, sampleRate);
  const speechDuration = end - start;
  if (speechDuration <= 0) return [];

  // Proportional timing based on per-viseme weights
  const weights = sequence.map(v => VISEME_WEIGHT[v] ?? 1.0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const phones: PhoneData[] = [];
  let currentTime = start;

  for (let i = 0; i < sequence.length; i++) {
    const duration = (weights[i] / totalWeight) * speechDuration;
    phones.push({
      phoneSymbol: sequence[i],
      startTimeSeconds: currentTime,
      durationSeconds: duration,
      visemeSymbol: sequence[i],
    });
    currentTime += duration;
  }

  return phones;
}
