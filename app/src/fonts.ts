/**
 * Font loading.
 *
 * IMPORTANT — Android rendering:
 * @expo-google-fonts/{literata,ibm-plex-sans,ibm-plex-mono} ship ONLY static,
 * per-weight TTF cuts (e.g. 400Regular/Literata_400Regular.ttf). None of the
 * three packages contains a variable cut (no *_Variable.ttf, no *_wght*.ttf) —
 * verified with `find node_modules/@expo-google-fonts -iname '*variable*'`.
 * Variable-font cuts have failed to render on Android in the past, so this is
 * the outcome we want; see app/README.md.
 *
 * We import the per-weight SUBPATH modules rather than the package index.
 * The index re-exports every cut (16 for Literata, 14 each for Plex Sans/Mono),
 * which would drag all of them into the bundle. Importing the subpaths keeps
 * exactly seven TTFs in the APK.
 *
 * The italic cut is the seventh: 03 §3 asks for yesterday's sentence in Literata italic, and
 * the screen was rendering Plex Sans with a synthetic slant instead. The cut ships in the
 * package we already have (@expo-google-fonts/literata/400Regular_Italic), so this costs an
 * import and one TTF, not an install (owner asked before installing anything, 22.09.2026).
 */
import { useFonts } from 'expo-font';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';

export function useObservedFonts(): boolean {
  const [loaded] = useFonts({
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_600SemiBold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  return loaded;
}
