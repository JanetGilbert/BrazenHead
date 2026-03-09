/**
 * Maps Inworld TTS viseme symbols to the model's morph target blend shapes.
 *
 * Inworld visemes:  sil, aei, o, ee, bmp, fv, l, r, th, qw, cdgknstxyz
 * Model blend shapes: Ah, Ch, U, E, Oh, Hmm, Wa
 *
 * Each entry is { morphName, weight } — a single viseme can
 * drive multiple blend shapes simultaneously.
 *
 * ── Edit the weights below to tune the lip-sync appearance ──
 */

export interface MorphTarget {
  morphName: string;
  weight: number;
}

const visemeToBlendShapes: Record<string, MorphTarget[]> = {
  // ── Silence / rest ──
  sil: [],                                                                      // Mouth closed

  // ── Vowels ──
  aei: [{ morphName: 'Ah', weight: 0.8 }, { morphName: 'E', weight: 0.3 }],    // Open mouth vowels (a, e, i, ə, ʌ, æ, ɑ)
  o:   [{ morphName: 'Oh', weight: 1.0 }],                                      // Rounded vowels (o, ʊ, əʊ, oʊ)
  ee:  [{ morphName: 'E', weight: 0.9 }],                                       // Front vowels (i, ɪ, eɪ)

  // ── Consonants ──
  bmp:          [{ morphName: 'Hmm', weight: 0.9 }],                            // Bilabial (b, m, p)
  fv:           [{ morphName: 'Hmm', weight: 0.5 }, { morphName: 'E', weight: 0.2 }], // Labiodental (f, v)
  l:            [{ morphName: 'E', weight: 0.4 }, { morphName: 'Ah', weight: 0.1 }],  // Lateral (l)
  r:            [{ morphName: 'Oh', weight: 0.3 }, { morphName: 'U', weight: 0.2 }],  // Rhotic (r, ɝ, ɚ)
  th:           [{ morphName: 'E', weight: 0.3 }, { morphName: 'Ah', weight: 0.1 }],  // Dental fricatives (θ, ð)
  qw:           [{ morphName: 'Wa', weight: 1.0 }],                             // Rounded consonants (w, ʍ)
  cdgknstxyz:   [{ morphName: 'E', weight: 0.3 }],                              // Alveolar/velar (c, d, g, k, n, s, t, x, y, z)
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
