/**
 * Maps IPA phoneme strings from Inworld's AdditionalPhonemeInfo
 * to the Miku model's morph target blend shapes.
 *
 * Each entry is { morphName, weight } — a single phoneme can
 * drive multiple blend shapes simultaneously.
 */

export interface MorphTarget {
  morphName: string;
  weight: number;
}

/**
 * Phoneme-to-blend-shape mapping.
 *
 * Inworld emits IPA phonemes (e.g. "æ", "k", "ʃ", etc.).
 * The Miku mesh has these mouth-related morph targets:
 *   Ah, Ch, U, E, Oh, Hmm, Wa, ▲, ∧, □, ω
 *
 * We map each phoneme to one or more morph targets with weights.
 * Unmapped phonemes fall through to the silent/rest pose.
 */
const phonemeToBlendShapes: Record<string, MorphTarget[]> = {
  // ── Silence / rest ──
  sil: [],

  // ── Open vowels ──
  æ: [{ morphName: 'Ah', weight: 0.9 }, { morphName: 'E', weight: 0.3 }],
  ɑ: [{ morphName: 'Ah', weight: 1.0 }],
  a: [{ morphName: 'Ah', weight: 1.0 }],
  ʌ: [{ morphName: 'Ah', weight: 0.7 }],

  // ── Mid vowels ──
  ɛ: [{ morphName: 'E', weight: 0.8 }, { morphName: 'Ah', weight: 0.2 }],
  e: [{ morphName: 'E', weight: 0.9 }],

  // ── Close front vowels ──
  i: [{ morphName: 'E', weight: 1.0 }],
  ɪ: [{ morphName: 'E', weight: 0.7 }],

  // ── Back rounded vowels ──
  o: [{ morphName: 'Oh', weight: 1.0 }],
  ɔ: [{ morphName: 'Oh', weight: 0.9 }, { morphName: 'Ah', weight: 0.2 }],
  ɒ: [{ morphName: 'Oh', weight: 0.8 }, { morphName: 'Ah', weight: 0.3 }],

  // ── Close back vowels ──
  u: [{ morphName: 'U', weight: 1.0 }],
  ʊ: [{ morphName: 'U', weight: 0.7 }],

  // ── Schwa / reduced vowels ──
  ə: [{ morphName: 'Ah', weight: 0.3 }],
  ɜ: [{ morphName: 'E', weight: 0.4 }, { morphName: 'Ah', weight: 0.2 }],

  // ── Diphthongs (approximate to dominant viseme) ──
  aɪ: [{ morphName: 'Ah', weight: 0.7 }, { morphName: 'E', weight: 0.3 }],
  aʊ: [{ morphName: 'Ah', weight: 0.7 }, { morphName: 'U', weight: 0.3 }],
  eɪ: [{ morphName: 'E', weight: 0.7 }, { morphName: 'Ah', weight: 0.2 }],
  oʊ: [{ morphName: 'Oh', weight: 0.7 }, { morphName: 'U', weight: 0.3 }],
  ɔɪ: [{ morphName: 'Oh', weight: 0.6 }, { morphName: 'E', weight: 0.3 }],

  // ── Bilabial stops / nasals (lips together) ──
  p: [{ morphName: 'Hmm', weight: 0.9 }],
  b: [{ morphName: 'Hmm', weight: 0.9 }],
  m: [{ morphName: 'Hmm', weight: 1.0 }],

  // ── Labiodental fricatives (lower lip to upper teeth) ──
  f: [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }],
  v: [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }],

  // ── Dental fricatives ──
  θ: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],
  ð: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],

  // ── Alveolar stops / nasals ──
  t: [{ morphName: 'E', weight: 0.3 }],
  d: [{ morphName: 'E', weight: 0.3 }],
  n: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Hmm', weight: 0.2 }],

  // ── Alveolar fricatives ──
  s: [{ morphName: 'E', weight: 0.5 }],
  z: [{ morphName: 'E', weight: 0.5 }],

  // ── Post-alveolar fricatives / affricates ──
  ʃ: [{ morphName: 'Ch', weight: 0.8 }, { morphName: 'U', weight: 0.3 }],
  ʒ: [{ morphName: 'Ch', weight: 0.8 }, { morphName: 'U', weight: 0.3 }],
  tʃ: [{ morphName: 'Ch', weight: 1.0 }],
  dʒ: [{ morphName: 'Ch', weight: 0.9 }],

  // ── Velar stops ──
  k: [{ morphName: 'E', weight: 0.2 }],
  g: [{ morphName: 'E', weight: 0.2 }],
  ŋ: [{ morphName: 'E', weight: 0.2 }, { morphName: 'Hmm', weight: 0.2 }],

  // ── Glottal ──
  h: [{ morphName: 'Ah', weight: 0.3 }],
  ʔ: [],

  // ── Approximants ──
  w: [{ morphName: 'Wa', weight: 1.0 }],
  j: [{ morphName: 'E', weight: 0.6 }],
  ɹ: [{ morphName: 'Oh', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],
  r: [{ morphName: 'Oh', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],

  // ── Laterals ──
  l: [{ morphName: 'E', weight: 0.4 }, { morphName: 'Ah', weight: 0.1 }],
  ɫ: [{ morphName: 'E', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],
};

/** All morph target names that this module drives (for resetting). */
export const MOUTH_MORPH_NAMES = [
  'Ah', 'Ch', 'U', 'E', 'Oh', 'Hmm', 'Wa',
] as const;

/**
 * Look up blend-shape targets for a given IPA phoneme string.
 * Returns an empty array for silence / unknown phonemes.
 */
export function getBlendShapesForPhoneme(phoneme: string): MorphTarget[] {
  return phonemeToBlendShapes[phoneme] ?? [];
}
