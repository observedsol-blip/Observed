# OBSERVED — Design Bible: Auftrag an ChatGPT (Taste Skill) + Abnahme

## Prompt (in ChatGPT mit gpt-taste / brandkit einfügen; 00-SPEC.md und 03-SCREEN-MAP.md anhängen)

```
Use the taste skill (brandkit + gpt-taste). Dials: DESIGN_VARIANCE 6, MOTION_INTENSITY 1, VISUAL_DENSITY 3. Output: a Design Bible as a single Markdown document with tables, ready to be committed to a repo as docs/04-DESIGN-BIBLE.md. German prose, English UI copy. No image renders.

PRODUCT: attached 00-SPEC.md (source of truth) and 03-SCREEN-MAP.md (screens, states, copy). Do not change mechanics, copy rules or scope.

ORIGIN, decided: "Korrekturfahne bei Nacht" — a newspaper proof on the night desk. Dark ground #1C1F1D (warm paper), text #E8E0D4, meta #8B8680, rules #E8E0D4 at 18%, pencil blue #3A6EA5 used ONLY for: the user's own value/cursor, the user's bucket in the distribution, and the strike through "pending". Never for outcomes, never for the CTA. No purple/green, no gradients, no glow, no shadows, no card radii, no icon rows, no emoji, no texture on the dark ground. The share card is the only light object (#F0F1EC paper, perforation edge).

TYPE: Literata for the question and the reading sentence ("Yes happened."); IBM Plex Mono for digits, ticks, times, Brier; IBM Plex Sans for controls and labels. Give the full type scale (sp, line height, tracking) for Seeker (6.36", 2670×1200, ~390 dp wide).

DELIVER:
1. Tokens: color (with contrast ratios against ground), type scale, spacing grid, hairline rules (max two per screen), radii (0), elevation (none).
2. Components with anatomy and states: Header; Window line (UTC + local); the 21-tick Scale as input (cursor, −5/+5, hit areas ≥48 dp, one-thumb reach) and the SAME component as crowd distribution (21 bars at the same coordinates, mean line, own bucket); Primary button; Reading sentence; Protocol line; Evidence reference; Sample banner; NO_RESOLVE state; Genesis line.
3. Copy rules as a table: allowed / forbidden words ("closer", "streak", "win", "lose", "approve transaction", "reference natural transaction" are forbidden), tone examples, number formatting (0.160 with dot, no slashed zero, percent without space).
4. Motion: exactly one — the strike through "pending" and "observed" set above it (duration, easing, what never moves).
5. Layout principles that prevent the AI-dashboard look: left-aligned, one hero per screen, asymmetric hierarchy, no centered stacks, no card-in-card.
6. Accessibility: contrast, text size, TalkBack for the scale, one-handed reach zones.
7. A "don'ts" page with five wrong examples described in words.
8. An acceptance checklist a developer can tick per screen.

End with the three decisions you made that the brief left open, and why.
```

## Abnahme (Claude prüft gegen diese Liste)
- Blau kommt nur an den drei erlaubten Stellen vor.
- Kein Wort aus der Verbotsliste in Copy-Beispielen.
- Scale-Komponente ist für Eingabe und Verteilung dieselbe Geometrie (21 Positionen).
- Hero auf Result ist „Yes happened.“, nicht die Zahl.
- Missing Reveals und NO_RESOLVE haben definierte Darstellung.
- Keine Radien, keine Schatten, keine Verläufe, keine Textur auf dem dunklen Grund.
- Zeiten immer UTC + lokal.
- Sample-Banner-Stil definiert.
- Kontrastwerte ≥ 4.5:1 für Fließtext, ≥ 3:1 ab 24 sp.
