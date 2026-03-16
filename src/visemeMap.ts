/**
 * Maps TTS viseme symbols to the model's morph target blend shapes.
 *
 * Inworld visemes:  sil, aei, o, ee, bmp, fv, l, r, th, qw, cdgknstxyz
 * Model blend shapes (dummy.gltf):
 *   v_aa, v_ch, v_dd, v_ee, v_ff, v_ih, v_kk, v_nn, v_oh, v_ou, v_pp,
 *   v_rr, v_sil, v_ss, v_th
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
  sil: [{ morphName: 'v_sil', weight: 1.0 }],                                              // Mouth closed

  // ── Vowels ──
  aei: [{ morphName: 'v_aa', weight: 0.8 }, { morphName: 'v_ih', weight: 0.3 }],            // Open mouth vowels (a, e, i, ə, ʌ, æ, ɑ)
  o:   [{ morphName: 'v_oh', weight: 1.0 }],                                                // Rounded vowels (o, ʊ, əʊ, oʊ)
  ee:  [{ morphName: 'v_ee', weight: 0.9 }],                                                // Front vowels (i, ɪ, eɪ)

  // ── Consonants ──
  bmp:          [{ morphName: 'v_pp', weight: 0.9 }],                                       // Bilabial (b, m, p)
  fv:           [{ morphName: 'v_ff', weight: 0.9 }],                                       // Labiodental (f, v)
  l:            [{ morphName: 'v_dd', weight: 0.4 }, { morphName: 'v_nn', weight: 0.2 }],   // Lateral (l)
  r:            [{ morphName: 'v_rr', weight: 0.8 }],                                       // Rhotic (r, ɝ, ɚ)
  th:           [{ morphName: 'v_th', weight: 0.8 }],                                       // Dental fricatives (θ, ð)
  qw:           [{ morphName: 'v_ou', weight: 0.8 }, { morphName: 'v_oh', weight: 0.3 }],   // Rounded consonants (w, ʍ)
  cdgknstxyz:   [{ morphName: 'v_kk', weight: 0.3 }, { morphName: 'v_ss', weight: 0.3 }, { morphName: 'v_dd', weight: 0.2 }], // Alveolar/velar (c, d, g, k, n, s, t, x, y, z)
};

/** All morph target names that this module drives (for resetting). */
export const MOUTH_MORPH_NAMES = [
  'v_aa', 'v_ch', 'v_dd', 'v_ee', 'v_ff', 'v_ih', 'v_kk',
  'v_nn', 'v_oh', 'v_ou', 'v_pp', 'v_rr', 'v_sil', 'v_ss', 'v_th',
] as const;

/**
 * Look up blend-shape targets for a given viseme symbol or IPA phoneme.
 * Returns an empty array for silence / unknown entries.
 */
export function getBlendShapesForViseme(viseme: string): MorphTarget[] {
  return visemeToBlendShapes[viseme] ?? [];
}
