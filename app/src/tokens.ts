/**
 * OBSERVED — design tokens.
 *
 * Single source of truth for colour, type and spacing.
 * Owner override (04-DESIGN-BIBLE-BRIEF specifies pencil #3A6EA5; the owner
 * override below wins — see app/README.md).
 *
 * Hard rules: no radii, no shadows, no gradients, no texture on the ground.
 */

export const color = {
  /** warm paper, at night */
  ground: '#1C1F1D',
  /** body and headline text */
  ink: '#E8E0D4',
  /** secondary / graphite */
  meta: '#8B8680',
  /** ONLY: the user's own value + cursor, the user's bucket, the strike over "pending" */
  pencil: '#5B7CFA',
  /** ink at 18% */
  hairline: 'rgba(232, 224, 212, 0.18)',
} as const;

export const font = {
  /** question + reading sentence */
  serif: 'Literata_400Regular',
  /** the sentence the player wrote yesterday — a real italic cut, never a synthetic slant */
  serifItalic: 'Literata_400Regular_Italic',
  serifStrong: 'Literata_600SemiBold',
  /** controls and labels */
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  /** ticks, times, prices, feed ids and transaction signatures */
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  /**
   * Probabilities and Brier values.
   *
   * IBM Plex Mono's default `zero` carries a centre dot (3 contours), which the
   * design brief forbids ("no slashed zero"), and the family ships NO unmarked
   * zero — so no OpenType feature can fix it. Plex Sans has a clean 2-contour
   * zero and its digits are already tabular (every advance is 600 units), so
   * figures still line up in columns. Evidence: app/README.md.
   */
  figures: 'IBMPlexSans_500Medium',
  figuresRegular: 'IBMPlexSans_400Regular',
} as const;

/** 4 dp grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Type scale for the Seeker (6.36", ~390 dp wide). */
export const type = {
  kicker: { fontFamily: font.sans, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  label: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22 },
  question: { fontFamily: font.serif, fontSize: 24, lineHeight: 32 },
  questionSmall: { fontFamily: font.serif, fontSize: 17, lineHeight: 24 },
  reading: { fontFamily: font.serifStrong, fontSize: 34, lineHeight: 42 },
  /** yesterday's own sentence (03 §3): Literata, italic, no quotation marks */
  sentence: { fontFamily: font.serifItalic, fontSize: 17, lineHeight: 26 },
  /** large probability / Brier — Plex Sans, see font.figures */
  hero: { fontFamily: font.figures, fontSize: 64, lineHeight: 70, letterSpacing: -1 },
  numberLarge: { fontFamily: font.figures, fontSize: 40, lineHeight: 46 },
  /** small probability / Brier lines — Plex Sans, tabular */
  figures: { fontFamily: font.figuresRegular, fontSize: 13, lineHeight: 18 },
  figuresSmall: { fontFamily: font.figuresRegular, fontSize: 11, lineHeight: 16 },
  /** ticks, times, prices, ids — Plex Mono */
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18 },
  monoSmall: { fontFamily: font.mono, fontSize: 11, lineHeight: 16 },
} as const;

/** Minimum touch target. */
export const HIT_SLOP_MIN = 48;

/** Never anything but 0. */
export const radius = 0;
