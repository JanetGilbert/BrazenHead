/**
 * Maps viseme symbols from Inworld's TTS API response
 * to the Miku model's morph target blend shapes.
 *
 * The TTS API returns `visemeSymbol` on each phone entry (e.g. "aa", "PP", "sil").
 * We also support IPA phoneme strings as fallback keys.
 *
 * Each entry is { morphName, weight } — a single viseme can
 * drive multiple blend shapes simultaneously.
 *
 * Miku mouth-related morph targets:
 *   Ah, Ch, U, E, Oh, Hmm, Wa
 */

export interface MorphTarget {
  morphName: string;
  weight: number;
}

const visemeToBlendShapes: Record<string, MorphTarget[]> = {
  // ── Silence / rest ──
  sil: [],
  SIL: [],

  // ── Oculus/Meta-style viseme symbols (commonly returned by TTS APIs) ──
  PP: [{ morphName: 'Hmm', weight: 0.9 }],             // bilabial: p, b, m
  FF: [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }], // labiodental: f, v
  TH: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],  // dental: θ, ð
  DD: [{ morphName: 'E', weight: 0.3 }],                // alveolar: t, d, n
  kk: [{ morphName: 'E', weight: 0.2 }],                // velar: k, g, ŋ
  CH: [{ morphName: 'Ch', weight: 0.9 }, { morphName: 'U', weight: 0.3 }],  // postalveolar: ʃ, ʒ, tʃ, dʒ
  SS: [{ morphName: 'E', weight: 0.5 }],                // alveolar fric: s, z
  nn: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Hmm', weight: 0.2 }], // alveolar nasal: n
  RR: [{ morphName: 'Oh', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],  // approximant: r
  aa: [{ morphName: 'Ah', weight: 1.0 }],               // open vowel: ɑ, æ
  E: [{ morphName: 'E', weight: 0.9 }],                 // mid front vowel
  ih: [{ morphName: 'E', weight: 0.7 }],                // near-close front: ɪ
  oh: [{ morphName: 'Oh', weight: 1.0 }],               // open-mid back: ɔ
  ou: [{ morphName: 'U', weight: 1.0 }],                // close back: u, ʊ

  // ── IPA phoneme fallbacks (in case API returns phoneSymbol instead) ──
  æ: [{ morphName: 'Ah', weight: 0.9 }, { morphName: 'E', weight: 0.3 }],
  ɑ: [{ morphName: 'Ah', weight: 1.0 }],
  a: [{ morphName: 'Ah', weight: 1.0 }],
  ʌ: [{ morphName: 'Ah', weight: 0.7 }],
  ɛ: [{ morphName: 'E', weight: 0.8 }, { morphName: 'Ah', weight: 0.2 }],
  e: [{ morphName: 'E', weight: 0.9 }],
  i: [{ morphName: 'E', weight: 1.0 }],
  ɪ: [{ morphName: 'E', weight: 0.7 }],
  o: [{ morphName: 'Oh', weight: 1.0 }],
  ɔ: [{ morphName: 'Oh', weight: 0.9 }, { morphName: 'Ah', weight: 0.2 }],
  u: [{ morphName: 'U', weight: 1.0 }],
  ʊ: [{ morphName: 'U', weight: 0.7 }],
  ə: [{ morphName: 'Ah', weight: 0.3 }],
  p: [{ morphName: 'Hmm', weight: 0.9 }],
  b: [{ morphName: 'Hmm', weight: 0.9 }],
  m: [{ morphName: 'Hmm', weight: 1.0 }],
  f: [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }],
  v: [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }],
  θ: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],
  ð: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],
  t: [{ morphName: 'E', weight: 0.3 }],
  d: [{ morphName: 'E', weight: 0.3 }],
  n: [{ morphName: 'E', weight: 0.3 }, { morphName: 'Hmm', weight: 0.2 }],
  s: [{ morphName: 'E', weight: 0.5 }],
  z: [{ morphName: 'E', weight: 0.5 }],
  ʃ: [{ morphName: 'Ch', weight: 0.8 }, { morphName: 'U', weight: 0.3 }],
  ʒ: [{ morphName: 'Ch', weight: 0.8 }, { morphName: 'U', weight: 0.3 }],
  k: [{ morphName: 'E', weight: 0.2 }],
  g: [{ morphName: 'E', weight: 0.2 }],
  h: [{ morphName: 'Ah', weight: 0.3 }],
  w: [{ morphName: 'Wa', weight: 1.0 }],
  j: [{ morphName: 'E', weight: 0.6 }],
  r: [{ morphName: 'Oh', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],
  l: [{ morphName: 'E', weight: 0.4 }, { morphName: 'Ah', weight: 0.1 }],
};

/** All morph target names that this module drives (for resetting). */
export const MOUTH_MORPH_NAMES = [
  'Ah', 'Ch', 'U', 'E', 'Oh', 'Hmm', 'Wa',
] as const;

/**
 * Look up blend-shape targets for a given viseme symbol or IPA phoneme.
 * Returns an empty array for silence / unknown entries.
 */
export function getBlendShapesForViseme(viseme: string): MorphTarget[] {
  return visemeToBlendShapes[viseme] ?? [];
}
